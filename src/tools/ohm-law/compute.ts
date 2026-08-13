import {
  CURRENT_FACTORS,
  RESISTANCE_FACTORS,
  VOLTAGE_FACTORS,
  type CurrentUnit,
  type ResistanceUnit,
  type TargetVariable,
  type VoltageUnit,
} from './schema';

export interface ComputeOhmLawOptions {
  target: TargetVariable;
  // `| undefined` explicite : sous `exactOptionalPropertyTypes`, un champ
  // simplement optionnel refuse qu'on lui passe `undefined`. Or c'est
  // exactement ce que fait le formulaire pour la grandeur laissée vide.
  voltage?: number | string | null | undefined;
  voltageUnit?: VoltageUnit | undefined;
  current?: number | string | null | undefined;
  currentUnit?: CurrentUnit | undefined;
  resistance?: number | string | null | undefined;
  resistanceUnit?: ResistanceUnit | undefined;
}

export interface OhmLawResult {
  success: boolean;
  value?: number;
  formattedValue?: string;
  unit?: string;
  formulaUsed?: string;
  explanation?: string;
  error?: string;
}

export function convertToSI(value: number, factor: number): number {
  return value * factor;
}

export function convertFromSI(valueSI: number, factor: number): number {
  return valueSI / factor;
}

export function formatNumber(val: number): string {
  if (Math.abs(val) < 1e-6 && val !== 0) {
    return val.toExponential(4);
  }
  // Arrondi propre à max 4 décimales significatives
  const rounded = Number(Math.round(Number(val + 'e4')) + 'e-4');
  return rounded.toLocaleString('fr-FR', { maximumFractionDigits: 4 });
}

export function computeOhmLaw(options: ComputeOhmLawOptions): OhmLawResult {
  const {
    target,
    voltage,
    voltageUnit = 'V',
    current,
    currentUnit = 'A',
    resistance,
    resistanceUnit = 'Ω',
  } = options;

  const parseInput = (val: number | string | undefined | null): number | null => {
    if (val === undefined || val === null || val === '') return null;
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
    if (Number.isNaN(num)) return null;
    return num;
  };

  const rawU = parseInput(voltage);
  const rawI = parseInput(current);
  const rawR = parseInput(resistance);

  // Validation des grandeurs calculées selon la cible
  if (target === 'U') {
    if (rawI === null || rawR === null) {
      return {
        success: false,
        error: 'Veuillez saisir l\'intensité (I) et la résistance (R).',
      };
    }
    if (rawI < 0 || rawR < 0) {
      return {
        success: false,
        error: 'L\'intensité et la résistance doivent être des valeurs positives.',
      };
    }

    const iSI = convertToSI(rawI, CURRENT_FACTORS[currentUnit]);
    const rSI = convertToSI(rawR, RESISTANCE_FACTORS[resistanceUnit]);

    const uSI = rSI * iSI;
    const uTarget = convertFromSI(uSI, VOLTAGE_FACTORS[voltageUnit]);

    return {
      success: true,
      value: uTarget,
      formattedValue: `${formatNumber(uTarget)} ${voltageUnit}`,
      unit: voltageUnit,
      formulaUsed: 'U = R × I',
      explanation: `Tension U = ${formatNumber(rawR)} ${resistanceUnit} × ${formatNumber(rawI)} ${currentUnit} = ${formatNumber(uTarget)} ${voltageUnit}`,
    };
  }

  if (target === 'I') {
    if (rawU === null || rawR === null) {
      return {
        success: false,
        error: 'Veuillez saisir la tension (U) et la résistance (R).',
      };
    }
    if (rawU < 0 || rawR < 0) {
      return {
        success: false,
        error: 'La tension et la résistance doivent être des valeurs positives.',
      };
    }

    const rSI = convertToSI(rawR, RESISTANCE_FACTORS[resistanceUnit]);
    if (rSI === 0) {
      return {
        success: false,
        error: 'Division par zéro impossible : la résistance (R) ne peut pas être égale à 0.',
      };
    }

    const uSI = convertToSI(rawU, VOLTAGE_FACTORS[voltageUnit]);
    const iSI = uSI / rSI;
    const iTarget = convertFromSI(iSI, CURRENT_FACTORS[currentUnit]);

    return {
      success: true,
      value: iTarget,
      formattedValue: `${formatNumber(iTarget)} ${currentUnit}`,
      unit: currentUnit,
      formulaUsed: 'I = U / R',
      explanation: `Intensité I = ${formatNumber(rawU)} ${voltageUnit} / ${formatNumber(rawR)} ${resistanceUnit} = ${formatNumber(iTarget)} ${currentUnit}`,
    };
  }

  if (target === 'R') {
    if (rawU === null || rawI === null) {
      return {
        success: false,
        error: 'Veuillez saisir la tension (U) et l\'intensité (I).',
      };
    }
    if (rawU < 0 || rawI < 0) {
      return {
        success: false,
        error: 'La tension et l\'intensité doivent être des valeurs positives.',
      };
    }

    const iSI = convertToSI(rawI, CURRENT_FACTORS[currentUnit]);
    if (iSI === 0) {
      return {
        success: false,
        error: 'Division par zéro impossible : l\'intensité (I) ne peut pas être égale à 0.',
      };
    }

    const uSI = convertToSI(rawU, VOLTAGE_FACTORS[voltageUnit]);
    const rSI = uSI / iSI;
    const rTarget = convertFromSI(rSI, RESISTANCE_FACTORS[resistanceUnit]);

    return {
      success: true,
      value: rTarget,
      formattedValue: `${formatNumber(rTarget)} ${resistanceUnit}`,
      unit: resistanceUnit,
      formulaUsed: 'R = U / I',
      explanation: `Résistance R = ${formatNumber(rawU)} ${voltageUnit} / ${formatNumber(rawI)} ${currentUnit} = ${formatNumber(rTarget)} ${resistanceUnit}`,
    };
  }

  return {
    success: false,
    error: 'Sélection de grandeur invalide.',
  };
}
