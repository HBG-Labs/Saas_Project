import { describe, expect, it } from 'vitest';

import type { PlanNode, PlanTextNode, RenderPlan } from '../contracts/render-plan.ts';
import { hashDocument } from '../integrity/canonical.ts';
import { clone, codes, AUDIO_TARGETS, loadFixturePatterns, loadFixturePresets, mustBuild, mustCompile, resolvedInk, resolvedSignal } from '../test-support.ts';
import { validateRenderPlan } from '../validation/validate.ts';
import { compileSpec } from './compile.ts';

const ink = resolvedInk();
const signal = resolvedSignal();
const spec = mustBuild(ink);

const textNodes = (plan: RenderPlan): PlanTextNode[] =>
  plan.scenes.flatMap((s) => s.nodes).filter((n): n is PlanTextNode => n.type === 'text');
const allNodes = (plan: RenderPlan): PlanNode[] => plan.scenes.flatMap((s) => s.nodes);

describe('compilateur', () => {
  it('produit un Render Plan valide, relié à la spec et au style résolu', () => {
    const { plan } = mustCompile(spec, ink);
    expect(validateRenderPlan(plan).ok).toBe(true);
    expect(plan.spec.sha256).toBe(hashDocument(spec));
    expect(plan.style).toEqual({ mode: 'creative', sha256: ink.sha256 });
  });

  it('est déterministe : même spec, même style, même configuration, même plan', () => {
    expect(hashDocument(mustCompile(spec, resolvedInk()).plan)).toBe(hashDocument(mustCompile(spec, resolvedInk()).plan));
  });

  it('c’est ici qu’apparaissent pixels, frames, couleurs et fichiers de police', () => {
    const { plan } = mustCompile(spec, ink);
    const text = textNodes(plan)[0]!;
    expect(text.box.w).toBeGreaterThan(0);
    expect(text.lines[0]!.runs[0]!.size).toBeGreaterThan(0);
    expect(text.lines[0]!.runs[0]!.color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(text.tracks.every((t) => t.keys.every((k) => Number.isInteger(k.frame)))).toBe(true);
    expect(plan.fonts.map((f) => f.file)).toEqual(['lib:playfair-display-latin-900.ttf']);
    expect(text.lines.every((l) => l.measured_width === null)).toBe(true);
  });

  it('la même spec compilée avec deux styles donne deux plans différents', () => {
    const a = mustCompile(spec, ink).plan;
    const b = mustCompile(spec, signal).plan;
    expect(a.spec.sha256).toBe(b.spec.sha256);
    expect(hashDocument(a)).not.toBe(hashDocument(b));
    expect(a.scenes[0]!.background).not.toBe(b.scenes[0]!.background);
    expect(a.fonts.map((f) => f.sha256)).not.toEqual(b.fonts.map((f) => f.sha256));
    expect(a.canvas.duration_frames).not.toBe(b.canvas.duration_frames);
    // Casse imposée par le style, pas par la spec.
    expect(textNodes(a)[0]!.lines[0]!.runs[0]!.text).toBe('Chaque nuit,');
    expect(textNodes(b)[0]!.lines[0]!.runs[0]!.text).toBe('CHAQUE NUIT,');
  });

  it('les courbes du plan sont celles du style', () => {
    const plan = mustCompile(spec, ink).plan;
    const reveal = textNodes(plan)[0]!.tracks.find((t) => t.property === 'clip_top')!;
    expect(reveal.keys[0]!.ease).toEqual(ink.style.motion_personality.easings['enter']);
    const accentScale = textNodes(plan)[0]!.tracks.find((t) => t.property === 'scale' && t.target?.run)!;
    expect(Math.max(...accentScale.keys.map((k) => Number(k.value)))).toBeCloseTo(1 + ink.style.motion_personality.max_overshoot);
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
    const signalAudio = mustCompile(spec, signal).audio;
    expect(inkAudio.voice).toBeNull();
    expect(inkAudio.cues.map((c) => c.cue)).toEqual(['LOW_HIT', 'LOW_HIT']);
    expect(new Set(signalAudio.cues.map((c) => c.cue))).toEqual(new Set(['BLIP', 'STING']));
    expect(inkAudio.target_lufs).toBe(AUDIO_TARGETS.target_lufs);
  });

  it('refuse proprement un comportement que ce compilateur ne sait pas produire', () => {
    const doc = clone(spec);
    doc.scenes[0]!.layers[0]!.behaviors[0]!.behavior = 'CAMERA_PUSH';
    const result = compileSpec({ spec: doc, resolved: ink, presets: loadFixturePresets(), patterns: loadFixturePatterns(), output: { width: 540, height: 960, fps: 30 }, audioTargets: AUDIO_TARGETS });
    expect(codes(result)).toContain('behavior.unknown');
  });

  it('refuse une sortie qui n’a pas le ratio du format', () => {
    const result = compileSpec({ spec, resolved: ink, presets: loadFixturePresets(), patterns: loadFixturePatterns(), output: { width: 1080, height: 1080, fps: 30 }, audioTargets: AUDIO_TARGETS });
    expect(codes(result)).toEqual(['compile.layout']);
  });

  it('refuse une substitution de style non déclarée', () => {
    const result = compileSpec({ spec, resolved: signal, presets: loadFixturePresets(), patterns: loadFixturePatterns(), output: { width: 540, height: 960, fps: 30 }, audioTargets: AUDIO_TARGETS });
    expect(codes(result)).toEqual(['style.binding_mismatch']);
  });
});
