import { describe, expect, it } from 'vitest';

import { EASING_ROLES } from '../contracts/behavior.ts';
import type { MotionSceneSpec } from '../contracts/motion-spec.ts';
import type { PlanNode, RenderPlan, Track } from '../contracts/render-plan.ts';
import type { ResolvedStyle } from '../contracts/resolved-style.ts';
import { compileSpec } from '../compiler/compile.ts';
import {
  AUDIO_TARGETS,
  clone,
  codes,
  DEV_OUTPUT,
  loadFixturePatterns,
  loadFixturePresets,
  loadInk,
  mustBuild,
  mustCompile,
  mustResolve,
  resolvedInk,
  resolvedSignal,
  fixtureShaper,
} from '../test-support.ts';
import { EasingError, resolveAllEasings, resolveEasing } from './easing-catalog.ts';

const ink = resolvedInk();
const signal = resolvedSignal();
const base = () => clone(mustBuild(ink));

const compile = (spec: MotionSceneSpec, resolved: ResolvedStyle = ink, reducedMotion = false) =>
  compileSpec({ spec, resolved, presets: loadFixturePresets(), patterns: loadFixturePatterns(), output: DEV_OUTPUT, audioTargets: AUDIO_TARGETS, allowStyleSubstitution: true, reducedMotion, shaper: fixtureShaper() });

const nodes = (plan: RenderPlan): PlanNode[] => plan.scenes.flatMap((s) => s.nodes);
const node = (plan: RenderPlan, id: string) => nodes(plan).find((n) => n.id === id)!;
const tracks = (plan: RenderPlan): Track[] => nodes(plan).flatMap((n) => n.tracks);
const find = (n: PlanNode, property: string, target?: { run?: string; line?: number }) =>
  n.tracks.find((t) => t.property === property && t.target?.run === target?.run && t.target?.line === target?.line);

function styleWith(edit: (style: ReturnType<typeof loadInk>) => void): ResolvedStyle {
  const style = clone(loadInk());
  edit(style);
  return mustResolve({ style });
}

describe('catalogue des courbes', () => {
  it('chaque rôle se résout vers la courbe du style, sans valeur par défaut cachée', () => {
    for (const role of EASING_ROLES) expect(resolveEasing(ink.style, role)).toEqual(ink.style.motion_personality.easings[role]);
    expect(resolveAllEasings(signal.style)).not.toEqual(resolveAllEasings(ink.style));
    const missing = clone(ink.style);
    delete missing.motion_personality.easings['settle'];
    expect(() => resolveEasing(missing, 'settle')).toThrowError(EasingError);
  });

  it('le Render Plan porte les courbes résolues (paramètres numériques), jamais un rôle ni une fonction', () => {
    const { plan } = mustCompile(base(), ink);
    const eases = tracks(plan).flatMap((t) => t.keys.map((k) => k.ease).filter((e) => e !== undefined));
    expect(eases.length).toBeGreaterThan(0);
    for (const e of eases) expect(['linear', 'bezier', 'spring']).toContain(e.type);
    expect(JSON.stringify(plan)).not.toMatch(/"ease":"(enter|exit|inout|settle)"/);
  });
});

describe('compilation des pistes', () => {
  it('clés strictement ordonnées, frames entières, dans la scène', () => {
    const { plan } = mustCompile(base(), ink);
    for (const scene of plan.scenes) {
      for (const t of scene.nodes.flatMap((n) => n.tracks)) {
        const frames = t.keys.map((k) => k.frame);
        for (let i = 1; i < frames.length; i++) expect(frames[i]!).toBeGreaterThan(frames[i - 1]!);
        expect(frames[0]!).toBeGreaterThanOrEqual(scene.from);
        expect(frames[frames.length - 1]!).toBeLessThan(scene.to);
        expect(frames.every(Number.isInteger)).toBe(true);
      }
    }
  });

  it('ACCENT_WORD anime la couleur du run vers l’accent du style, puis la tient', () => {
    const { plan } = mustCompile(base(), ink);
    const text = node(plan, 'tx_b2');
    if (text.type !== 'text') throw new Error('texte attendu');
    const run = text.lines[2]!.runs[0]!;
    const color = find(text, 'color', { run: run.id })!;
    expect(color.sources).toEqual(['bh_b2_accent']);
    expect(color.keys[0]!.value).toBe(run.color);
    expect(color.keys[color.keys.length - 1]!.value).not.toBe(run.color);
  });

  it('continuité : SETTLE repart de la valeur laissée par ACCENT_WORD, et revient au repos', () => {
    const { plan } = mustCompile(base(), ink);
    const text = node(plan, 'tx_b2');
    if (text.type !== 'text') throw new Error('texte attendu');
    const scale = find(text, 'scale', { run: text.lines[2]!.runs[0]!.id })!;
    const values = scale.keys.map((k) => Number(k.value));
    expect(values[0]).toBe(1);
    expect(Math.max(...values)).toBeCloseTo(ink.style.motion_personality.amplitude.accent_scale);
    expect(values[values.length - 1]).toBe(1);
  });

  it('le décalage (stagger) vient du style ; un paramètre validé peut le remplacer', () => {
    const lineStarts = (plan: RenderPlan) => {
      const text = node(plan, 'tx_b2');
      return [0, 1, 2].map((line) => find(text, 'opacity', { line })!.keys[0]!.frame);
    };
    const natural = lineStarts(mustCompile(base(), ink).plan);
    expect(natural[1]! - natural[0]!).toBeGreaterThan(0);
    const spec = base();
    spec.scenes[1]!.layers[0]!.behaviors[0]!.params = { stagger_beats: 0 };
    const flat = lineStarts(mustCompile(spec, ink).plan);
    // Sans décalage, chaque ligne garde sa piste : toutes partent ensemble.
    expect(flat).toEqual([flat[0], flat[0], flat[0]]);
    const bad = base();
    bad.scenes[1]!.layers[0]!.behaviors[0]!.params = { stagger_beats: 99 };
    expect(codes(compile(bad))).toContain('behavior.param_invalid');
  });

  it('une amplitude du style peut être remplacée par un rôle d’espacement validé', () => {
    const spec = base();
    spec.scenes[0]!.layers[0]!.behaviors[0]!.params = { enter_travel: 'sm' };
    const text = node(mustCompile(spec, ink).plan, 'tx_b1');
    expect(find(text, 'translate_y', { line: 0 })!.keys[0]!.value).toBeCloseTo(ink.style.space['sm']! * 0.5);
  });
});

