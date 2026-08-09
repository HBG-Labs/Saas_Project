import { describe, expect, it } from 'vitest';

import { evaluateExpression, ExpressionError, type ParserContext } from './parser';

const context: ParserContext = {
  functions: {
    sqrt: (x) => Math.sqrt(x),
    abs: (x) => Math.abs(x),
  },
  constants: { pi: Math.PI, e: Math.E },
};

const evaluate = (input: string) => evaluateExpression(input, context);

describe('priorités et associativité', () => {
  it('respecte la priorité des opérateurs', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('(2 + 3) * 4')).toBe(20);
    expect(evaluate('10 - 2 - 3')).toBe(5);
    expect(evaluate('100 / 10 / 2')).toBe(5);
  });

  it('rend la puissance associative à droite', () => {
    // 2^(3^2) = 2^9 = 512, et non (2^3)^2 = 64.
    expect(evaluate('2 ** 3 ** 2')).toBe(512);
  });

  it('applique le moins unaire APRÈS la puissance', () => {
    // Convention mathématique : -2² = -(2²) = -4.
    // JavaScript, lui, refuse d'interpréter `-2 ** 2`.
    expect(evaluate('-2 ** 2')).toBe(-4);
  });

  it('accepte un exposant négatif', () => {
    expect(evaluate('2 ** -2')).toBe(0.25);
  });

  it('enchaîne les moins unaires', () => {
    expect(evaluate('--5')).toBe(5);
    expect(evaluate('---5')).toBe(-5);
  });
});

describe('nombres, constantes et fonctions', () => {
  it('lit les décimaux, avec ou sans zéro initial', () => {
    expect(evaluate('3.5 + 0.5')).toBe(4);
    expect(evaluate('.5 * 2')).toBe(1);
  });

  it('résout les constantes', () => {
    expect(evaluate('pi')).toBeCloseTo(Math.PI, 10);
    expect(evaluate('e')).toBeCloseTo(Math.E, 10);
  });

  it('applique les fonctions', () => {
    expect(evaluate('sqrt(16)')).toBe(4);
    expect(evaluate('abs(0 - 7)')).toBe(7);
    expect(evaluate('sqrt(sqrt(16))')).toBe(2);
  });

  it('renvoie Infinity sur une division par zéro plutôt que de lever', () => {
    // L'appelant sait déjà présenter ce cas ; lever ici créerait un second
    // chemin d'erreur pour une situation unique.
    expect(evaluate('1 / 0')).toBe(Infinity);
  });
});

describe('ce que la grammaire NE PEUT PAS exprimer', () => {
  /**
   * Le cœur du remplacement de `new Function()`.
   *
   * La sécurité ne vient pas d'un filtrage — toujours contournable — mais de
   * l'incapacité de la machine à exprimer autre chose qu'un calcul. Ces tests
   * échoueraient immédiatement si quelqu'un réintroduisait un évaluateur
   * dynamique.
   */
  it("refuse les identifiants du navigateur, qui n'existent pas dans sa grammaire", () => {
    expect(() => evaluate('fetch')).toThrow(ExpressionError);
    expect(() => evaluate('window')).toThrow(ExpressionError);
    expect(() => evaluate('localStorage')).toThrow(ExpressionError);
    expect(() => evaluate('globalThis')).toThrow(ExpressionError);
    expect(() => evaluate('constructor')).toThrow(ExpressionError);
  });

  it('refuse toute construction de code', () => {
    expect(() => evaluate('alert(1)')).toThrow(ExpressionError);
    expect(() => evaluate('(()=>1)()')).toThrow(ExpressionError);
    expect(() => evaluate('1;2')).toThrow(ExpressionError);
    expect(() => evaluate('a=1')).toThrow(ExpressionError);
  });

  it("refuse l'accès aux propriétés", () => {
    expect(() => evaluate('pi.toString')).toThrow(ExpressionError);
    expect(() => evaluate('[1]')).toThrow(ExpressionError);
    expect(() => evaluate('{}')).toThrow(ExpressionError);
  });

  it('refuse un caractère inconnu plutôt que de l’ignorer', () => {
    // L'ignorer reviendrait à calculer autre chose que ce qui est écrit, et à
    // l'annoncer avec l'aplomb d'un résultat juste.
    expect(() => evaluate('2 § 3')).toThrow(ExpressionError);
    expect(() => evaluate('2 & 3')).toThrow(ExpressionError);
  });
});

describe('expressions malformées', () => {
  it('refuse les parenthèses déséquilibrées', () => {
    expect(() => evaluate('(2 + 3')).toThrow(ExpressionError);
    expect(() => evaluate('2 + 3)')).toThrow(ExpressionError);
  });

  it('refuse une expression incomplète', () => {
    expect(() => evaluate('2 +')).toThrow(ExpressionError);
    expect(() => evaluate('')).toThrow(ExpressionError);
  });

  it('exige une parenthèse après un nom de fonction', () => {
    expect(() => evaluate('sqrt 16')).toThrow(ExpressionError);
  });

  it('refuse deux expressions accolées', () => {
    expect(() => evaluate('2 3')).toThrow(ExpressionError);
  });
});
