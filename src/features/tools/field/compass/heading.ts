export function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

/** Cap du bord supérieur de l'écran à partir de l'alpha absolu W3C. */
export function headingFromAbsoluteAlpha(alpha: number, screenAngle = 0): number {
  return normalizeHeading(360 - alpha + screenAngle);
}

/** Le cap WebKit pointe déjà vers le nord magnétique, dans le sens horaire. */
export function headingFromWebkitCompass(compassHeading: number, screenAngle = 0): number {
  return normalizeHeading(compassHeading + screenAngle);
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
