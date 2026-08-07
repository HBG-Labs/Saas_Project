import { describe, expect, it } from 'vitest';
import { evaluateScientificExpression, factorial } from './compute';

describe('factorial', () => {
  it('calcule la factorielle de 0 et 1', () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(1)).toBe(1);
  });

  it('calcule 5! = 120', () => {
    expect(factorial(5)).toBe(120);
  });
});

describe('evaluateScientificExpression', () => {
  it('ne flashe pas d’erreur en rouge lors de la saisie d’un opérateur pendant la frappe (12 +)', () => {
    const res = evaluateScientificExpression('12 +');
    expect(res.error).toBeNull();
    expect(res.result).toBe(12);
    expect(res.formattedResult).toBe('12');
  });

  it('ne flashe pas d’erreur en rouge lors de la saisie d’une fonction incomplete (sin()', () => {
    const res = evaluateScientificExpression('sin(');
    expect(res.error).toBeNull();
    expect(res.result).toBe(0);
    expect(res.formattedResult).toBe('0');
  });

  it('calcule correctement pendant la frappe de 12 + 5 *', () => {
    const res = evaluateScientificExpression('12 + 5 *');
    expect(res.error).toBeNull();
    expect(res.result).toBe(17);
    expect(res.formattedResult).toBe('17');
  });

  it('calcule sin(90) en mode DEG avec parenthèse non fermée', () => {
    const res = evaluateScientificExpression('sin(90', 'deg');
    expect(res.result).toBe(1);
  });

  it('calcule des fonctions imbriquées sin(cos(0))', () => {
    const res = evaluateScientificExpression('sin(cos(0))', 'deg');
    expect(res.result).toBeCloseTo(0.0174524, 5);
  });

  it('gère la multiplication implicite (2π, 5sin(90))', () => {
    const res1 = evaluateScientificExpression('2π');
    expect(res1.result).toBeCloseTo(Math.PI * 2, 5);

    const res2 = evaluateScientificExpression('5sin(90)', 'deg');
    expect(res2.result).toBe(5);
  });

  it('calcule log(1000) et ln(e)', () => {
    const logRes = evaluateScientificExpression('log(1000)');
    expect(logRes.result).toBe(3);

    const lnRes = evaluateScientificExpression('ln(e)');
    expect(lnRes.result).toBe(1);
  });

  it('calcule une expression avec puissance, pourcentage et factorielle', () => {
    const res = evaluateScientificExpression('2^3 + 5! + 50%');
    expect(res.result).toBe(128.5);
  });

  it('affiche Erreur uniquement en mode strict (pression sur =)', () => {
    const res = evaluateScientificExpression('12 + * 5', 'deg', true);
    expect(res.result).toBeNull();
    expect(res.formattedResult).toBe('Erreur');
    expect(res.error).not.toBeNull();
  });
});
