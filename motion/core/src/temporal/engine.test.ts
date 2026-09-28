import { describe, expect, it } from 'vitest';

import type { MotionSceneSpec } from '../contracts/motion-spec.ts';
import { hashDocument } from '../integrity/canonical.ts';
import { BEHAVIORS } from '../motion/registry.ts';
import { clone, mustBuild, readFilmIntent, resolvedInk, resolvedSignal } from '../test-support.ts';
import { distribute, resolveTemporalPlan, TemporalError } from './engine.ts';
import type { TemporalPlan } from './engine.ts';
import { readingTime } from './readability.ts';
import { estimateSpeech } from './speech.ts';

const ink = resolvedInk();
const signal = resolvedSignal();
const base = () => clone(mustBuild(ink));
const plan = (spec: MotionSceneSpec, style = ink.style): TemporalPlan => resolveTemporalPlan({ spec, style, registry: BEHAVIORS });
const behavior = (p: TemporalPlan, id: string) => p.scenes.flatMap((s) => s.behaviors).find((b) => b.instance === id)!;
const failure = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    if (error instanceof TemporalError) return error.code;
    throw error;
  }
  return 'ok';
};

describe('ancres', () => {
  it('SCENE_START : l’entrée commence au début de la scène', () => {
    const p = plan(base());
    expect(behavior(p, 'bh_b1_reveal').start_ms).toBe(p.scenes[0]!.start_ms);
    expect(behavior(p, 'bh_b2_reveal').start_ms).toBe(p.scenes[1]!.start_ms);
  });

  it('SCENE_END / BEFORE_NEXT : la sortie se termine exactement à la fin de la scène', () => {
    const p = plan(base());
    for (const scene of p.scenes) {
      const exits = scene.behaviors.filter((b) => b.phase === 'exit');
      expect(exits.length).toBeGreaterThan(0);
      for (const exit of exits) expect(exit.end_ms).toBe(scene.end_ms);
    }
    const spec = base();
    spec.scenes[0]!.layers[0]!.behaviors[3]!.at = { event: 'scene.end' };
    expect(behavior(plan(spec), 'bh_b1_exit').end_ms).toBe(plan(spec).scenes[0]!.end_ms);
  });

  it('SCENE_END avec décalage : la sortie finit un beat avant la fin', () => {
    const spec = base();
    spec.scenes[0]!.layers[0]!.behaviors[3]!.at = { event: 'scene.end', offset: { beats: -1 } };
    const p = plan(spec);
    expect(behavior(p, 'bh_b1_exit').end_ms).toBe(p.scenes[0]!.end_ms - p.scenes[0]!.beat_ms);
  });

  it('AFTER (comportement) et WITH (via un élément ancré sur la sortie)', () => {
    const p = plan(base());
    expect(behavior(p, 'bh_b1_settle').start_ms).toBe(behavior(p, 'bh_b1_accent').end_ms);
    const spec = base();
    spec.scenes[0]!.layers[1]!.behaviors[1]!.at = { with: 'bh_b1_exit' };
    const q = plan(spec);
    expect(behavior(q, 'bh_b1_rule_exit').start_ms).toBe(behavior(q, 'bh_b1_exit').start_ms);
  });

  it('AFTER_PREVIOUS, WITH_LAYER, AFTER_LAYER, BEAT', () => {
    const spec = base();
    spec.scenes[0]!.layers[1]!.behaviors[0]!.at = { after_previous: true };
    let p = plan(spec);
    expect(behavior(p, 'bh_b1_draw').start_ms).toBe(behavior(p, 'bh_b1_settle').end_ms);
    spec.scenes[0]!.layers[1]!.behaviors[0]!.at = { with_layer: 'tx_b1' };
    p = plan(spec);
    expect(behavior(p, 'bh_b1_draw').start_ms).toBe(behavior(p, 'bh_b1_reveal').start_ms);
    spec.scenes[0]!.layers[1]!.behaviors[0]!.at = { after_layer: 'tx_b1' };
    p = plan(spec);
    expect(behavior(p, 'bh_b1_draw').start_ms).toBe(behavior(p, 'bh_b1_settle').end_ms);
    spec.scenes[0]!.layers[1]!.behaviors[0]!.at = { beat: 2 };
    p = plan(spec);
    expect(behavior(p, 'bh_b1_draw').start_ms).toBe(2 * p.scenes[0]!.beat_ms);
  });

  it('refuse une ancre réservée (voix non alignée)', () => {
    const spec = base();
    spec.scenes[0]!.layers[0]!.behaviors[0]!.at = { voice_breath: { segment: 'vo_b1', index: 0 } };
    expect(failure(() => plan(spec))).toBe('temporal.anchor_reserved');
  });
});

