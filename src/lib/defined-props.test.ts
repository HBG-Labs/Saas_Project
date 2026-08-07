import { describe, expect, it } from 'vitest';

import { definedProps } from './defined-props';

describe('definedProps', () => {
  it('retire les clés valant undefined', () => {
    const result = definedProps({ a: 1, b: undefined, c: 'x' });

    expect(result).toEqual({ a: 1, c: 'x' });
    // La clé doit être ABSENTE, pas présente avec undefined : c'est toute la
    // distinction qu'impose exactOptionalPropertyTypes.
    expect('b' in result).toBe(false);
  });

  it('conserve les valeurs falsy légitimes', () => {
    // `false`, `0` et `''` sont des valeurs valides : les confondre avec
    // undefined casserait par exemple `disabled={false}`.
    expect(definedProps({ a: false, b: 0, c: '', d: null })).toEqual({
      a: false,
      b: 0,
      c: '',
      d: null,
    });
  });
});
