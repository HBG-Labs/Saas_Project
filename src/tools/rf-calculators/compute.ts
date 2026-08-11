/**
 * ALGORITHMES DE CALCULS RF ET TÉLÉCOMS (13 MODULES)
 */

const SPEED_OF_LIGHT = 299792458; // m/s

/** 1. Longueur d'onde λ = c / f */
export function calcWavelength(freqHz: number, velocityFactor: number = 1.0) {
  const f = Math.max(1, freqHz);
  const v = SPEED_OF_LIGHT * Math.min(1, Math.max(0.1, velocityFactor));
  const lambdaMeters = v / f;

  return {
    lambdaMeters: Number(lambdaMeters.toFixed(4)),
    lambdaCm: Number((lambdaMeters * 100).toFixed(2)),
    halfLambdaMeters: Number((lambdaMeters / 2).toFixed(4)),
    quarterLambdaMeters: Number((lambdaMeters / 4).toFixed(4)),
  };
}

/** 2. Perte de trajet en espace libre (FSPL) */
export function calcFspl(distKm: number, freqMHz: number) {
  const d = Math.max(0.001, distKm);
  const f = Math.max(0.001, freqMHz);
  // FSPL (dB) = 20*log10(d_km) + 20*log10(f_MHz) + 32.44
  const fsplDb = 20 * Math.log10(d) + 20 * Math.log10(f) + 32.44;

  return {
    fsplDb: Number(fsplDb.toFixed(2)),
  };
}

/** 3. Atténuateurs Pi et Tee */
export function calcAttenuator(attenuationDb: number, z0: number = 50) {
  const a = Math.max(0.1, attenuationDb);
  const k = Math.pow(10, a / 20); // K = 10^(A/20)

  // Pi Attenuator : R1 (parallel), R2 (series)
  const r1_pi = z0 * ((k + 1) / (k - 1));
  const r2_pi = (z0 / 2) * (k - 1 / k);

  // Tee Attenuator : R1 (series), R2 (parallel)
  const r1_tee = z0 * ((k - 1) / (k + 1));
  const r2_tee = z0 * (2 * k / (k * k - 1));

  return {
    piR1: Number(r1_pi.toFixed(2)),
    piR2: Number(r2_pi.toFixed(2)),
    teeR1: Number(r1_tee.toFixed(2)),
    teeR2: Number(r2_tee.toFixed(2)),
  };
}

/** 4. Budget Lien / Bilan de Liaison (RSSI & Marge de fondu) */
export function calcLinkBudget(
  pTxDbm: number,
  gTxDbi: number,
  lTxDb: number,
  fsplDb: number,
  gRxDbi: number,
  lRxDb: number,
  sensitivityDbm: number = -90,
) {
  const rssiDbm = pTxDbm + gTxDbi - lTxDb - fsplDb + gRxDbi - lRxDb;
  const fadeMarginDb = rssiDbm - sensitivityDbm;

  return {
    rssiDbm: Number(rssiDbm.toFixed(2)),
    fadeMarginDb: Number(fadeMarginDb.toFixed(2)),
    isLinkViable: fadeMarginDb >= 10,
  };
}

/** 5. Résonance LC (f = 1 / (2*π*√(L*C))) */
export function calcLcResonance(lHenries: number, cFarads: number) {
  const l = Math.max(1e-15, lHenries);
  const c = Math.max(1e-15, cFarads);
  const freqHz = 1 / (2 * Math.PI * Math.sqrt(l * c));
  const reactanceOhms = 2 * Math.PI * freqHz * l;

  return {
    freqHz: Number(freqHz.toFixed(2)),
    freqKhz: Number((freqHz / 1e3).toFixed(2)),
    freqMhz: Number((freqHz / 1e6).toFixed(4)),
    reactanceOhms: Number(reactanceOhms.toFixed(2)),
  };
}

/** 6. ROS / SWR (Rapport d'Ondes Stationnaires) */
export function calcSwr(pDirectWatts: number, pReflectedWatts: number) {
  const pFwd = Math.max(0, pDirectWatts);
  const pRev = Math.min(pFwd, Math.max(0, pReflectedWatts));

  if (pFwd === 0) return { swr: 1, rho: 0, returnLossDb: 99 };

  const rho = Math.sqrt(pRev / pFwd);
  const swr = (1 + rho) / Math.max(0.0001, 1 - rho);
  const returnLossDb = rho > 0 ? -20 * Math.log10(rho) : 99;

  return {
    swr: Number(swr.toFixed(2)),
    rho: Number(rho.toFixed(4)),
    returnLossDb: Number(returnLossDb.toFixed(2)),
  };
}

