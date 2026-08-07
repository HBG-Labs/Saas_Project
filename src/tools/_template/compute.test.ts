import { describe, expect, it } from 'vitest';

import { computeExample } from './compute';

/**
 * Démonstration de l'exigence §16 : la logique d'un outil se teste sans monter
 * le moindre composant React ni environnement DOM.
 */
describe('computeExample', () => {
  it('multiplie la valeur par le facteur', () => {
    expect(computeExample({ value: 6, factor: 7 })).toEqual({ product: 42 });
  });

  it('rejette les entrées non finies', () => {
    expect(() => computeExample({ value: Number.NaN, factor: 2 })).toThrow(RangeError);
    expect(() => computeExample({ value: 1, factor: Number.POSITIVE_INFINITY })).toThrow(
      RangeError,
    );
  });
});
