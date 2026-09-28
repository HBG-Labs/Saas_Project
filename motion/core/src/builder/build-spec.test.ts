import { describe, expect, it } from 'vitest';

import { hashDocument } from '../integrity/canonical.ts';
import { BEHAVIORS } from '../motion/registry.ts';
import {
  clone,
  codes,
  loadFixturePatterns,
  loadFixturePresets,
  loadInk,
  mustBuild,
  mustResolve,
  naturalIntent,
  readFilmIntent,
  resolvedInk,
  resolvedSignal,
} from '../test-support.ts';
import { validateSpec } from '../validation/validate.ts';
import { buildSpec } from './build-spec.ts';

const ink = resolvedInk();

/** Toutes les clés et valeurs d'un document JSON, à plat. */
function flatten(value: unknown, path = ''): { path: string; key: string; value: unknown }[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => flatten(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [{ path: `${path}.${k}`, key: k, value: v }, ...flatten(v, `${path}.${k}`)]);
  }
  return [];
}

describe('SpecBuilder', () => {
  it('produit une spec valide, liée au style résolu', () => {
    const spec = mustBuild(ink);
    expect(spec.style_binding).toEqual({ kind: 'style', id: 'fixture_ink', version: '1.2.0' });
    expect(spec.scenes.map((s) => s.id)).toEqual(['sc_b1', 'sc_b2']);
    expect(validateSpec(spec, ink, { patterns: loadFixturePatterns() }).ok).toBe(true);
  });

  it('est déterministe : même entrée, même spec, octet pour octet', () => {
    expect(hashDocument(mustBuild(resolvedInk()))).toBe(hashDocument(mustBuild(resolvedInk())));
  });

  it('ne produit que du sémantique : ni pixel, ni frame, ni couleur', () => {
    const entries = flatten(mustBuild(ink));
    const forbiddenKeys = ['x', 'y', 'w', 'h', 'px', 'frame', 'frames', 'from', 'to_frame', 'box', 'size', 'width', 'height'];
    expect(entries.filter((e) => forbiddenKeys.includes(e.key)).map((e) => e.path)).toEqual([]);
    expect(entries.filter((e) => typeof e.value === 'string' && /#[0-9a-fA-F]{6}/.test(e.value)).map((e) => e.path)).toEqual([]);
    // Les seules durées sont des beats ou des respirations.
    const durations = entries.filter((e) => e.key === 'duration' || e.key === 'tail' || e.key === 'lead_in' || e.key === 'gap_after');
    for (const d of durations) {
      if (d.value !== null) expect(Object.keys(d.value as object)).toEqual(expect.arrayContaining([expect.stringMatching(/^(beats|breaths)$/)]));
    }
  });

  it('enregistre les axes de variation choisis et l’énergie de l’intent', () => {
    const spec = mustBuild(ink);
    expect(spec.scenes[0]!.pattern.variation).toEqual({
      layout_variant: 'stack_start',
      motion_variant: 'rise_reveal',
      energy: 'medium',
      hierarchy_variant: 'accent_last',
    });
    const high = naturalIntent();
    high.energy = 'high';
    expect(mustBuild(ink, high).scenes[0]!.pattern.variation.energy).toBe('high');
  });

  it('isole l’accent dans un run et l’ancre sur le mot prononcé', () => {
    const scene = mustBuild(ink).scenes[1]!;
    const text = scene.layers[0]!;
    if (text.primitive !== 'text') throw new Error('texte attendu');
    expect(text.content.runs.map((r) => [r.text, r.role ?? 'base', r.break_after ?? false])).toEqual([
      ['Et si', 'base', true],
      ['la Lune', 'base', true],
      ['disparaissait ?', 'accent', false],
    ]);
    const accent = text.behaviors.find((b) => b.behavior === 'ACCENT_WORD');
    expect(accent?.at).toEqual({ voice_word: { segment: 'vo_b2', match: 'disparaissait' }, offset: { beats: -0.25 } });
  });

  it('choisit la variante de mouvement autorisée par le style, sans hasard', () => {
    const style = clone(loadInk());
    style.motion_personality.behaviors['REVEAL_TEXT'] = { allowed: true, variants: ['fade'] };
    const spec = mustBuild(mustResolve({ style }));
    expect(spec.scenes.every((s) => s.pattern.variation.motion_variant === 'soft_reveal')).toBe(true);
  });

  it('refuse quand aucune variante n’est autorisée par le style', () => {
    const style = clone(loadInk());
    style.motion_personality.behaviors['REVEAL_TEXT'] = { allowed: false };
    const result = buildSpec({ intent: readFilmIntent(), resolved: mustResolve({ style }), presets: loadFixturePresets(), patterns: loadFixturePatterns() });
    expect(codes(result)).toContain('builder.no_motion');
  });

  it('refuse un temps narratif qu’aucun pattern n’accepte', () => {
    const intent = clone(readFilmIntent());
    intent.beats[0]!.role = 'cta';
    const result = buildSpec({ intent, resolved: ink, presets: loadFixturePresets(), patterns: loadFixturePatterns() });
    expect(codes(result)).toContain('builder.no_pattern');
  });

  it('épingle chaque comportement à une version du registre et laisse les durées au style', () => {
    const spec = mustBuild(ink);
    const behaviors = spec.scenes.flatMap((s) => s.layers.flatMap((l) => l.behaviors));
    expect(behaviors.every((b) => BEHAVIORS.get(b.behavior, b.version) !== undefined)).toBe(true);
    expect(behaviors.every((b) => b.duration === undefined)).toBe(true);
    expect(spec.scenes[0]!.transition_out).toEqual({ behavior: 'CUT', version: '1.0.0', to: 'sc_b2' });
    const text = spec.scenes[1]!.layers[0]!;
    expect(text.behaviors.map((b) => b.behavior)).toEqual(['REVEAL_TEXT', 'ACCENT_WORD', 'SETTLE', 'EXIT_CLEAR']);
    expect(text.behaviors[3]!.at).toEqual({ before_next: true });
    expect(text.behaviors[2]!.target).toEqual(text.behaviors[1]!.target);
  });

  it('reporte la durée cible de l’intent, en millisecondes', () => {
    expect(mustBuild(ink, readFilmIntent()).duration_target).toEqual({ min_ms: 6000, max_ms: 10000 });
    expect(mustBuild(ink).duration_target).toBeUndefined();
  });

  it('dépend du style pour ce qu’elle lie, pas pour ce qu’elle raconte', () => {
    const a = mustBuild(ink);
    const b = mustBuild(resolvedSignal());
    const { style_binding: _a, ...restA } = a;
    const { style_binding: _b, ...restB } = b;
    expect(hashDocument(restA)).toBe(hashDocument(restB));
  });
});
