import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { CreativeIntent } from '../contracts/creative-intent.ts';
import { hashDocument } from '../integrity/canonical.ts';
import { clone, mustBuild, mustCompile, naturalIntent, resolvedInk, resolvedSignal } from '../test-support.ts';
import { distribute } from './engine.ts';
import { msToFrame, toSceneFrames } from './frames.ts';

// Propriétés vérifiées sur des entrées générées : énergies, sorties, mouvement
// réduit et durées cibles tirées au hasard par fast-check (graine fixe).
const SEED = 20260927;
const styles = { ink: resolvedInk(), signal: resolvedSignal() };

const arbitraryCase = fc.record({
  style: fc.constantFrom<'ink' | 'signal'>('ink', 'signal'),
  energy: fc.constantFrom<CreativeIntent['energy']>('low', 'medium', 'high'),
  fps: fc.constantFrom(24, 25, 30, 60),
  size: fc.constantFrom({ width: 540, height: 960 }, { width: 1080, height: 1920 }, { width: 720, height: 1280 }),
  reducedMotion: fc.boolean(),
});

type Case = typeof arbitraryCase extends fc.Arbitrary<infer T> ? T : never;

function compileCase(c: Case) {
  const intent = clone(naturalIntent());
  intent.energy = c.energy;
  const resolved = styles[c.style];
  return mustCompile(mustBuild(resolved, intent), resolved, { ...c.size, fps: c.fps }, c.reducedMotion);
}

describe('propriétés du moteur temporel (fast-check)', () => {
  it('frames ≥ 0, clés triées, aucune clé hors de sa scène, fin de scène > début', () => {
    fc.assert(
      fc.property(arbitraryCase, (c) => {
        const { plan } = compileCase(c);
        let previousEnd = 0;
        for (const scene of plan.scenes) {
          expect(scene.from).toBe(previousEnd);
          expect(scene.to).toBeGreaterThan(scene.from);
          previousEnd = scene.to;
          for (const track of scene.nodes.flatMap((n) => n.tracks)) {
            for (let i = 0; i < track.keys.length; i++) {
              const frame = track.keys[i]!.frame;
              expect(Number.isInteger(frame) && frame >= 0).toBe(true);
              expect(frame).toBeGreaterThanOrEqual(scene.from);
              expect(frame).toBeLessThan(scene.to);
              if (i > 0) expect(frame).toBeGreaterThan(track.keys[i - 1]!.frame);
            }
          }
        }
        expect(previousEnd).toBe(plan.canvas.duration_frames);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  it('déterministe : deux compilations du même cas donnent le même plan', () => {
    fc.assert(
      fc.property(arbitraryCase, (c) => {
        expect(hashDocument(compileCase(c).plan)).toBe(hashDocument(compileCase(c).plan));
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it('le temps ne dépend ni de la résolution ni du mouvement réduit', () => {
    fc.assert(
      fc.property(arbitraryCase, (c) => {
        const a = compileCase(c).temporal;
        const b = compileCase({ ...c, size: { width: 1080, height: 1920 }, reducedMotion: !c.reducedMotion }).temporal;
        expect(a.total_ms).toBe(b.total_ms);
        expect(a.scenes.map((s) => [s.start_ms, s.end_ms])).toEqual(b.scenes.map((s) => [s.start_ms, s.end_ms]));
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it('distribute : somme exacte, jamais au-delà d’une capacité, entiers positifs', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 8 }), fc.nat(), (caps, seed) => {
        const sum = caps.reduce((a, b) => a + b, 0);
        const total = sum === 0 ? 0 : seed % (sum + 1);
        const parts = distribute(total, caps);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        parts.forEach((p, i) => {
          expect(Number.isInteger(p) && p >= 0).toBe(true);
          expect(p).toBeLessThanOrEqual(caps[i]!);
        });
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it('toSceneFrames : strictement croissant et dans [from, to) dès que la scène a assez de frames', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 20_000 }), { minLength: 1, maxLength: 12 }), fc.constantFrom(24, 25, 30, 60), (ms, fps) => {
        const sorted = [...ms].sort((a, b) => a - b);
        const from = msToFrame(sorted[0]!, fps);
        const to = msToFrame(sorted[sorted.length - 1]!, fps) + sorted.length + 1;
        const frames = toSceneFrames(sorted, fps, from, to);
        frames.forEach((f, i) => {
          expect(f).toBeGreaterThanOrEqual(from);
          expect(f).toBeLessThan(to);
          if (i > 0) expect(f).toBeGreaterThan(frames[i - 1]!);
        });
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});
