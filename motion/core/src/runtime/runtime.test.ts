import { describe, expect, it } from 'vitest';

import { cubicBezier, evaluateEasing, springResponse } from './easing.ts';
import { mixColor, sampleProperty, sampleTrack } from './sample.ts';

describe('courbes', () => {
  it('une Bézier CSS passe par ses extrémités et reste monotone', () => {
    const f = cubicBezier(0.16, 1, 0.3, 1);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    let previous = 0;
    for (let x = 0.05; x < 1; x += 0.05) {
      const y = f(x);
      expect(y).toBeGreaterThanOrEqual(previous);
      previous = y;
    }
    expect(cubicBezier(0.25, 0.25, 0.75, 0.75)(0.3)).toBeCloseTo(0.3, 5);
  });

  it('un ressort peu amorti dépasse sa cible puis s’y stabilise', () => {
    const soft = { damping: 10, stiffness: 120, mass: 1 };
    const peak = Math.max(...Array.from({ length: 60 }, (_, i) => springResponse(soft, i / 60)));
    expect(peak).toBeGreaterThan(1);
    expect(springResponse(soft, 5)).toBeCloseTo(1, 3);
    expect(springResponse({ damping: 40, stiffness: 100, mass: 1 }, 0.5)).toBeLessThan(1);
  });

  it('toute courbe atteint exactement sa clé suivante', () => {
    for (const easing of [undefined, { type: 'linear' as const }, { type: 'bezier' as const, p: [0.7, 0, 0.84, 0] as [number, number, number, number] }, { type: 'spring' as const, damping: 12, stiffness: 120, mass: 1 }]) {
      expect(evaluateEasing(easing, 0, 0.5)).toBe(0);
      expect(evaluateEasing(easing, 1, 0.5)).toBe(1);
    }
  });
});

describe('échantillonnage des pistes', () => {
  const track = { keys: [{ frame: 10, value: 0 }, { frame: 20, value: 100 }] };

  it('tient la première et la dernière valeur hors de l’intervalle', () => {
    expect(sampleTrack(track, 0, 30)).toBe(0);
    expect(sampleTrack(track, 25, 30)).toBe(100);
    expect(sampleTrack(track, 15, 30)).toBe(50);
  });

  it('interpole les couleurs canal par canal', () => {
    expect(mixColor('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(sampleTrack({ keys: [{ frame: 0, value: '#FF0000' }, { frame: 10, value: '#0000FF' }] }, 10, 30)).toBe('#0000FF');
  });

  it('trouve la piste de la bonne cible, sinon la valeur par défaut', () => {
    const tracks = [
      { property: 'opacity' as const, target: { line: 1 }, keys: [{ frame: 0, value: 0.25 }], source: 'bh' },
      { property: 'color' as const, target: { run: 'r1' }, keys: [{ frame: 0, value: '#123456' }], source: 'bh' },
    ];
    expect(sampleProperty(tracks, 'opacity', { line: 1 }, 5, 30, 1)).toBe(0.25);
    expect(sampleProperty(tracks, 'opacity', { line: 0 }, 5, 30, 1)).toBe(1);
    expect(sampleProperty(tracks, 'color', { run: 'r1' }, 5, 30, '#000000')).toBe('#123456');
  });
});
