import type { ColorStandard, FiberColorCodeInputs } from './schema';

export interface ColorDef {
  code: string;
  name: string;
  hex: string;
  textColor: 'white' | 'black';
  borderColor?: string;
}

export interface FiberMappingResult {
  fiberNumber: number;
  capacity: number;
  standard: ColorStandard;
  standardName: string;
  fibersPerTube: number;
  tubeNumber: number;
  fiberIndexInTube: number; // 1-indexed (1 à 12)
  tubeColor: ColorDef;
  fiberColor: ColorDef;
  ringAnnotation: string | null; // e.g. "Bague Noire (Série 2)" pour tube > 12
  totalTubesInCable: number;
}

// 12 Couleurs Norme France Télécom / Orange (FTTH)
export const ORANGE_FT_COLORS: ColorDef[] = [
  { code: 'RG', name: 'Rouge', hex: '#EF4444', textColor: 'white' },
  { code: 'BL', name: 'Bleu', hex: '#3B82F6', textColor: 'white' },
  { code: 'VE', name: 'Vert', hex: '#22C55E', textColor: 'white' },
  { code: 'JA', name: 'Jaune', hex: '#EAB308', textColor: 'black' },
  { code: 'VI', name: 'Violet', hex: '#A855F7', textColor: 'white' },
  { code: 'BC', name: 'Blanc', hex: '#FFFFFF', textColor: 'black', borderColor: '#CBD5E1' },
  { code: 'OR', name: 'Orange', hex: '#F97316', textColor: 'white' },
  { code: 'GR', name: 'Gris', hex: '#64748B', textColor: 'white' },
  { code: 'MA', name: 'Marron', hex: '#9A3412', textColor: 'white' },
  { code: 'NR', name: 'Noir', hex: '#1E293B', textColor: 'white', borderColor: '#475569' },
  { code: 'TQ', name: 'Turquoise', hex: '#06B6D4', textColor: 'black' },
  { code: 'RS', name: 'Rose', hex: '#EC4899', textColor: 'white' },
];

// 12 Couleurs Norme TIA/EIA-598-C (International)
export const TIA_598_COLORS: ColorDef[] = [
  { code: 'BL', name: 'Bleu', hex: '#3B82F6', textColor: 'white' },
  { code: 'OR', name: 'Orange', hex: '#F97316', textColor: 'white' },
  { code: 'VE', name: 'Vert', hex: '#22C55E', textColor: 'white' },
  { code: 'MA', name: 'Marron', hex: '#9A3412', textColor: 'white' },
  { code: 'GR', name: 'Gris', hex: '#64748B', textColor: 'white' },
  { code: 'BC', name: 'Blanc', hex: '#FFFFFF', textColor: 'black', borderColor: '#CBD5E1' },
  { code: 'RG', name: 'Rouge', hex: '#EF4444', textColor: 'white' },
  { code: 'NR', name: 'Noir', hex: '#1E293B', textColor: 'white', borderColor: '#475569' },
  { code: 'JA', name: 'Jaune', hex: '#EAB308', textColor: 'black' },
  { code: 'VI', name: 'Violet', hex: '#A855F7', textColor: 'white' },
  { code: 'RS', name: 'Rose', hex: '#EC4899', textColor: 'white' },
  { code: 'AQ', name: 'Aqua', hex: '#06B6D4', textColor: 'black' },
];

// 12 Couleurs Norme DIN VDE 0888 (Europe / Allemagne)
export const DIN_0888_COLORS: ColorDef[] = [
  { code: 'RG', name: 'Rouge', hex: '#EF4444', textColor: 'white' },
  { code: 'VE', name: 'Vert', hex: '#22C55E', textColor: 'white' },
  { code: 'BL', name: 'Bleu', hex: '#3B82F6', textColor: 'white' },
  { code: 'JA', name: 'Jaune', hex: '#EAB308', textColor: 'black' },
  { code: 'BC', name: 'Blanc', hex: '#FFFFFF', textColor: 'black', borderColor: '#CBD5E1' },
  { code: 'GR', name: 'Gris', hex: '#64748B', textColor: 'white' },
  { code: 'MA', name: 'Marron', hex: '#9A3412', textColor: 'white' },
  { code: 'VI', name: 'Violet', hex: '#A855F7', textColor: 'white' },
  { code: 'TQ', name: 'Turquoise', hex: '#06B6D4', textColor: 'black' },
  { code: 'NR', name: 'Noir', hex: '#1E293B', textColor: 'white', borderColor: '#475569' },
  { code: 'OR', name: 'Orange', hex: '#F97316', textColor: 'white' },
  { code: 'RS', name: 'Rose', hex: '#EC4899', textColor: 'white' },
];

