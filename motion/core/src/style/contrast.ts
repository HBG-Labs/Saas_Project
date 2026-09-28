import { contrastOfLuminances, hexToRgb, relativeLuminanceRgb } from '../visual/contrast.ts';

// API « palette » (couleurs #RRGGBB) : délègue à l'implémentation unique de
// visual/contrast.ts (P1.5), aussi utilisée pour les pixels mesurés. Pour des
// couleurs 8 bits, le seuil de linéarisation 0,03928 (ancienne version) et
// 0,04045 (IEC 61966-2-1) donnent exactement le même résultat : aucune valeur
// 8 bits ne tombe entre les deux (10/255 = 0,0392 ; 11/255 = 0,0431).

/** Luminance relative WCAG 2.x d'une couleur #RRGGBB. */
export function relativeLuminance(hex: string): number {
  return relativeLuminanceRgb(...hexToRgb(hex));
}

/** Ratio de contraste WCAG entre deux couleurs, de 1 à 21. */
export function contrastRatio(a: string, b: string): number {
  return contrastOfLuminances(relativeLuminance(a), relativeLuminance(b));
}
