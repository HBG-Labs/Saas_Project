import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { MotionSceneSpec } from '../contracts/motion-spec.ts';
import type { PlanImageNode, PlanNode, PlanTextNode, RenderPlan } from '../contracts/render-plan.ts';
import type { ResolvedStyle } from '../contracts/resolved-style.ts';
import { hashDocument } from '../integrity/canonical.ts';
import { BEHAVIORS } from '../motion/registry.ts';
import { sampleProperty } from '../runtime/sample.ts';
import { resolveTemporalPlan } from '../temporal/engine.ts';
import {
  AUDIO_TARGETS,
  clone,
  codes,
  DEV_OUTPUT,
  fixtureShaper,
  loadFixtureAssets,
  loadFixturePatterns,
  loadFixturePresets,
  loadInk,
  loadSignal,
  mustBuild,
  mustResolve,
  readFixture,
  resolvedInk,
  resolvedSignal,
} from '../test-support.ts';
import { validateSpec, validateStyle } from '../validation/validate.ts';
import { compileSpec } from './compile.ts';

/**
 * P1.5 — Visual Integrity & Image Motion : mouvements d'image, extension
 * « jusqu'à la fin de la scène », contraste mesuré, portabilité.
 */

const ink = resolvedInk();
const signal = resolvedSignal();
const fixtureAssets = loadFixtureAssets();
const portable = (): MotionSceneSpec => clone(readFixture('moon.portable.spec.json')) as unknown as MotionSceneSpec;

const compile = (spec: MotionSceneSpec, resolved: ResolvedStyle = ink, options: { reducedMotion?: boolean; analyses?: boolean } = {}) =>
  compileSpec({
    spec,
    resolved,
    presets: loadFixturePresets(),
    patterns: loadFixturePatterns(),
    output: DEV_OUTPUT,
    audioTargets: AUDIO_TARGETS,
    allowStyleSubstitution: true,
    shaper: fixtureShaper(),
    assets: fixtureAssets.registry,
    ...(options.analyses === false ? {} : { analyses: fixtureAssets.analyses }),
    reducedMotion: options.reducedMotion ?? false,
  });
function must(spec: MotionSceneSpec, resolved: ResolvedStyle = ink, options: { reducedMotion?: boolean } = {}) {
  const result = compile(spec, resolved, options);
  if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
  return result.value;
}
const all = (nodes: readonly PlanNode[]): PlanNode[] => nodes.flatMap((n) => (n.type === 'group' || n.type === 'mask' ? [n, ...all(n.children)] : [n]));
const find = <T extends PlanNode>(plan: RenderPlan, id: string) => plan.scenes.flatMap((s) => all(s.nodes)).find((n) => n.id === id) as T;
const scene = (plan: RenderPlan, id: string) => plan.scenes.find((s) => s.id === id)!;
const styleWith = (edit: (s: ReturnType<typeof loadInk>) => void) => {
  const style = clone(loadInk());
  edit(style);
  return mustResolve({ style });
};

describe('extension temporelle « jusqu’à la fin de la scène »', () => {
  it('un mouvement d’image ne rallonge JAMAIS la scène (mêmes frames avec ou sans)', () => {
    const withMotion = must(portable()).plan;
    const without = portable();
    for (const sc of without.scenes) for (const layer of sc.layers) for (const l of [layer, ...(layer.primitive === 'mask' ? layer.children : [])]) l.behaviors = l.behaviors.filter((b) => !b.behavior.startsWith('IMAGE_P'));
    const still = must(without).plan;
    expect(withMotion.scenes.map((s) => [s.id, s.from, s.to])).toEqual(still.scenes.map((s) => [s.id, s.from, s.to]));
  });

  it('première clé au début de l’ancre, dernière clé sur la DERNIÈRE frame de la scène (pas de décalage d’une frame)', () => {
    const plan = must(portable()).plan;
    const push = find<PlanImageNode>(plan, 'img_push');
    const track = push.tracks.find((t) => t.property === 'content_scale')!;
    const sc = scene(plan, 'sc_push');
    expect(track.keys[0]).toMatchObject({ frame: sc.from, value: 1 });
    expect(track.keys.at(-1)).toMatchObject({ frame: sc.to - 1, value: ink.style.motion_personality.amplitude.image_push_scale });
    // La valeur finale est atteinte exactement sur la dernière frame, pas avant.
    expect(Number(sampleProperty(push.tracks, 'content_scale', {}, sc.to - 2, 30, 1))).toBeLessThan(ink.style.motion_personality.amplitude.image_push_scale!);
    expect(track.sources).toEqual(['bh_push']);
  });

  it('les comportements P1.3 gardent leurs instants (le film garde ses durées)', () => {
    const film = mustBuild(ink);
    const t = resolveTemporalPlan({ spec: film, style: ink.style, registry: BEHAVIORS });
    const plan = must(film).plan;
    expect(plan.canvas.duration_frames * (1000 / 30)).toBeCloseTo(t.total_ms, -2);
    expect(t.scenes.flatMap((s) => s.behaviors.filter((b) => b.span !== null))).toEqual([]);
  });

  it('refus structurés : durée « jusqu’à la fin » manquante, interdite, ou ancre « après » un mouvement sans fin', () => {
    const missing = portable();
    delete missing.scenes[1]!.layers[0]!.behaviors[0]!.duration;
    expect(codes(validateSpec(missing, ink, { patterns: loadFixturePatterns(), assets: fixtureAssets.registry, registry: BEHAVIORS }))).toContain('behavior.span_required');
    const forbidden = portable();
    forbidden.scenes[3]!.layers[0]!.behaviors[0]!.duration = { until: 'scene_end' };
    expect(codes(validateSpec(forbidden, ink, { patterns: loadFixturePatterns(), assets: fixtureAssets.registry, registry: BEHAVIORS }))).toContain('behavior.span_not_allowed');
    const after = portable();
    after.scenes[1]!.layers[1]!.behaviors[0]!.at = { after: 'bh_push' };
    expect(codes(compile(after))).toEqual(['temporal.anchor_after_span']);
  });
});