export function getPaletteByStandard(standard: ColorStandard): ColorDef[] {
  switch (standard) {
    case 'tia_598':
      return TIA_598_COLORS;
    case 'din_0888':
      return DIN_0888_COLORS;
    case 'orange_ft':
    default:
      return ORANGE_FT_COLORS;
  }
}

/**
 * Accès cyclique à une palette.
 *
 * Les trois palettes comptent exactement douze entrées et l'index est toujours
 * ramené par modulo : l'accès ne peut pas sortir des bornes. `noUncheckedIndexedAccess`
 * ne sachant pas le démontrer, on préfère un garde-fou explicite à une assertion
 * `!` — sur un outil utilisé pour repérer une fibre en armoire, une palette
 * incomplète doit échouer bruyamment plutôt que produire une couleur `undefined`.
 */
function colorAt(palette: ColorDef[], index: number): ColorDef {
  const size = palette.length;
  const color = size === 0 ? undefined : palette[((index % size) + size) % size];

  if (!color) {
    throw new Error('Palette de couleurs vide : configuration de norme invalide.');
  }

  return color;
}

export function getStandardName(standard: ColorStandard): string {
  switch (standard) {
    case 'orange_ft':
      return 'France Télécom / Orange (FTTH)';
    case 'tia_598':
      return 'TIA/EIA-598-C (International)';
    case 'din_0888':
      return 'DIN VDE 0888 (Europe)';
  }
}

export function computeFiberMapping(inputs: FiberColorCodeInputs): FiberMappingResult {
  const { fiberNumber, standard, capacity } = inputs;
  const palette = getPaletteByStandard(standard);

  // Détermination du nombre de fibres par tube (6 pour petits câbles, 12 par défaut)
  const fibersPerTube = capacity <= 6 ? 6 : 12;

  const tubeIndex = Math.floor((fiberNumber - 1) / fibersPerTube);
  const fiberIndexInTube = ((fiberNumber - 1) % fibersPerTube) + 1; // 1 à 6 ou 1 à 12

  const tubeColorDef = colorAt(palette, tubeIndex);
  const fiberColorDef = colorAt(palette, fiberIndexInTube - 1);

  // Marquage de bague pour les câbles > 144 FO (tubeIndex >= 12)
  const ringSeries = Math.floor(tubeIndex / 12);
  let ringAnnotation: string | null = null;

  if (ringSeries === 1) {
    ringAnnotation = '1 bague noire (Série 13-24)';
  } else if (ringSeries === 2) {
    ringAnnotation = '2 bagues noires (Série 25-36)';
  } else if (ringSeries >= 3) {
    ringAnnotation = `${ringSeries} bagues marquer (Série ${ringSeries * 12 + 1}-${(ringSeries + 1) * 12})`;
  }

  const totalTubesInCable = Math.ceil(capacity / fibersPerTube);

  return {
    fiberNumber,
    capacity,
    standard,
    standardName: getStandardName(standard),
    fibersPerTube,
    tubeNumber: tubeIndex + 1,
    fiberIndexInTube,
    tubeColor: tubeColorDef,
    fiberColor: fiberColorDef,
    ringAnnotation,
    totalTubesInCable,
  };
}

/**
 * Recherche inverse : trouve le numéro de fibre à partir du numéro de tube et de la position dans le tube
 */
export function computeFiberNumberFromTube(
  tubeNumber: number,
  fiberIndexInTube: number,
  fibersPerTube = 12,
): number {
  return (tubeNumber - 1) * fibersPerTube + fiberIndexInTube;
}
