export type RatioMode = 'rule_of_three' | 'simplify_ratio' | 'proportional_split';

/**
 * Calcul du plus grand commun diviseur (PGCD)
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/**
 * Règle de 3 directe : Si A -> B, alors C -> D = (B * C) / A
 */
export function computeRuleOfThree(a: number, b: number, c: number) {
  if (a === 0 || isNaN(a) || isNaN(b) || isNaN(c)) {
    return {
      d: 0,
      formattedD: '0',
      multiplier: 0,
      isValid: false,
    };
  }

  const d = (b * c) / a;
  const multiplier = b / a;

  return {
    d,
    formattedD: formatRatioNumber(d),
    multiplier,
    isValid: true,
  };
}

/**
 * Simplification de ratio A : B (ex: 100 : 50 -> 2 : 1)
 */
export function simplifyRatio(a: number, b: number) {
  if (a <= 0 || b <= 0 || isNaN(a) || isNaN(b)) {
    return {
      simplifiedA: 0,
      simplifiedB: 0,
      formatted: '1 : 1',
      decimal: 1,
    };
  }

  const divisor = gcd(a, b);
  const simplifiedA = a / divisor;
  const simplifiedB = b / divisor;
  const decimal = a / b;

  return {
    simplifiedA,
    simplifiedB,
    formatted: `${simplifiedA} : ${simplifiedB}`,
    decimal,
    formattedDecimal: formatRatioNumber(decimal),
  };
}

/**
 * Répartition d'une somme totale selon un ratio à plusieurs parts (ex: 1000 selon 2:3:5)
 */
export function computeProportionalSplit(total: number, parts: number[]) {
  const sumOfParts = parts.reduce((sum, p) => sum + (isNaN(p) || p < 0 ? 0 : p), 0);

  if (sumOfParts === 0 || isNaN(total)) {
    return {
      shares: parts.map(() => 0),
      formattedShares: parts.map(() => '0'),
      sumOfParts: 0,
    };
  }

  const shares = parts.map((p) => (p / sumOfParts) * total);
  const formattedShares = shares.map((s) => formatRatioNumber(s));

  return {
    shares,
    formattedShares,
    sumOfParts,
  };
}

function formatRatioNumber(val: number): string {
  if (val === 0) return '0';
  if (Math.abs(val) >= 1_000_000 || (Math.abs(val) < 0.001 && Math.abs(val) > 0)) {
    return val.toExponential(3).replace('.', ',');
  }
  const rounded = Number(val.toFixed(2));
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}
