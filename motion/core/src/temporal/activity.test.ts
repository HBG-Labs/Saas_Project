import { describe, expect, it } from 'vitest';

import { BEHAVIORS } from '../motion/registry.ts';
import { mustBuild, mustCompile, readFilmIntent, resolvedInk, resolvedSignal } from '../test-support.ts';
import { subtract, union, voiceOnlyIntervals } from './activity.ts';
import { resolveTemporalPlan } from './engine.ts';

const iv = (start_ms: number, end_ms: number) => ({ start_ms, end_ms });

describe('intervalles', () => {
  it('union : trie, fusionne ce qui se touche, écarte le vide', () => {
    expect(union([iv(5, 8), iv(0, 2), iv(2, 3), iv(9, 9)])).toEqual([iv(0, 3), iv(5, 8)]);
  });

  it('soustraction exacte, en ms entières', () => {
    expect(subtract([iv(0, 10)], [iv(2, 4), iv(6, 12)])).toEqual([iv(0, 2), iv(4, 6)]);
    expect(subtract([iv(0, 10)], [])).toEqual([iv(0, 10)]);
    expect(subtract([iv(0, 10)], [iv(-5, 20)])).toEqual([]);
  });
});

describe('annotation « voix seule » (pas une phase)', () => {
  const signal = resolvedSignal();
  const spec = mustBuild(signal, readFilmIntent());
  const plan = resolveTemporalPlan({ spec, style: signal.style, registry: BEHAVIORS });

  it('signale la parole qui continue sans aucun comportement visuel actif', () => {
    const scene = plan.scenes[1]!;
    expect(scene.voice_only.length).toBeGreaterThan(0);
    for (const interval of scene.voice_only) {
      // Dans la parole…
      expect(scene.speech.some((s) => s.start_ms <= interval.start_ms && interval.end_ms <= s.end_ms)).toBe(true);
      // …et hors de tout comportement visuel.
      for (const b of scene.behaviors) expect(interval.end_ms <= b.start_ms || interval.start_ms >= b.end_ms).toBe(true);
    }
  });

  it('ne crée aucune phase et ne déplace aucun instant', () => {
    for (const scene of plan.scenes) {
      expect(scene.phases.map((p) => p.phase)).not.toContain('VOICE');
      expect(voiceOnlyIntervals(scene.speech, scene.behaviors)).toEqual(scene.voice_only);
    }
  });

  it('est portée par le Render Plan en frames, depuis le temps absolu', () => {
    const { plan: rendered, temporal } = mustCompile(spec, signal);
    for (const [i, scene] of rendered.scenes.entries()) {
      const expected = temporal.scenes[i]!.voice_only
        .map((v) => ({ from: Math.round((v.start_ms * 30) / 1000), to: Math.round((v.end_ms * 30) / 1000) }))
        .filter((v) => v.to > v.from);
      expect(scene.voice_only).toEqual(expected);
    }
    expect(rendered.scenes[1]!.voice_only.length).toBeGreaterThan(0);
  });

  it('sans parole, aucune annotation', () => {
    const ink = resolvedInk();
    const silent = mustBuild(ink);
    for (const scene of silent.scenes) {
      scene.timing.anchor = { duration: { beats: 9 } };
      for (const layer of scene.layers) for (const b of layer.behaviors) if ('voice_word' in b.at) b.at = { after_previous: true };
    }
    const p = resolveTemporalPlan({ spec: silent, style: ink.style, registry: BEHAVIORS });
    expect(p.scenes.every((s) => s.voice_only.length === 0)).toBe(true);
  });
});