describe('parole estimée (EstimatedSpeechTiming)', () => {
  it('est marquée « estimated », dérive du débit du style et reste croissante', () => {
    const p = plan(base());
    const speech = p.scenes[0]!.speech[0]!;
    expect(speech.source).toBe('estimated');
    expect(p.timing_source).toBe('estimated');
    if (speech.source !== 'estimated') throw new Error('estimation attendue');
    expect(speech.words_per_minute).toBe(ink.style.voice_personality.pace_wpm.measured);
    const starts = speech.words.map((w) => w.start_ms);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('calcule en millisecondes entières : mots × 60 000 / débit', () => {
    const t = estimateSpeech('s', 'un deux trois quatre', 1000, 120);
    expect(t.end_ms - t.start_ms).toBe(2000);
    expect(t.words.every((w) => Number.isInteger(w.start_ms))).toBe(true);
  });

  it('sans ancre de parole, la source du timing est « none »', () => {
    const spec = base();
    for (const scene of spec.scenes) {
      scene.timing.anchor = { duration: { beats: 9 } };
      for (const layer of scene.layers) for (const b of layer.behaviors) if ('voice_word' in b.at) b.at = { after_previous: true };
    }
    expect(plan(spec).timing_source).toBe('none');
  });
});

describe('lisibilité minimale', () => {
  it('suit l’heuristique du style : max(plancher, mots, caractères) × importance', () => {
    const r = readingTime({ text: 'Et si la Lune disparaissait ?', locale: 'fr-FR', importance: 'primary' }, ink.style);
    const reading = ink.style.rhythm_personality.reading;
    expect(r.words).toBe(6);
    expect(r.required_ms).toBe(Math.max(reading.min_hold_ms, 6 * reading.ms_per_word, r.chars * reading.ms_per_char));
    const secondary = readingTime({ text: 'Et si la Lune disparaissait ?', locale: 'fr-FR', importance: 'secondary' }, ink.style);
    expect(secondary.required_ms).toBeLessThan(r.required_ms);
  });

  it('chaque texte reste stable au moins le temps de lecture requis', () => {
    for (const scene of plan(base()).scenes) {
      for (const r of scene.readability) expect(r.stable_ms).toBeGreaterThanOrEqual(r.requirement.required_ms);
    }
  });
});

describe('silences élastiques et timing impossible', () => {
  it('étire les pauses pour atteindre la durée minimale, sans toucher au contenu', () => {
    const natural = plan(mustBuild(signal), signal.style);
    const fitted = plan(mustBuild(signal, readFilmIntent()), signal.style);
    expect(natural.total_ms).toBeLessThan(6000);
    expect(fitted.total_ms).toBe(6000);
    expect(fitted.fitted_ms).toBe(6000 - natural.total_ms);
    for (const [i, scene] of fitted.scenes.entries()) {
      const before = natural.scenes[i]!;
      expect(scene.hold.ms).toBeGreaterThanOrEqual(before.hold.ms);
      expect(scene.hold.ms).toBeLessThanOrEqual(scene.hold.max_ms);
      // Durées des comportements inchangées : rien n'est accéléré ni ralenti.
      expect(scene.behaviors.map((b) => b.duration_ms)).toEqual(before.behaviors.map((b) => b.duration_ms));
    }
  });

  it('réduit les pauses (jamais sous leur minimum) pour tenir la durée maximale', () => {
    const spec = mustBuild(ink);
    const natural = plan(spec);
    spec.duration_target = { min_ms: 1000, max_ms: natural.total_ms - 300 };
    const fitted = plan(spec);
    expect(fitted.total_ms).toBe(natural.total_ms - 300);
    for (const scene of fitted.scenes) expect(scene.hold.ms).toBeGreaterThanOrEqual(scene.hold.min_ms);
  });

  it('refuse une durée impossible au lieu de compresser (temporal.impossible_duration)', () => {
    const spec = mustBuild(ink);
    spec.duration_target = { min_ms: 1000, max_ms: 4000 };
    expect(failure(() => plan(spec))).toBe('temporal.impossible_duration');
  });

  it('refuse une durée impossible à remplir (temporal.unfillable_duration)', () => {
    const spec = mustBuild(ink);
    spec.duration_target = { min_ms: 60_000, max_ms: 90_000 };
    expect(failure(() => plan(spec))).toBe('temporal.unfillable_duration');
  });

  it('refuse une scène de durée imposée trop courte (temporal.impossible_scene)', () => {
    const spec = mustBuild(ink);
    spec.scenes[0]!.timing.anchor = { duration: { beats: 1 } };
    for (const layer of spec.scenes[0]!.layers) for (const b of layer.behaviors) if ('voice_word' in b.at) b.at = { after_previous: true };
    expect(failure(() => plan(spec))).toBe('temporal.impossible_scene');
  });

  it('refuse une scène de durée imposée plus longue que ses pauses ne le permettent (temporal.unfillable_scene)', () => {
    const spec = mustBuild(ink);
    spec.scenes[0]!.timing.anchor = { duration: { beats: 30 } };
    for (const layer of spec.scenes[0]!.layers) for (const b of layer.behaviors) if ('voice_word' in b.at) b.at = { after_previous: true };
    expect(failure(() => plan(spec))).toBe('temporal.unfillable_scene');
  });

  it('refuse une durée verrouillée hors du budget du comportement', () => {
    const spec = mustBuild(ink);
    spec.scenes[0]!.layers[0]!.behaviors[0]!.duration = { beats: 20 };
    expect(failure(() => plan(spec))).toBe('temporal.duration_out_of_budget');
  });
});

describe('rythme résolu depuis le style', () => {
  it('durée = beats de la phase × tempo de la section × énergie', () => {
    const p = plan(base());
    const scene = p.scenes[0]!;
    const t = ink.style.motion_personality.timing;
    expect(behavior(p, 'bh_b1_accent').duration_ms).toBe(Math.round(t.accent_beats * scene.energy_factor * scene.beat_ms));
    expect(behavior(p, 'bh_b1_reveal').stagger_ms).toBe(Math.round(t.stagger_beats * scene.energy_factor * scene.beat_ms));
  });

  it('l’énergie de la spec change réellement les durées', () => {
    const low = base();
    const high = base();
    for (const s of low.scenes) s.pattern.variation.energy = 'low';
    for (const s of high.scenes) s.pattern.variation.energy = 'high';
    expect(behavior(plan(low), 'bh_b1_reveal').duration_ms).toBeGreaterThan(behavior(plan(high), 'bh_b1_reveal').duration_ms);
  });

  it('deux styles, même spec : plans temporels différents', () => {
    const spec = base();
    const a = plan(spec, ink.style);
    const b = plan(spec, signal.style);
    expect(a.total_ms).not.toBe(b.total_ms);
    expect(behavior(a, 'bh_b1_reveal').duration_ms).not.toBe(behavior(b, 'bh_b1_reveal').duration_ms);
    expect(behavior(a, 'bh_b1_reveal').stagger_ms).not.toBe(behavior(b, 'bh_b1_reveal').stagger_ms);
  });
});

describe('phases et déterminisme', () => {
  it('produit les phases présentes, dans l’ordre, avec une coupe entre les scènes', () => {
    const p = plan(base());
    expect(p.scenes[0]!.phases.map((ph) => ph.phase)).toEqual(['ENTER', 'ACCENT', 'SETTLE', 'HOLD', 'EXIT', 'CUT']);
    expect(p.scenes[1]!.phases.map((ph) => ph.phase)).toEqual(['ENTER', 'ACCENT', 'SETTLE', 'HOLD', 'EXIT']);
    expect(p.scenes[0]!.transition_out).toEqual({ behavior: 'CUT', version: '1.0.0', at_ms: p.scenes[0]!.end_ms });
    expect(p.scenes[1]!.start_ms).toBe(p.scenes[0]!.end_ms);
  });

  it('ne force pas les phases absentes', () => {
    const spec = base();
    spec.scenes[0]!.layers[0]!.behaviors.splice(1, 2);
    spec.scenes[0]!.layers[1]!.behaviors[0]!.at = { after: 'bh_b1_reveal' };
    spec.scenes[0]!.events = spec.scenes[0]!.events.filter((e) => e.kind !== 'IMPACT');
    expect(plan(spec).scenes[0]!.phases.map((ph) => ph.phase)).toEqual(['ENTER', 'HOLD', 'EXIT', 'CUT']);
  });

  it('millisecondes entières partout, et même entrée → même plan', () => {
    const a = plan(base());
    const b = plan(base());
    expect(hashDocument(a)).toBe(hashDocument(b));
    for (const scene of a.scenes) {
      for (const bh of scene.behaviors) expect(Number.isInteger(bh.start_ms) && Number.isInteger(bh.end_ms)).toBe(true);
    }
  });

  it('répartit un ajustement entier de façon déterministe, dans les capacités', () => {
    expect(distribute(10, [5, 5, 5])).toEqual([4, 3, 3]);
    expect(distribute(2, [1, 1, 1])).toEqual([1, 1, 0]);
    expect(() => distribute(10, [1, 1, 1])).toThrowError(TemporalError);
    expect(distribute(5, [0, 10])).toEqual([0, 5]);
    expect(distribute(7, [3, 3, 3]).reduce((a, b) => a + b, 0)).toBe(7);
  });
});
