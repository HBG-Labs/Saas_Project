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

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSIONS UNIVERSELLES POUR LES 6 CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

/** 1. Puissance (dBm, W, mW, dBW) */
export function convertPower(value: number, fromUnit: 'dbm' | 'mw' | 'w' | 'dbw') {
  let dbm = 0;
  if (fromUnit === 'dbm') dbm = value;
  else if (fromUnit === 'mw') dbm = 10 * Math.log10(Math.max(1e-12, value));
  else if (fromUnit === 'w') dbm = 10 * Math.log10(Math.max(1e-15, value)) + 30;
  else if (fromUnit === 'dbw') dbm = value + 30;

  const mw = Math.pow(10, dbm / 10);
  const w = mw / 1000;
  const dbw = dbm - 30;

  return {
    dbm: Number(dbm.toFixed(2)),
    mw: Number(mw < 0.001 ? mw.toExponential(3) : mw.toFixed(4)),
    w: Number(w < 0.001 ? w.toExponential(3) : w.toFixed(6)),
    dbw: Number(dbw.toFixed(2)),
  };
}

/** 2. Tension (Volt, mV, µV, dBV, dBµV, dBu) */
export function convertVoltage(value: number, fromUnit: 'v' | 'mv' | 'uv' | 'dbv' | 'dbuv' | 'dbu') {
  let volts = 1;
  if (fromUnit === 'v') volts = Math.max(1e-9, value);
  else if (fromUnit === 'mv') volts = Math.max(1e-9, value) / 1e3;
  else if (fromUnit === 'uv') volts = Math.max(1e-9, value) / 1e6;
  else if (fromUnit === 'dbv') volts = Math.pow(10, value / 20);
  else if (fromUnit === 'dbuv') volts = Math.pow(10, (value - 120) / 20);
  else if (fromUnit === 'dbu') volts = 0.7745966 * Math.pow(10, value / 20);

  const mv = volts * 1e3;
  const uv = volts * 1e6;
  const dbv = 20 * Math.log10(volts);
  const dbuv = 20 * Math.log10(uv);
  const dbu = 20 * Math.log10(volts / 0.7745966);

  return {
    v: Number(volts < 0.001 ? volts.toExponential(3) : volts.toFixed(4)),
    mv: Number(mv < 0.001 ? mv.toExponential(3) : mv.toFixed(2)),
    uv: Number(uv.toFixed(1)),
    dbv: Number(dbv.toFixed(2)),
    dbuv: Number(dbuv.toFixed(2)),
    dbu: Number(dbu.toFixed(2)),
  };
}

/** 3. Courant (Ampère, mA, µA, dBA, dBµA) */
export function convertCurrent(value: number, fromUnit: 'a' | 'ma' | 'ua' | 'dba' | 'dbua') {
  let amps = 1;
  if (fromUnit === 'a') amps = Math.max(1e-9, value);
  else if (fromUnit === 'ma') amps = Math.max(1e-9, value) / 1e3;
  else if (fromUnit === 'ua') amps = Math.max(1e-9, value) / 1e6;
  else if (fromUnit === 'dba') amps = Math.pow(10, value / 20);
  else if (fromUnit === 'dbua') amps = Math.pow(10, (value - 120) / 20);

  const ma = amps * 1e3;
  const ua = amps * 1e6;
  const dba = 20 * Math.log10(amps);
  const dbua = 20 * Math.log10(ua);

  return {
    a: Number(amps < 0.001 ? amps.toExponential(3) : amps.toFixed(4)),
    ma: Number(ma < 0.001 ? ma.toExponential(3) : ma.toFixed(2)),
    ua: Number(ua.toFixed(1)),
    dba: Number(dba.toFixed(2)),
    dbua: Number(dbua.toFixed(2)),
  };
}

