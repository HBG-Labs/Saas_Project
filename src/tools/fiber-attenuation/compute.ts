import type { FiberAttenuationInputs } from './schema';

export interface FiberAttenuationResult {
  fiberLossDb: number;
  splicesLossDb: number;
  connectorsLossDb: number;
  totalLossDb: number;
  totalWithMarginDb: number;
  attenuationPerKm: number;
  isCompliant: boolean;
  statusLabel: string;
}

/**
 * Atténuation linéique standard ITU-T G.652.D (Monomode / SMF)
 * 1310 nm : 0.35 dB/km
 * 1550 nm : 0.21 dB/km
 */
export function getAttenuationPerKm(wavelength: '1310' | '1550'): number {
  return wavelength === '1310' ? 0.35 : 0.21;
}

export function computeFiberAttenuation(inputs: FiberAttenuationInputs): FiberAttenuationResult {
  const attenuationPerKm = getAttenuationPerKm(inputs.wavelength);
  const fiberLossDb = inputs.distanceKm * attenuationPerKm;
  const splicesLossDb = inputs.splicesCount * inputs.spliceLossDb;
  const connectorsLossDb = inputs.connectorsCount * inputs.connectorLossDb;

  const totalLossDb = fiberLossDb + splicesLossDb + connectorsLossDb;
  const totalWithMarginDb = totalLossDb + inputs.safetyMarginDb;

  // Seuil de conformité générique FTTH / PON ISO 11801 : ≤ 28 dB
  const isCompliant = totalWithMarginDb <= 28;
  const statusLabel = isCompliant
    ? 'Conforme ISO/IEC 11801 (Liaison valide)'
    : 'Atténuation excessive (> 28 dB)';

  return {
    fiberLossDb: Number(fiberLossDb.toFixed(3)),
    splicesLossDb: Number(splicesLossDb.toFixed(3)),
    connectorsLossDb: Number(connectorsLossDb.toFixed(3)),
    totalLossDb: Number(totalLossDb.toFixed(3)),
    totalWithMarginDb: Number(totalWithMarginDb.toFixed(3)),
    attenuationPerKm,
    isCompliant,
    statusLabel,
  };
}