describe('mouvements d’image (registre 1.2.0)', () => {
  it('pistes génériques uniquement (content_*, clip_*) ; le renderer ne reçoit aucun identifiant de comportement', () => {
    const plan = must(portable()).plan;
    expect(find<PlanImageNode>(plan, 'img_pan').tracks.map((t) => t.property).sort()).toEqual(['content_scale', 'content_x']);
    const reveal = find<PlanImageNode>(plan, 'img_reveal').tracks.find((t) => t.property === 'clip_top')!;
    expect(reveal.keys.map((k) => k.value)).toEqual([1, 0]);
    expect(JSON.stringify(plan.scenes)).not.toMatch(/IMAGE_(PUSH_IN|PAN|REVEAL)|until|scene_end/);
  });

  it('le mouvement part du point focal projeté (origine de contenu)', () => {
    const plan = must(portable()).plan;
    const push = find<PlanImageNode>(plan, 'img_push');
    expect(push.content_origin.x).toBeCloseTo((push.focus.x - push.crop.x) / push.crop.w, 9);
    expect(push.content_origin.y).toBeCloseTo((push.focus.y - push.crop.y) / push.crop.h, 9);
  });

  it('refuse, image par image, un mouvement qui exposerait une zone hors de l’image', () => {
    const spec = portable();
    // Recadrage serré plaqué au bord droit de l'image : un panoramique vers la gauche n'a pas la place.
    const mask = spec.scenes[2]!.layers[0]!;
    if (mask.primitive !== 'mask') throw new Error('masque attendu');
    mask.children[0]!.behaviors[0]!.variant = 'left';
    const result = compile(spec);
    expect(codes(result)).toEqual(['image.motion_out_of_bounds']);
    expect(result.ok ? '' : result.issues.find((i) => i.code === 'image.motion_out_of_bounds')!.message).toMatch(/img_pan : à la frame \d+/);
  });

  it('propriété : pour toute amplitude de style, le plan tient dans l’image à chaque frame, sinon refus structuré', () => {
    fc.assert(
      fc.property(fc.double({ min: 1.01, max: 1.3, noNaN: true }), fc.double({ min: 1.01, max: 1.3, noNaN: true }), fc.constantFrom('xs', 'sm', 'md', 'lg', 'xl'), (push, pan, travel) => {
        const resolved = styleWith((s) => {
          s.motion_personality.amplitude.image_push_scale = Math.round(push * 1000) / 1000;
          s.motion_personality.amplitude.image_pan_scale = Math.round(pan * 1000) / 1000;
          s.motion_personality.amplitude.image_pan_travel = travel;
        });
        const result = compile(portable(), resolved);
        if (!result.ok) {
          expect(codes(result)).toEqual(['image.motion_out_of_bounds']);
          return;
        }
        // Vérification INDÉPENDANTE, sur le plan : fenêtre visible ⊂ image, à chaque frame.
        const plan = result.value.plan;
        for (const sc of plan.scenes) {
          for (const n of all(sc.nodes)) {
            if (n.type !== 'image') continue;
            const asset = plan.assets[0]!;
            const kx = n.box.w / n.crop.w;
            for (let f = sc.from; f < sc.to; f++) {
              const s = Number(sampleProperty(n.tracks, 'content_scale', {}, f, 30, 1));
              const tx = Number(sampleProperty(n.tracks, 'content_x', {}, f, 30, 0));
              const ox = n.content_origin.x * n.box.w;
              const left = ox + (0 - ox - tx) / s;
              const right = ox + (n.box.w - ox - tx) / s;
              expect(left).toBeGreaterThanOrEqual(-n.crop.x * kx - 0.011);
              expect(right).toBeLessThanOrEqual(-n.crop.x * kx + asset.width * kx + 0.011);
            }
          }
        }
      }),
      { seed: 20260928, numRuns: 25 },
    );
  });

  it('un style sans amplitude d’image refuse le mouvement (aucune valeur cachée)', () => {
    const resolved = styleWith((s) => {
      s.motion_personality.amplitude.image_push_scale = null;
    });
    expect(codes(compile(portable(), resolved))).toEqual(['motion.amplitude_missing']);
  });

  it('mouvement réduit : poussée et panoramique immobiles (« static »), révélation instantanée', () => {
    const reduced = must(portable(), ink, { reducedMotion: true }).plan;
    expect(find<PlanImageNode>(reduced, 'img_push').tracks).toEqual([]);
    expect(find<PlanImageNode>(reduced, 'img_pan').tracks.filter((t) => t.property.startsWith('content_'))).toEqual([]);
    const reveal = find<PlanImageNode>(reduced, 'img_reveal').tracks.find((t) => t.property === 'clip_top')!;
    expect(reveal.keys.length).toBe(2);
    expect(reveal.keys[1]!.frame - reveal.keys[0]!.frame).toBe(1);
    // Le temps ne change pas.
    expect(reduced.canvas.duration_frames).toBe(must(portable()).plan.canvas.duration_frames);
  });

  it('déterministe : même spec, mêmes assets, mêmes versions → même plan', () => {
    expect(hashDocument(must(portable()).plan)).toBe(hashDocument(must(portable()).plan));
  });
});

