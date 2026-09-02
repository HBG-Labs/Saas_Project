import type { ColorStandard, FiberColorCodeArgs, ModuleType } from './schema';

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
  moduleType: ModuleType;
  fibersPerTube: number;
  tubeNumber: number;
  fiberIndexInTube: number; // 1 à 6 en Modulo 6, 1 à 12 en Modulo 12
  tubeColor: ColorDef;
  fiberColor: ColorDef;
  ringAnnotation: string | null;
  totalTubesInCable: number;
}

// 12 Couleurs Norme France Télécom / Orange (FTTH)
export const ORANGE_FT_COLORS: ColorDef[] = [
  { code: 'RG', name: 'Rouge', hex: '#EF4444', textColor: 'black' },
  { code: 'BL', name: 'Bleu', hex: '#3B82F6', textColor: 'black' },
  { code: 'VE', name: 'Vert', hex: '#22C55E', textColor: 'black' },
  { code: 'JA', name: 'Jaune', hex: '#EAB308', textColor: 'black' },
  { code: 'VI', name: 'Violet', hex: '#A855F7', textColor: 'black' },
  { code: 'BC', name: 'Blanc', hex: '#FFFFFF', textColor: 'black', borderColor: '#CBD5E1' },
  { code: 'OR', name: 'Orange', hex: '#F97316', textColor: 'black' },
  { code: 'GR', name: 'Gris', hex: '#64748B', textColor: 'white' },
  { code: 'MA', name: 'Marron', hex: '#9A3412', textColor: 'white' },
  { code: 'NR', name: 'Noir', hex: '#1E293B', textColor: 'white', borderColor: '#475569' },
  { code: 'TQ', name: 'Turquoise', hex: '#06B6D4', textColor: 'black' },
  { code: 'RS', name: 'Rose', hex: '#EC4899', textColor: 'black' },
];

// 12 Couleurs Norme FOTAG (IEEE 802.8)
export const FOTAG_COLORS: ColorDef[] = [
  { code: 'BL', name: 'Bleu', hex: '#3B82F6', textColor: 'black' },
  { code: 'OR', name: 'Orange', hex: '#F97316', textColor: 'black' },
  { code: 'VE', name: 'Vert', hex: '#22C55E', textColor: 'black' },
  { code: 'MA', name: 'Marron', hex: '#9A3412', textColor: 'white' },
  { code: 'GR', name: 'Gris', hex: '#64748B', textColor: 'white' },
  { code: 'BC', name: 'Blanc', hex: '#FFFFFF', textColor: 'black', borderColor: '#CBD5E1' },
  { code: 'RG', name: 'Rouge', hex: '#EF4444', textColor: 'black' },
  { code: 'NR', name: 'Noir', hex: '#1E293B', textColor: 'white', borderColor: '#475569' },
  { code: 'JA', name: 'Jaune', hex: '#EAB308', textColor: 'black' },
  { code: 'VI', name: 'Violet', hex: '#A855F7', textColor: 'black' },
  { code: 'RS', name: 'Rose', hex: '#EC4899', textColor: 'black' },
  { code: 'TQ', name: 'Turquoise', hex: '#06B6D4', textColor: 'black' },
];

export function getPaletteByStandard(standard: ColorStandard): ColorDef[] {
  switch (standard) {
    case 'fotag':
      return FOTAG_COLORS;
    case 'orange_ft':
    default:
      return ORANGE_FT_COLORS;
  }
}

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
      return 'France Télécom / Orange';
    case 'fotag':
      return 'FOTAG (IEEE 802.8)';
  }
}

export function computeFiberMapping(inputs: FiberColorCodeArgs): FiberMappingResult {
  const { fiberNumber, standard = 'orange_ft', capacity = 144, moduleType = 12 } = inputs;
  const fullPalette = getPaletteByStandard(standard);

  // En Modulo 6, la palette se limite aux 6 premières couleurs. En Modulo 12, aux 12 couleurs.
  const activePalette = fullPalette.slice(0, moduleType);
  const fibersPerTube = moduleType;

  const tubeIndex = Math.floor((fiberNumber - 1) / fibersPerTube);
  const fiberIndexInTube = ((fiberNumber - 1) % fibersPerTube) + 1; // 1 à 6 en Modulo 6, 1 à 12 en Modulo 12

  const tubeColorDef = colorAt(activePalette, tubeIndex);
  const fiberColorDef = colorAt(activePalette, fiberIndexInTube - 1);

  // Marquage de bague pour les câbles lorsque le nombre de tubes dépasse la taille du modulo
  const ringSeries = Math.floor(tubeIndex / moduleType);
  let ringAnnotation: string | null = null;

  if (ringSeries === 1) {
    ringAnnotation = `1 bague noire (Série ${moduleType + 1}-${moduleType * 2})`;
  } else if (ringSeries === 2) {
    ringAnnotation = `2 bagues noires (Série ${moduleType * 2 + 1}-${moduleType * 3})`;
  } else if (ringSeries >= 3) {
    ringAnnotation = `${ringSeries} bagues (Série ${ringSeries * moduleType + 1}-${(ringSeries + 1) * moduleType})`;
  }

  const totalTubesInCable = Math.ceil(capacity / fibersPerTube);

  return {
    fiberNumber,
    capacity,
    standard,
    standardName: getStandardName(standard),
    moduleType: fibersPerTube,
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