/** 4. Terminé (Z = 50 Ω / 75 Ω) */
export function convertTerminated(value: number, fromUnit: 'dbm' | 'dbuv' | 'dbua' | 'vrms', z: number = 50) {
  let dbm = 0;

  // dBµV − dBm = 90 + 10·log10(Z).
  //
  //   dBm  = 20·log10(V) − 10·log10(Z) + 30      (V en volts, P en milliwatts)
  //   dBµV = 20·log10(V) + 120
  //
  // La différence vaut donc 120 − 30 + 10·log10(Z). Soit 106,99 dB sous 50 Ω et
  // 108,75 dB sous 75 Ω — les valeurs de référence des tables RF.
  const k = 90 + 10 * Math.log10(z);

  if (fromUnit === 'dbm') dbm = value;
  else if (fromUnit === 'dbuv') dbm = value - k;
  else if (fromUnit === 'dbua') dbm = value - (k - 20 * Math.log10(z));
  else if (fromUnit === 'vrms') {
    const w = (value * value) / z;
    dbm = 10 * Math.log10(w * 1000);
  }

  const dbuv = dbm + k;
  const dbua = dbuv - 20 * Math.log10(z);
  const mw = Math.pow(10, dbm / 10);
  const vrms = Math.sqrt((mw / 1000) * z);

  return {
    dbm: Number(dbm.toFixed(2)),
    dbuv: Number(dbuv.toFixed(2)),
    dbua: Number(dbua.toFixed(2)),
    vrms: Number(vrms.toFixed(4)),
  };
}

/** 5. Intensité du champ (dBµV/m, V/m, mV/m, dBmW/m², W/m², dBµA/m, dBpT) */
export function convertFieldStrength(value: number, fromUnit: 'dbuv_m' | 'v_m' | 'mv_m' | 'dbmw_m2' | 'w_m2' | 'dbua_m' | 'dbpt') {
  let dbuv_m = 0;

  if (fromUnit === 'dbuv_m') dbuv_m = value;
  else if (fromUnit === 'v_m') dbuv_m = 20 * Math.log10(Math.max(1e-9, value)) + 120;
  else if (fromUnit === 'mv_m') dbuv_m = 20 * Math.log10(Math.max(1e-9, value)) + 60;
  else if (fromUnit === 'dbmw_m2') dbuv_m = value + 115.76; // Z0 = 377 Ω (120*pi)
  else if (fromUnit === 'w_m2') dbuv_m = 10 * Math.log10(Math.max(1e-15, value)) + 145.76;
  else if (fromUnit === 'dbua_m') dbuv_m = value + 51.53; // 20*log10(377) ≈ 51.53
  else if (fromUnit === 'dbpt') dbuv_m = value + 2.02;

  const vm = Math.pow(10, (dbuv_m - 120) / 20);
  const mvm = vm * 1000;
  const wm2 = (vm * vm) / 377; // Densité de puissance S = E² / Z0
  const dbmw_m2 = dbuv_m - 115.76;
  const dbua_m = dbuv_m - 51.53;
  const dbpt = dbuv_m - 2.02;

  return {
    dbuv_m: Number(dbuv_m.toFixed(2)),
    v_m: Number(vm < 0.001 ? vm.toExponential(3) : vm.toFixed(4)),
    mv_m: Number(mvm < 0.001 ? mvm.toExponential(3) : mvm.toFixed(2)),
    dbmw_m2: Number(dbmw_m2.toFixed(2)),
    w_m2: Number(wm2 < 0.001 ? wm2.toExponential(3) : wm2.toFixed(6)),
    dbua_m: Number(dbua_m.toFixed(2)),
    dbpt: Number(dbpt.toFixed(2)),
  };
}

/** 6. Distance | Longueur (mm, cm, m, km, in, ft, yd, mi) */
export function convertDistance(value: number, fromUnit: 'mm' | 'cm' | 'm' | 'km' | 'in' | 'ft' | 'yd' | 'mi') {
  let meters = 1;
  if (fromUnit === 'mm') meters = value / 1000;
  else if (fromUnit === 'cm') meters = value / 100;
  else if (fromUnit === 'm') meters = value;
  else if (fromUnit === 'km') meters = value * 1000;
  else if (fromUnit === 'in') meters = value * 0.0254;
  else if (fromUnit === 'ft') meters = value * 0.3048;
  else if (fromUnit === 'yd') meters = value * 0.9144;
  else if (fromUnit === 'mi') meters = value * 1609.344;

  return {
    mm: Number((meters * 1000).toFixed(2)),
    cm: Number((meters * 100).toFixed(2)),
    m: Number(meters.toFixed(4)),
    km: Number((meters / 1000).toFixed(4)),
    in: Number((meters / 0.0254).toFixed(3)),
    ft: Number((meters / 0.3048).toFixed(3)),
    yd: Number((meters / 0.9144).toFixed(3)),
    mi: Number((meters / 1609.344).toFixed(5)),
  };
}
