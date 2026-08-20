export type PressureUnit = 'pa' | 'kpa' | 'bar' | 'mbar' | 'psi' | 'atm' | 'mh2o';

export const PRESSURE_UNITS: Record<PressureUnit, { name: string; symbol: string; toPa: number }> = {
  pa: { name: 'Pascal', symbol: 'Pa', toPa: 1 },
  kpa: { name: 'Kilopascal', symbol: 'kPa', toPa: 1000 },
  bar: { name: 'Bar', symbol: 'bar', toPa: 100_000 },
  mbar: { name: 'Millibar', symbol: 'mbar', toPa: 100 },
  psi: { name: 'PSI (Pound/sq inch)', symbol: 'PSI', toPa: 6894.757 },
  atm: { name: 'Atmosphère standard', symbol: 'atm', toPa: 101325 },
  mh2o: { name: "Mètre de colonne d'eau", symbol: 'mH₂O', toPa: 9806.65 },
};

/**
 * Calcul des conversions de pression
 */
export function computePressureConversions(value: number, unit: PressureUnit = 'bar') {
  if (isNaN(value)) {
    return {
      valueInPa: 0,
      conversions: [],
    };
  }

  const valueInPa = value * PRESSURE_UNITS[unit].toPa;

  const conversions = Object.entries(PRESSURE_UNITS).map(([k, u]) => {
    const val = valueInPa / u.toPa;
    return {
      unit: k as PressureUnit,
      name: u.name,
      symbol: u.symbol,
      value: val,
      formatted: formatPressureNumber(val),
    };
  });

  return {
    valueInPa,
    conversions,
  };
}

function formatPressureNumber(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) >= 1_000_000 || (Math.abs(val) < 0.001 && Math.abs(val) > 0)) {
    return val.toExponential(3).replace('.', ',');
  }
  const rounded = Number(val.toFixed(4));
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 4 });
}
