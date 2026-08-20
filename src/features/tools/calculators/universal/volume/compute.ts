export type VolumeShape = 'cuboid' | 'cylinder' | 'sphere' | 'cone';

export type VolumeUnit = 'm3' | 'l' | 'ml' | 'cm3' | 'gal_us';

export const VOLUME_UNITS: Record<VolumeUnit, { name: string; symbol: string; toM3: number }> = {
  m3: { name: 'Mètre cube', symbol: 'm³', toM3: 1 },
  l: { name: 'Litre', symbol: 'L', toM3: 0.001 },
  ml: { name: 'Millilitre', symbol: 'mL', toM3: 0.000001 },
  cm3: { name: 'Centimètre cube', symbol: 'cm³', toM3: 0.000001 },
  gal_us: { name: 'Gallon US', symbol: 'gal', toM3: 0.00378541 },
};

export interface VolumeParams {
  shape: VolumeShape;
  length?: number;
  width?: number;
  height?: number;
  radius?: number;
  inputUnit?: 'm' | 'cm' | 'mm';
}

export function computeVolume(params: VolumeParams) {
  const unitFactor = params.inputUnit === 'mm' ? 0.001 : params.inputUnit === 'cm' ? 0.01 : 1;
  let volumeInM3 = 0;
  let formula = '';

  const l = (params.length ?? 0) * unitFactor;
  const w = (params.width ?? 0) * unitFactor;
  const h = (params.height ?? 0) * unitFactor;
  const r = (params.radius ?? 0) * unitFactor;

  if (
    (params.length !== undefined && params.length <= 0) ||
    (params.width !== undefined && params.width <= 0) ||
    (params.height !== undefined && params.height <= 0) ||
    (params.radius !== undefined && params.radius <= 0)
  ) {
    volumeInM3 = 0;
  } else {
    switch (params.shape) {
      case 'cuboid': {
        volumeInM3 = Math.max(0, l * w * h);
        formula = `Longueur (${params.length}) × Largeur (${params.width}) × Hauteur (${params.height})`;
        break;
      }
      case 'cylinder': {
        volumeInM3 = Math.max(0, Math.PI * r * r * h);
        formula = `π × Rayon (${params.radius})² × Hauteur (${params.height})`;
        break;
      }
      case 'sphere': {
        volumeInM3 = Math.max(0, (4 / 3) * Math.PI * Math.pow(r, 3));
        formula = `(4/3) × π × Rayon (${params.radius})³`;
        break;
      }
      case 'cone': {
        volumeInM3 = Math.max(0, (1 / 3) * Math.PI * r * r * h);
        formula = `(1/3) × π × Rayon (${params.radius})² × Hauteur (${params.height})`;
        break;
      }
    }
  }

  const liters = volumeInM3 * 1000;

  const conversions = Object.entries(VOLUME_UNITS).map(([key, u]) => {
    const val = volumeInM3 / u.toM3;
    return {
      unit: key as VolumeUnit,
      name: u.name,
      symbol: u.symbol,
      value: val,
      formatted: formatVolumeNumber(val),
    };
  });

  return {
    volumeInM3,
    formattedM3: formatVolumeNumber(volumeInM3),
    liters,
    formattedLiters: formatVolumeNumber(liters),
    formula,
    conversions,
  };
}

function formatVolumeNumber(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) >= 1_000_000 || (Math.abs(val) < 0.0001 && Math.abs(val) > 0)) {
    return val.toExponential(3).replace('.', ',');
  }
  const rounded = Number(val.toFixed(4));
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 4 });
}
