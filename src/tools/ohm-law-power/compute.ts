import type { OhmLawPowerInputs } from './schema';

export interface OhmLawPowerResult {
  activePowerKw: number;
  apparentPowerKva: number;
  reactivePowerKvar: number;
  voltageDropPercent: number;
  voltageDropVolts: number;
  isVoltageDropCompliant: boolean;
}

/**
 * Calcul électrique UTE C 15-105 :
 * Monophasé : P = U * I * cos(φ)
 * Triphasé  : P = √3 * U * I * cos(φ)
 * Résistivité Cuivre : ρ = 0.0225 Ω.mm²/m
 */
export function computeOhmLawPower(inputs: OhmLawPowerInputs): OhmLawPowerResult {
  const { phaseType, voltageVolts, currentAmps, cosPhi, cableLengthMeters, cableSectionMm2 } = inputs;

  const multiplier = phaseType === 'three' ? Math.sqrt(3) : 1;
  const apparentPowerVa = multiplier * voltageVolts * currentAmps;
  const activePowerW = apparentPowerVa * cosPhi;
  const sinPhi = Math.sqrt(Math.max(0, 1 - Math.pow(cosPhi, 2)));
  const reactivePowerVar = apparentPowerVa * sinPhi;

  // Calcul chute de tension ΔU = (k * ρ * L * I) / S
  // k = 2 en monophasé, 1 en triphasé (entre phases)
  const rho = 0.0225; // Ω.mm²/m pour cuivre à 70°C
  const k = phaseType === 'single' ? 2 : Math.sqrt(3);
  const voltageDropVolts = (k * rho * cableLengthMeters * currentAmps) / cableSectionMm2;
  const voltageDropPercent = (voltageDropVolts / voltageVolts) * 100;

  // Norme NF C 15-100 : Chute de tension < 3% en éclairage, < 5% en force motrice
  const isVoltageDropCompliant = voltageDropPercent <= 5;

  return {
    activePowerKw: Number((activePowerW / 1000).toFixed(2)),
    apparentPowerKva: Number((apparentPowerVa / 1000).toFixed(2)),
    reactivePowerKvar: Number((reactivePowerVar / 1000).toFixed(2)),
    voltageDropVolts: Number(voltageDropVolts.toFixed(2)),
    voltageDropPercent: Number(voltageDropPercent.toFixed(2)),
    isVoltageDropCompliant,
  };
}
