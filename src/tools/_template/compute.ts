/**
 * Logique de calcul de l'outil.
 *
 * CE FICHIER DOIT RESTER PUR : pas de React, pas d'appel réseau, pas d'accès au
 * DOM. C'est ce qui permet de tester un outil indépendamment de son interface
 * (une règle ESLint interdit ici les imports de `react`, `react-router`,
 * `@/services/*` et `@/features/*`).
 *
 * Remplacez `computeExample` par le calcul réel de votre outil.
 */

export interface ExampleInput {
  value: number;
  factor: number;
}

export interface ExampleResult {
  product: number;
}

export function computeExample({ value, factor }: ExampleInput): ExampleResult {
  if (!Number.isFinite(value) || !Number.isFinite(factor)) {
    throw new RangeError('Les entrées doivent être des nombres finis.');
  }

  return { product: value * factor };
}