/** 7. Coefficient de réflexion (Rho / Γ) */
export function calcRhoFromSwr(swr: number) {
  const s = Math.max(1, swr);
  const rho = (s - 1) / (s + 1);
  const reflectedPowerPercent = rho * rho * 100;

  return {
    rho: Number(rho.toFixed(4)),
    reflectedPowerPercent: Number(reflectedPowerPercent.toFixed(2)),
  };
}

/** 8. Perte de retour (Return Loss dB) */
export function calcReturnLoss(rho: number) {
  const r = Math.min(0.9999, Math.max(0.0001, rho));
  const returnLossDb = -20 * Math.log10(r);
  const swr = (1 + r) / (1 - r);

  return {
    returnLossDb: Number(returnLossDb.toFixed(2)),
    swr: Number(swr.toFixed(2)),
  };
}

/** 9. Perte Mismatch (Désadaptation dB) */
export function calcMismatchLoss(rho: number) {
  const r = Math.min(0.9999, Math.max(0, rho));
  const mismatchLossDb = -10 * Math.log10(Math.max(0.00001, 1 - r * r));

  return {
    mismatchLossDb: Number(mismatchLossDb.toFixed(3)),
    transmittedPercent: Number(((1 - r * r) * 100).toFixed(2)),
  };
}

/** 10. Puissance rayonnée vs ROS */
export function calcRadiatedPowerVsSwr(pDirectWatts: number, swr: number) {
  const pFwd = Math.max(0, pDirectWatts);
  const s = Math.max(1, swr);
  const rho = (s - 1) / (s + 1);
  const pRadiated = pFwd * (1 - rho * rho);
  const pLost = pFwd - pRadiated;

  return {
    pRadiatedWatts: Number(pRadiated.toFixed(2)),
    pLostWatts: Number(pLost.toFixed(2)),
    efficiencyPercent: Number(((pRadiated / Math.max(0.001, pFwd)) * 100).toFixed(2)),
  };
}

/** 11. Ligne de transmission (Tx, Atténuation, Pout) */
export function calcTransmissionLine(pTxDbm: number, cableLengthMeters: number, lossDbPerMeter: number) {
  const len = Math.max(0, cableLengthMeters);
  const attPerM = Math.max(0, lossDbPerMeter);
  const totalCableLossDb = len * attPerM;
  const pOutDbm = pTxDbm - totalCableLossDb;
  const pOutMw = Math.pow(10, pOutDbm / 10);

  return {
    totalCableLossDb: Number(totalCableLossDb.toFixed(2)),
    pOutDbm: Number(pOutDbm.toFixed(2)),
    pOutMw: Number(pOutMw.toFixed(2)),
  };
}

/** 12. EIRP / ERP (PIRE & PAR) */
export function calcEirpErp(pTxDbm: number, cableLossDb: number, antennaGainDbi: number) {
  const eirpDbm = pTxDbm - cableLossDb + antennaGainDbi;
  const eirpWatts = Math.pow(10, eirpDbm / 10) / 1000;
  const erpDbm = eirpDbm - 2.15; // ERP = EIRP - 2.15 dB (gain dipôle)
  const erpWatts = Math.pow(10, erpDbm / 10) / 1000;

  return {
    eirpDbm: Number(eirpDbm.toFixed(2)),
    eirpWatts: Number(eirpWatts < 0.01 ? eirpWatts.toExponential(2) : eirpWatts.toFixed(2)),
    erpDbm: Number(erpDbm.toFixed(2)),
    erpWatts: Number(erpWatts < 0.01 ? erpWatts.toExponential(2) : erpWatts.toFixed(2)),
  };
}

/** 13. Zone de Fresnel (1er rayon & 60% clearance) */
export function calcFresnelZone(d1Km: number, d2Km: number, freqGHz: number) {
  const d1 = Math.max(0.01, d1Km);
  const d2 = Math.max(0.01, d2Km);
  const f = Math.max(0.1, freqGHz);
  const dTotal = d1 + d2;

  // r1 (m) = 17.32 * sqrt((d1 * d2) / (f_GHz * d_total))
  const r1Meters = 17.32 * Math.sqrt((d1 * d2) / (f * dTotal));
  const clearance60PercentMeters = 0.6 * r1Meters;

  return {
    r1Meters: Number(r1Meters.toFixed(2)),
    clearance60PercentMeters: Number(clearance60PercentMeters.toFixed(2)),
    dTotalKm: Number(dTotal.toFixed(2)),
  };
}