describe('contraste mesuré (planchers techniques de lisibilité, pas une qualité créative)', () => {
  it('chaque texte porte son rapport : catégorie, seuil, mesure, pire glyphe, frames examinées', () => {
    const plan = must(portable()).plan;
    const stat = find<PlanTextNode>(plan, 'tx_static').contrast;
    expect(stat).toMatchObject({ category: 'large', required: 3, frames: 1, override: null });
    expect(stat.measured).toBeGreaterThanOrEqual(3);
    // L'image bouge sous le texte : toutes les frames stables sont examinées.
    expect(find<PlanTextNode>(plan, 'tx_push').contrast.frames).toBeGreaterThan(1);
    expect(plan.provenance.visual.analyses).toEqual([{ ref: 'night_moon', decoder: 'png-zlib', sha256: expect.stringMatching(/^[0-9a-f]{64}$/) }]);
  });

  it('refuse un accent illisible sur l’image traitée (défaut SIGNAL vu en P1.4), en expliquant où', () => {
    const spec = portable();
    const text = spec.scenes[0]!.layers[1]!;
    if (text.primitive !== 'text') throw new Error('texte attendu');
    text.content.runs = [{ id: 'r_a', text: 'Chaque nuit, la Lune ' }, { id: 'r_b', text: 'veille.', role: 'accent' }];
    text.style.accent_color = 'color.accent';
    const result = compile(spec, signal);
    expect(codes(result)).toEqual(['contrast.insufficient']);
    expect(result.ok ? '' : result.issues.find((i) => i.code === 'contrast.insufficient')!.message).toMatch(/tx_static : contraste mesuré 1\.\d\d:1 < 3:1 .*« r_b »/);
  });

  it('dérogation EXPLICITE et motivée : tracée dans le plan et signalée ; jamais implicite', () => {
    const spec = portable();
    const text = spec.scenes[0]!.layers[1]!;
    if (text.primitive !== 'text') throw new Error('texte attendu');
    text.content.runs = [{ id: 'r_a', text: 'Chaque nuit, la Lune ' }, { id: 'r_b', text: 'veille.', role: 'accent' }];
    text.style.accent_color = 'color.accent';
    text.contrast_override = { min_ratio: 1, reason: 'test : lisibilité assumée par la direction artistique' };
    const result = compile(spec, signal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.map((w) => w.code)).toContain('contrast.override');
    expect(find<PlanTextNode>(result.value.plan, 'tx_static').contrast).toMatchObject({ required: 1, override: { min_ratio: 1 } });
    // Raison trop courte : refus de schéma, pas de dérogation « silencieuse ».
    text.contrast_override = { min_ratio: 1, reason: 'parce que' };
    expect(validateSpec(spec, signal, { patterns: loadFixturePatterns(), assets: fixtureAssets.registry, allowStyleSubstitution: true }).ok).toBe(false);
  });

  it('un style peut RELEVER le plancher, jamais l’abaisser', () => {
    const strict = styleWith((s) => {
      s.rhythm_personality.reading.min_contrast.large = 20;
    });
    expect(codes(compile(portable(), strict))).toEqual(['contrast.insufficient']);
    const lax = clone(loadInk());
    lax.rhythm_personality.reading.min_contrast.large = 2;
    expect(codes(validateStyle(lax))).toContain('style.contrast_floor');
  });

  it('texte clair posé sur la lune claire : refusé ; texte au bord du halo : accepté (métrique locale, par glyphe)', () => {
    const on = (area: { x: [number, number]; y: [number, number] }) => {
      const spec = portable();
      spec.scenes = [spec.scenes[0]!];
      delete spec.scenes[0]!.transition_out;
      spec.rhythm.sections = [spec.rhythm.sections[0]!];
      spec.voice.segments = [spec.voice.segments[0]!];
      const text = spec.scenes[0]!.layers[1]!;
      if (text.primitive !== 'text') throw new Error('texte attendu');
      delete text.region;
      text.area = { ...area, align_x: 'start', align_y: 'start' };
      text.content.runs = [{ id: 'r_s', text: 'La Lune veille' }];
      return compile(spec);
    };
    expect(codes(on({ x: [0.25, 1], y: [0.62, 0.95] }))).toEqual(['contrast.insufficient']);
    expect(on({ x: [0, 1], y: [0.5, 0.8] }).ok).toBe(true);
  });

  it('sans analyse de pixels, un texte posé sur une image n’est pas évaluable : refus explicite', () => {
    expect(codes(compile(portable(), ink, { analyses: false }))).toEqual(['contrast.analysis_missing']);
  });
});

