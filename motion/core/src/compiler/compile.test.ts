import { describe, expect, it } from 'vitest';

import type { PlanNode, PlanTextNode, RenderPlan } from '../contracts/render-plan.ts';
import { hashDocument } from '../integrity/canonical.ts';
import { BEHAVIORS } from '../motion/registry.ts';
import {
  AUDIO_TARGETS,
  clone,
  codes,
  loadFixturePatterns,
  loadFixturePresets,
  mustBuild,
  mustCompile,
  resolvedInk,
  resolvedSignal,
  fixtureShaper,
} from '../test-support.ts';
import { validateRenderPlan } from '../validation/validate.ts';
import { compileSpec } from './compile.ts';

const ink = resolvedInk();
const signal = resolvedSignal();
const spec = mustBuild(ink);

const textNodes = (plan: RenderPlan): PlanTextNode[] => plan.scenes.flatMap((s) => s.nodes).filter((n): n is PlanTextNode => n.type === 'text');
const allNodes = (plan: RenderPlan): PlanNode[] => plan.scenes.flatMap((s) => s.nodes);
const track = (node: PlanNode, property: string, target?: { run?: string; line?: number }) =>
  node.tracks.find((t) => t.property === property && t.target?.run === target?.run && t.target?.line === target?.line);

describe('compilateur', () => {
  it('produit un Render Plan valide, relié à la spec, au style résolu et au registre', () => {
    const { plan } = mustCompile(spec, ink);
    expect(validateRenderPlan(plan).ok).toBe(true);
    expect(plan.spec.sha256).toBe(hashDocument(spec));
    expect(plan.style).toEqual({ mode: 'creative', sha256: ink.sha256 });
    expect(plan.timing_source).toBe('estimated');
    expect(plan.provenance.behavior_registry).toEqual({ version: BEHAVIORS.version, sha256: BEHAVIORS.sha256 });
    expect(plan.provenance.behaviors.map((b) => `${b.behavior}@${b.version}`)).toContain('ACCENT_WORD@1.0.0');
    expect(plan.provenance.behaviors.find((b) => b.behavior === 'CUT')?.layer).toBeNull();
  });

  it('est déterministe : même spec, même style, même configuration, même plan', () => {
    expect(hashDocument(mustCompile(spec, resolvedInk()).plan)).toBe(hashDocument(mustCompile(spec, resolvedInk()).plan));
  });

  it('c’est ici qu’apparaissent pixels, frames, couleurs résolues et fichiers de police', () => {
    const { plan } = mustCompile(spec, ink);
    const text = textNodes(plan)[0]!;
    expect(text.box.w).toBeGreaterThan(0);
    expect(text.lines[0]!.runs[0]!.color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(text.tracks.every((t) => t.keys.every((k) => Number.isInteger(k.frame)))).toBe(true);
    expect(plan.fonts.map((f) => f.file)).toEqual(['lib:playfair-display-latin-900.ttf']);
    expect(text.lines.every((l) => l.measured_width > 0 && l.measured_width <= text.box.w + 1e-6)).toBe(true);
    expect(text.fit).toMatchObject({ role: 'display.m', policy: 'explicit' });
  });

  it('une seule piste par propriété et par cible, fusionnée dans l’ordre du temps', () => {
    const text = textNodes(mustCompile(spec, ink).plan)[1]!;
    const keys = text.tracks.map((t) => `${t.property}|${t.target?.run ?? ''}|${t.target?.line ?? ''}`);
    expect(new Set(keys).size).toBe(keys.length);
    // L'échelle du run accentué : accentuation puis stabilisation, deux sources.
    const accentRun = text.lines[2]!.runs[0]!.id;
    expect(track(text, 'scale', { run: accentRun })!.sources).toEqual(['bh_b2_accent', 'bh_b2_settle']);
  });

  it('la même spec compilée avec deux styles donne deux plans différents', () => {
    const a = mustCompile(spec, ink).plan;
    const b = mustCompile(spec, signal).plan;
    expect(a.spec.sha256).toBe(b.spec.sha256);
    expect(hashDocument(a)).not.toBe(hashDocument(b));
    expect(a.scenes[0]!.background).not.toBe(b.scenes[0]!.background);
    expect(a.canvas.duration_frames).not.toBe(b.canvas.duration_frames);
    expect(textNodes(a)[0]!.lines[0]!.runs[0]!.text).toBe('Chaque nuit,');
    expect(textNodes(b)[0]!.lines[0]!.runs[0]!.text).toBe('CHAQUE NUIT,');
  });

  it('les courbes et amplitudes du plan sont celles du style', () => {
    const text = textNodes(mustCompile(spec, ink).plan)[1]!;
    expect(track(text, 'opacity', { line: 0 })!.keys[0]!.ease).toEqual(ink.style.motion_personality.easings['enter']);
    const accentRun = text.lines[2]!.runs[0]!.id;
    const scale = track(text, 'scale', { run: accentRun })!;
    expect(Math.max(...scale.keys.map((k) => Number(k.value)))).toBeCloseTo(ink.style.motion_personality.amplitude.accent_scale);
    expect(scale.keys.find((k) => k.ease?.type === 'spring')?.ease).toEqual(ink.style.motion_personality.easings['settle']);
    const travel = ink.style.space[ink.style.motion_personality.amplitude.enter_travel]! * 0.5;
    expect(track(text, 'translate_y', { line: 0 })!.keys[0]!.value).toBeCloseTo(travel);
  });

  it('change d’échelle sans changer de temps : 540×960 contre 1080×1920', () => {
    const small = mustCompile(spec, ink).plan;
    const large = mustCompile(spec, ink, { width: 1080, height: 1920, fps: 30 }).plan;
    expect(large.canvas.duration_frames).toBe(small.canvas.duration_frames);
    const [s, l] = [textNodes(small)[0]!, textNodes(large)[0]!];
    expect(l.box.x).toBeCloseTo(s.box.x * 2, 5);
    expect(l.lines[0]!.runs[0]!.size).toBeCloseTo(s.lines[0]!.runs[0]!.size * 2, 5);
  });

  it('place tout le contenu dans la zone sûre des plateformes visées', () => {
    const plan = mustCompile(spec, ink).plan;
    const presets = loadFixturePresets();
    const k = plan.canvas.width / 1080;
    for (const platform of spec.format.platform_safe_zones) {
      const z = presets.platforms[platform]!.safe_zone.insets;
      for (const node of allNodes(plan)) {
        expect(node.box.x).toBeGreaterThanOrEqual(z.left * k - 0.001);
        expect(node.box.y).toBeGreaterThanOrEqual(z.top * k - 0.001);
        expect(node.box.x + node.box.w).toBeLessThanOrEqual(plan.canvas.width - z.right * k + 0.001);
        expect(node.box.y + node.box.h).toBeLessThanOrEqual(plan.canvas.height - z.bottom * k + 0.001);
      }
    }
  });

  it('dérive les signaux sonores des événements selon le style', () => {
    const inkAudio = mustCompile(spec, ink).audio;
    expect(inkAudio.voice).toBeNull();
    expect(inkAudio.cues.map((c) => c.cue)).toEqual(['LOW_HIT', 'LOW_HIT']);
    expect(new Set(mustCompile(spec, signal).audio.cues.map((c) => c.cue))).toEqual(new Set(['BLIP', 'STING']));
    expect(inkAudio.target_lufs).toBe(AUDIO_TARGETS.target_lufs);
  });

  it('refuse une sortie qui n’a pas le ratio du format', () => {
    const result = compileSpec({ spec, resolved: ink, presets: loadFixturePresets(), patterns: loadFixturePatterns(), output: { width: 1080, height: 1080, fps: 30 }, audioTargets: AUDIO_TARGETS, shaper: fixtureShaper() });
    expect(codes(result)).toEqual(['compile.layout']);
  });

  it('refuse une substitution de style non déclarée', () => {
    const result = compileSpec({ spec, resolved: signal, presets: loadFixturePresets(), patterns: loadFixturePatterns(), output: { width: 540, height: 960, fps: 30 }, audioTargets: AUDIO_TARGETS, shaper: fixtureShaper() });
    expect(codes(result)).toEqual(['style.binding_mismatch']);
  });

  it('refuse un comportement inconnu ou une version inexistante, sans repli', () => {
    const unknown = clone(spec);
    unknown.scenes[0]!.layers[0]!.behaviors[0]!.behavior = 'SPIN_WILDLY';
    expect(codes(compileSpec({ spec: unknown, resolved: ink, presets: loadFixturePresets(), patterns: loadFixturePatterns(), output: { width: 540, height: 960, fps: 30 }, audioTargets: AUDIO_TARGETS, shaper: fixtureShaper() }))).toContain('behavior.unknown');
    const wrongVersion = clone(spec);
    wrongVersion.scenes[0]!.layers[0]!.behaviors[0]!.version = '9.0.0';
    expect(codes(compileSpec({ spec: wrongVersion, resolved: ink, presets: loadFixturePresets(), patterns: loadFixturePatterns(), output: { width: 540, height: 960, fps: 30 }, audioTargets: AUDIO_TARGETS, shaper: fixtureShaper() }))).toEqual(['behavior.unknown_version']);
  });
});
