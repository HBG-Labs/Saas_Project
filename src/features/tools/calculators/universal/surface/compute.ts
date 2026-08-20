export type SurfaceShape = 'rectangle' | 'square' | 'circle' | 'triangle' | 'trapezoid';

export type SurfaceUnit = 'm2' | 'cm2' | 'mm2' | 'ha' | 'km2' | 'ft2';

export const SURFACE_UNITS: Record<SurfaceUnit, { name: string; symbol: string; toM2: number }> = {
  mm2: { name: 'Millimètre carré', symbol: 'mm²', toM2: 0.000001 },
  cm2: { name: 'Centimètre carré', symbol: 'cm²', toM2: 0.0001 },
  m2: { name: 'Mètre carré', symbol: 'm²', toM2: 1 },
  ha: { name: 'Hectare', symbol: 'ha', toM2: 10000 },
  km2: { name: 'Kilomètre carré', symbol: 'km²', toM2: 1000000 },
  ft2: { name: 'Pied carré (sq ft)', symbol: 'sq ft', toM2: 0.092903 },
};

export interface SurfaceParams {
  shape: SurfaceShape;
  length?: number;
  width?: number;
  side?: number;
  radius?: number;
  base?: number;
  height?: number;
  base2?: number;
  inputUnit?: 'm' | 'cm' | 'mm';
}

export function computeSurface(params: SurfaceParams) {
  const unitFactor = params.inputUnit === 'mm' ? 0.001 : params.inputUnit === 'cm' ? 0.01 : 1;
  let areaInM2 = 0;
  let perimeterInM = 0;
  let formula = '';

  switch (params.shape) {
    case 'rectangle': {
      const l = (params.length ?? 0) * unitFactor;
      const w = (params.width ?? 0) * unitFactor;
      areaInM2 = Math.max(0, l * w);
      perimeterInM = 2 * (l + w);
      formula = `Longueur (${params.length}) × Largeur (${params.width})`;
      break;
    }
    case 'square': {
      const s = (params.side ?? 0) * unitFactor;
      areaInM2 = Math.max(0, s * s);
      perimeterInM = 4 * s;
      formula = `Côté (${params.side})²`;
      break;
    }
    case 'circle': {
      const r = (params.radius ?? 0) * unitFactor;
      areaInM2 = Math.max(0, Math.PI * r * r);
      perimeterInM = 2 * Math.PI * r;
      formula = `π × Rayon (${params.radius})²`;
      break;
    }
    case 'triangle': {
      const b = (params.base ?? 0) * unitFactor;
      const h = (params.height ?? 0) * unitFactor;
      areaInM2 = Math.max(0, (b * h) / 2);
      formula = `(Base (${params.base}) × Hauteur (${params.height})) / 2`;
      break;
    }
    case 'trapezoid': {
      const a = (params.base ?? 0) * unitFactor;
      const b = (params.base2 ?? 0) * unitFactor;
      const h = (params.height ?? 0) * unitFactor;
      areaInM2 = Math.max(0, ((a + b) * h) / 2);
      formula = `((Petite Base (${params.base}) + Grande Base (${params.base2})) × Hauteur (${params.height})) / 2`;
      break;
    }
  }

  const conversions = Object.entries(SURFACE_UNITS).map(([key, u]) => {
    const val = areaInM2 / u.toM2;
    return {
      unit: key as SurfaceUnit,
      name: u.name,
      symbol: u.symbol,
      value: val,
      formatted: formatSurfaceNumber(val),
    };
  });

  return {
    areaInM2,
    formattedM2: formatSurfaceNumber(areaInM2),
    perimeterInM,
    formattedPerimeterM: formatSurfaceNumber(perimeterInM),
    formula,
    conversions,
  };
}

function formatSurfaceNumber(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) >= 1_000_000 || (Math.abs(val) < 0.0001 && Math.abs(val) > 0)) {
    return val.toExponential(3).replace('.', ',');
  }
  const rounded = Number(val.toFixed(4));
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 4 });
}