describe('portabilité déclarée', () => {
  it('une composition portable n’utilise jamais la grille d’un style', () => {
    const grid = portable();
    grid.scenes[3]!.layers[0]!.placement = { col: 1, col_span: 4, row: 1, row_span: 3 };
    delete grid.scenes[3]!.layers[0]!.area;
    const points = portable();
    const path = points.scenes[2]!.layers[2]!;
    if (path.primitive !== 'path') throw new Error('tracé attendu');
    path.geometry = { points: [{ x: 0, y: 10 }, { x: 4, y: 10 }] };
    const opts = { patterns: loadFixturePatterns(), assets: fixtureAssets.registry };
    expect(codes(validateSpec(grid, ink, opts))).toEqual(['composition.not_portable']);
    expect(codes(validateSpec(points, ink, opts))).toEqual(['composition.not_portable']);
  });

  it('une composition liée à son style refuse toute substitution, même déclarée ; portable : substitution tracée', () => {
    const bound = portable();
    bound.composition.portability = 'style_bound';
    expect(codes(compile(bound, signal))).toEqual(['composition.style_bound_substitution']);
    expect(compile(bound, ink).ok).toBe(true);
    const ok = compile(portable(), signal);
    expect(ok.ok && ok.warnings.map((w) => w.code)).toContain('style.substituted');
  });

  it('placement « area » : fractions exactes de la zone utile, jamais calées sur la grille', () => {
    const plan = must(portable()).plan;
    const c = plan.canvas.safe_area;
    const reveal = find<PlanImageNode>(plan, 'img_reveal');
    expect(reveal.box.y).toBeCloseTo(c.y, 9);
    expect(reveal.box.w).toBeCloseTo(c.w, 9);
    const mask = find(plan, 'msk_pan');
    expect(mask.box.x).toBeCloseTo(c.x + 0.15 * c.w, 9);
    expect(mask.box.w).toBeCloseTo(0.7 * c.w, 9);
  });

  it('le builder produit une composition portable, valide avec n’importe quel style', () => {
    const film = mustBuild(ink);
    expect(film.composition).toEqual({ portability: 'portable' });
    expect(validateSpec(film, signal, { patterns: loadFixturePatterns(), allowStyleSubstitution: true }).ok).toBe(true);
    expect(loadSignal().version).toBe('1.4.0');
  });
});
