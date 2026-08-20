export type WeightUnit = 'g' | 'kg' | 't' | 'lb' | 'oz';

export const WEIGHT_UNITS: Record<WeightUnit, { name: string; symbol: string; toKg: number }> = {
  g: { name: 'Gramme', symbol: 'g', toKg: 0.001 },
  kg: { name: 'Kilogramme', symbol: 'kg', toKg: 1 },
  t: { name: 'Tonne', symbol: 't', toKg: 1000 },
  lb: { name: 'Livre (pound)', symbol: 'lb', toKg: 0.45359237 },
  oz: { name: 'Once (ounce)', symbol: 'oz', toKg: 0.0283495 },
};

/**
 * Calcul du poids total = Quantité × Poids unitaire
 */
export function computeTotalWeight(
  quantity: number,
  unitWeight: number,
  unit: WeightUnit = 'kg',
) {
  if (isNaN(quantity) || isNaN(unitWeight) || quantity < 0 || unitWeight < 0) {
    return {
      totalWeight: 0,
      formattedTotal: '0',
      unit,
      conversions: [],
    };
  }

  const totalInSelectedUnit = quantity * unitWeight;
  const totalInKg = totalInSelectedUnit * WEIGHT_UNITS[unit].toKg;

  const conversions = Object.entries(WEIGHT_UNITS).map(([k, u]) => {
    const val = totalInKg / u.toKg;
    return {
      unit: k as WeightUnit,
      name: u.name,
      symbol: u.symbol,
      value: val,
      formatted: formatWeightNumber(val),
    };
  });

  return {
    totalWeight: totalInSelectedUnit,
    formattedTotal: formatWeightNumber(totalInSelectedUnit),
    totalInKg,
    formattedKg: formatWeightNumber(totalInKg),
    unit,
    conversions,
  };
}

function formatWeightNumber(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) >= 1_000_000 || (Math.abs(val) < 0.001 && Math.abs(val) > 0)) {
    return val.toExponential(3).replace('.', ',');
  }
  const rounded = Number(val.toFixed(3));
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}
