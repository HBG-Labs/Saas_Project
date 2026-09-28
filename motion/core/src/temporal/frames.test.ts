import { describe, expect, it } from 'vitest';

import { FrameError, msToFrame, toSceneFrames } from './frames.ts';

describe('conversion millisecondes → frames', () => {
  it('arrondit au plus proche, sur des entiers', () => {
    expect(msToFrame(0, 30)).toBe(0);
    expect(msToFrame(1000, 30)).toBe(30);
    expect(msToFrame(16, 30)).toBe(0);
    expect(msToFrame(17, 30)).toBe(1);
    expect(msToFrame(1000, 24)).toBe(24);
    expect(msToFrame(41, 24)).toBe(1);
  });

  it('aucune dérive : des bornes calculées depuis le temps absolu ne s’écartent jamais de plus d’une demi-frame', () => {
    // 200 scènes de 1 234 ms : la somme des durées arrondies dériverait ;
    // la conversion du temps absolu, jamais.
    let driftBySum = 0;
    let absolute = 0;
    for (let i = 1; i <= 200; i++) {
      absolute = i * 1234;
      driftBySum += msToFrame(1234, 30);
      const exact = (absolute * 30) / 1000;
      expect(Math.abs(msToFrame(absolute, 30) - exact)).toBeLessThanOrEqual(0.5);
    }
    expect(Math.abs(driftBySum - (absolute * 30) / 1000)).toBeGreaterThan(1);
  });

  it('les clés d’une scène sont strictement croissantes et restent dans [from, to)', () => {
    expect(toSceneFrames([0, 10, 20, 1000], 30, 0, 60)).toEqual([0, 1, 2, 30]);
    expect(toSceneFrames([5000], 30, 0, 60)).toEqual([59]);
  });

  it('refuse une scène trop courte pour ses clés, au lieu de les écraser', () => {
    expect(() => toSceneFrames([0, 1, 2, 3], 30, 0, 3)).toThrowError(FrameError);
  });
});
