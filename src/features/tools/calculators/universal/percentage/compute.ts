export type PercentageMode =
  | 'percent_of'
  | 'evolution'
  | 'subtract_percent'
  | 'add_percent'
  | 'part_of_total';

/**
 * Calcule X % d'une valeur Y
 * Ex: 20% de 500 = 100
 */
export function computePercentOf(percent: number, value: number) {
  if (isNaN(percent) || isNaN(value)) return { result: 0, formatted: '0' };
  const result = (percent / 100) * value;
  return { result, formatted: formatPercentageNumber(result) };
}

/**
 * Calcule le % d'évolution entre une valeur initiale et finale
 * Ex: 100 -> 125 = +25%
 */
export function computeEvolution(initial: number, final: number) {
  if (isNaN(initial) || isNaN(final) || initial === 0) {
    return { percentChange: 0, formatted: '0 %', difference: 0, isIncrease: true };
  }
  const difference = final - initial;
  const percentChange = (difference / Math.abs(initial)) * 100;
  const sign = percentChange > 0 ? '+' : '';
  return {
    percentChange,
    formatted: `${sign}${formatPercentageNumber(percentChange)} %`,
    difference,
    formattedDiff: `${sign}${formatPercentageNumber(difference)}`,
    isIncrease: difference >= 0,
  };
}

/**
 * Déduit X % d'une valeur (Remise / Réduction)
 * Ex: 500 - 20% = 400 (Remise = 100)
 */
export function computeSubtractPercent(value: number, percent: number) {
  if (isNaN(value) || isNaN(percent)) return { finalValue: 0, discount: 0, formattedFinal: '0', formattedDiscount: '0' };
  const discount = (percent / 100) * value;
  const finalValue = value - discount;
  return {
    finalValue,
    discount,
    formattedFinal: formatPercentageNumber(finalValue),
    formattedDiscount: formatPercentageNumber(discount),
  };
}

/**
 * Ajoute X % à une valeur (Majoration / TVA)
 * Ex: 500 + 20% = 600 (Majoration = 100)
 */
export function computeAddPercent(value: number, percent: number) {
  if (isNaN(value) || isNaN(percent)) return { finalValue: 0, increase: 0, formattedFinal: '0', formattedIncrease: '0' };
  const increase = (percent / 100) * value;
  const finalValue = value + increase;
  return {
    finalValue,
    increase,
    formattedFinal: formatPercentageNumber(finalValue),
    formattedIncrease: formatPercentageNumber(increase),
  };
}

/**
 * Calcule la part en % d'une valeur par rapport à un total
 * Ex: 25 sur 200 = 12.5 %
 */
export function computePartOfTotal(part: number, total: number) {
  if (isNaN(part) || isNaN(total) || total === 0) {
    return { percent: 0, formatted: '0 %' };
  }
  const percent = (part / total) * 100;
  return {
    percent,
    formatted: `${formatPercentageNumber(percent)} %`,
  };
}

function formatPercentageNumber(val: number): string {
  if (val === 0) return '0';
  const rounded = Number(val.toFixed(2));
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}