describe('conflits et compatibilités', () => {
  it('deux comportements sur la même propriété et le même intervalle : erreur, jamais « le dernier gagne »', () => {
    const spec = base();
    const reveal = spec.scenes[0]!.layers[0]!.behaviors[0]!;
    spec.scenes[0]!.layers[0]!.behaviors.splice(1, 0, { ...clone(reveal), id: 'bh_b1_reveal_twice', variant: 'fade' });
    expect(codes(compile(spec))).toEqual(['motion.track_conflict']);
  });

  it('comportements déclarés incompatibles simultanés : erreur', () => {
    const spec = base();
    spec.scenes[0]!.layers[0]!.behaviors[3]!.at = { with: 'bh_b1_reveal' };
    expect(codes(compile(spec))).toEqual(['motion.incompatible_behaviors']);
  });

  it('comportement incompatible avec la primitive : refusé avant toute compilation', () => {
    const spec = base();
    spec.scenes[0]!.layers[1]!.behaviors[0]!.behavior = 'REVEAL_TEXT';
    spec.scenes[0]!.layers[1]!.behaviors[0]!.variant = 'rise';
    expect(codes(compile(spec))).toContain('behavior.primitive');
  });
});

describe('budget de mouvement', () => {
  it('au-delà du seuil du style : avertissement', () => {
    const tight = styleWith((s) => {
      s.motion_personality.budget = { attention_peak: 3, attention_total: 3 };
    });
    const result = compile(base(), tight);
    expect(result.ok).toBe(true);
    const warnings = (result.ok ? result.warnings : []).map((w) => w.code);
    expect(warnings).toContain('motion.attention_peak');
    expect(warnings).toContain('motion.attention_total');
  });

  it('au-delà du double du seuil : dangereux, erreur', () => {
    const tiny = styleWith((s) => {
      s.motion_personality.budget = { attention_peak: 1, attention_total: 20 };
    });
    expect(codes(compile(base(), tiny))).toEqual(['motion.budget_exceeded']);
  });

  it('dans le budget : aucun avertissement de mouvement', () => {
    const result = compile(base());
    expect(result.ok && result.warnings.filter((w) => w.code.startsWith('motion.'))).toEqual([]);
  });
});

describe('mouvement réduit', () => {
  it('retire translations et échelles, garde opacité et couleur, rend le tracé instantané', () => {
    const { plan } = mustCompile(base(), ink, DEV_OUTPUT, true);
    expect(plan.reduced_motion).toBe(true);
    const properties = new Set(tracks(plan).map((t) => t.property));
    expect(properties.has('translate_y')).toBe(false);
    expect(properties.has('scale')).toBe(false);
    expect(properties.has('opacity')).toBe(true);
    expect(properties.has('color')).toBe(true);
    const draw = find(node(plan, 'ln_b1'), 'path_progress')!;
    expect(draw.keys.map((k) => k.value)).toEqual([0, 1]);
    expect(draw.keys[1]!.frame - draw.keys[0]!.frame).toBe(1);
  });

  it('ne change pas le temps : même durée totale et mêmes scènes', () => {
    const full = mustCompile(base(), ink).plan;
    const reduced = mustCompile(base(), ink, DEV_OUTPUT, true).plan;
    expect(reduced.canvas.duration_frames).toBe(full.canvas.duration_frames);
    expect(reduced.scenes.map((s) => [s.from, s.to])).toEqual(full.scenes.map((s) => [s.from, s.to]));
  });
});
