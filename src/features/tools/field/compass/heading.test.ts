import { describe, expect, it } from 'vitest';

import { normalizeHeading, unwrapHeading } from './heading';

describe('normalizeHeading', () => {
  it('ramène tout angle entre 0° inclus et 360° exclus', () => {
    expect(normalizeHeading(360)).toBe(0);
    expect(normalizeHeading(-1)).toBe(359);
    expect(normalizeHeading(721)).toBe(1);
  });
});

describe('unwrapHeading', () => {
  it('franchit le nord dans le sens horaire sans retour complet', () => {
    expect(unwrapHeading(359, 0)).toBe(360);
    expect(unwrapHeading(360, 1)).toBe(361);
  });

  it('franchit le nord dans le sens antihoraire sans tour complet', () => {
    expect(unwrapHeading(0, 359)).toBe(-1);
    expect(unwrapHeading(-1, 358)).toBe(-2);
  });

  it('conserve le chemin le plus court après plusieurs tours', () => {
    expect(unwrapHeading(725, 355)).toBe(715);
  });
});
