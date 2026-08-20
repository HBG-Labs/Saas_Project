export type DistanceUnit = 'mm' | 'cm' | 'm' | 'km' | 'in' | 'ft' | 'yd' | 'mi';

export const DISTANCE_UNITS: Record<DistanceUnit, { name: string; symbol: string; toMeters: number }> = {
  mm: { name: 'Millimètre', symbol: 'mm', toMeters: 0.001 },
  cm: { name: 'Centimètre', symbol: 'cm', toMeters: 0.01 },
  m: { name: 'Mètre', symbol: 'm', toMeters: 1 },
  km: { name: 'Kilomètre', symbol: 'km', toMeters: 1000 },
  in: { name: 'Pouce (in)', symbol: 'in', toMeters: 0.0254 },
  ft: { name: 'Pied (ft)', symbol: 'ft', toMeters: 0.3048 },
  yd: { name: 'Yard (yd)', symbol: 'yd', toMeters: 0.9144 },
  mi: { name: 'Mille terrestre (mi)', symbol: 'mi', toMeters: 1609.344 },
};

/**
 * Calcul d'une distance simple et génération de toutes ses conversions
 */
export function computeDistanceConversions(value: number, unit: DistanceUnit) {
  if (isNaN(value)) {
    return {
      meters: 0,
      conversions: [],
    };
  }

  const meters = value * DISTANCE_UNITS[unit].toMeters;

  const conversions = Object.entries(DISTANCE_UNITS).map(([key, u]) => {
    const converted = meters / u.toMeters;
    return {
      unit: key as DistanceUnit,
      name: u.name,
      symbol: u.symbol,
      value: converted,
      formatted: formatDistanceNumber(converted),
    };
  });

  return {
    meters,
    conversions,
  };
}

/**
 * Calcul de la distance entre deux points 2D
 */
export function compute2DDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  unit: DistanceUnit = 'm',
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distInSelectedUnit = Math.sqrt(dx * dx + dy * dy);

  return {
    distance: distInSelectedUnit,
    formattedDistance: formatDistanceNumber(distInSelectedUnit),
    deltaX: Math.abs(dx),
    deltaY: Math.abs(dy),
    unit,
    conversions: computeDistanceConversions(distInSelectedUnit, unit).conversions,
  };
}

function formatDistanceNumber(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) >= 1_000_000 || (Math.abs(val) < 0.001 && Math.abs(val) > 0)) {
    return val.toExponential(3).replace('.', ',');
  }
  const rounded = Number(val.toFixed(4));
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 4 });
}
