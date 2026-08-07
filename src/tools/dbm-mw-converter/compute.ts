import type { DbmMwConverterInputs } from './schema';

export interface DbmMwResult {
  powerDbm: number;
  powerMw: number;
  powerWatts: number;
  vrmsVolts: number;
}

/**
 * P(mW) = 10 ^ (P(dBm) / 10)
 * P(dBm) = 10 * log10(P(mW))
 * Vrms = √(P(W) * R) sous R ohms (50 Ω par défaut en RF/Optique)
 */
export function computeDbmMwConversion(inputs: DbmMwConverterInputs): DbmMwResult {
  const { mode, value, impedanceOhms } = inputs;

  let powerDbm: number;
  let powerMw: number;

  if (mode === 'dbm_to_mw') {
    powerDbm = value;
    powerMw = Math.pow(10, value / 10);
  } else {
    powerMw = Math.max(0.000001, value);
    powerDbm = 10 * Math.log10(powerMw);
  }

  const powerWatts = powerMw / 1000;
  const vrmsVolts = Math.sqrt(powerWatts * impedanceOhms);

  return {
    powerDbm: Number(powerDbm.toFixed(2)),
    powerMw: Number(powerMw.toFixed(4)),
    powerWatts: Number(powerWatts.toFixed(6)),
    vrmsVolts: Number(vrmsVolts.toFixed(4)),
  };
}
