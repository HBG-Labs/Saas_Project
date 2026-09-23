export function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

/**
 * Prolonge un cap normalisé sur un axe continu.
 *
 * Sans ce dépliage, une animation CSS interprète 359° → 0° comme un retour
 * de 359° et fait presque un tour complet. Ici, le même passage devient
 * 359° → 360°, soit le déplacement réel d'un seul degré.
 */
export function unwrapHeading(previous: number, next: number): number {
  const previousNormalized = normalizeHeading(previous);
  const nextNormalized = normalizeHeading(next);
  const shortestDelta = ((nextNormalized - previousNormalized + 540) % 360) - 180;
  return previous + shortestDelta;
}
