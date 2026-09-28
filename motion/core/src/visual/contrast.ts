import type { PlanImageTreatment } from '../contracts/render-plan.ts';

/**
 * P1.5 — Visual Integrity & Image Motion : lisibilité mesurée.
 *
 * Planchers TECHNIQUES de lisibilité (WCAG 2.x) : 3:1 pour le grand texte,
 * 4.5:1 pour le texte courant. Un style peut les relever, jamais les abaisser.
 * Ce ne sont pas des critères de qualité créative : un texte « techniquement
 * lisible » n'est pas pour autant un contraste de qualité agence.
 */
export const READABILITY_RULES_VERSION = '1.0.0';
export const CONTRAST_FLOORS = { large: 3, normal: 4.5 } as const;

/**
 * Catégorie « grand texte » (WCAG : ≥ 24 px CSS, ou ≥ 18,66 px CSS en gras),
 * rapportée à un téléphone de référence de 390 px CSS de large affichant la
 * vidéo plein écran : 1 px de sortie = 390 / largeur de sortie px CSS.
 */
export const PHONE_CSS_WIDTH = 390;
export const LARGE_CSS_PX = 24;
export const LARGE_BOLD_CSS_PX = 18.66;

export type TextCategory = 'large' | 'normal';

export function textCategory(sizePx: number, weight: number, canvasWidth: number): TextCategory {
  const css = (sizePx * PHONE_CSS_WIDTH) / canvasWidth;
  return css >= LARGE_CSS_PX || (weight >= 700 && css >= LARGE_BOLD_CSS_PX) ? 'large' : 'normal';
}

/** Canal sRGB (0..1) → linéaire (IEC 61966-2-1). */
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Luminance relative WCAG d'une couleur sRGB (0..1). */
export function relativeLuminanceRgb(r: number, g: number, b: number): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastOfLuminances(l1: number, l2: number): number {
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 0xff) / 255, ((v >> 8) & 0xff) / 255, (v & 0xff) / 255];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Modèle du traitement tel que le renderer l'applique (filtre CSS
 * « grayscale(g) contrast(c) » puis voile), sur une couleur NON prémultipliée.
 * Espace de calcul : sRGB — hypothèse vérifiée contre le rendu réel de
 * Chromium par le test de rendu P1.5 (et non supposée).
 */
export function applyTreatment(rgb: readonly [number, number, number], t: PlanImageTreatment): [number, number, number] {
  const [r, g, b] = rgb;
  const s = 1 - t.grayscale;
  // Matrice grayscale de Filter Effects 1, chaque fonction bornée à [0, 1].
  const gr = clamp01((0.2126 + 0.7874 * s) * r + (0.7152 - 0.7152 * s) * g + (0.0722 - 0.0722 * s) * b);
  const gg = clamp01((0.2126 - 0.2126 * s) * r + (0.7152 + 0.2848 * s) * g + (0.0722 - 0.0722 * s) * b);
  const gb = clamp01((0.2126 - 0.2126 * s) * r + (0.7152 - 0.7152 * s) * g + (0.0722 + 0.9278 * s) * b);
  const k = t.contrast;
  let out: [number, number, number] = [clamp01((gr - 0.5) * k + 0.5), clamp01((gg - 0.5) * k + 0.5), clamp01((gb - 0.5) * k + 0.5)];
  if (t.tint) {
    const [tr, tg, tb] = hexToRgb(t.tint.color);
    const a = t.tint.opacity;
    out = [tr * a + out[0] * (1 - a), tg * a + out[1] * (1 - a), tb * a + out[2] * (1 - a)];
  }
  return out;
}

/** Quantile par rang (sans interpolation) : déterministe, jamais une valeur inventée. */
export function quantile(sortedAscending: readonly number[], q: number): number {
  if (sortedAscending.length === 0) throw new Error('quantile d’un ensemble vide');
  return sortedAscending[Math.floor(q * (sortedAscending.length - 1))]!;
}
