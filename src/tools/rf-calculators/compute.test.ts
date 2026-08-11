import { describe, expect, it } from 'vitest';
import {
  calcWavelength,
  calcFspl,
  calcAttenuator,
  calcLinkBudget,
  calcLcResonance,
  calcSwr,
  calcRhoFromSwr,
  calcReturnLoss,
  calcMismatchLoss,
  calcRadiatedPowerVsSwr,
  calcTransmissionLine,
  calcEirpErp,
  calcFresnelZone,
} from './compute';

describe('Calculatrices RF (13 modules)', () => {
  it('1. Longueur d\'onde', () => {
    const res = calcWavelength(300e6); // 300 MHz
    expect(res.lambdaMeters).toBeCloseTo(1.0, 1);
  });

  it('2. Perte FSPL', () => {
    const res = calcFspl(10, 2400); // 10 km @ 2.4 GHz
    expect(res.fsplDb).toBeGreaterThan(100);
  });

  it('3. Atténuateurs Pi/Tee', () => {
    const res = calcAttenuator(6, 50);
    expect(res.piR1).toBeGreaterThan(50);
  });

  it('4. Budget Lien', () => {
    const res = calcLinkBudget(20, 15, 2, 100, 15, 2, -95);
    expect(res.rssiDbm).toBe(-54);
    expect(res.isLinkViable).toBe(true);
  });

  it('5. Résonance LC', () => {
    const res = calcLcResonance(1e-6, 1e-9);
    expect(res.freqMhz).toBeGreaterThan(1);
  });

  it('6. ROS / SWR', () => {
    const res = calcSwr(10, 1); // 10W direct, 1W réfléchi
    expect(res.swr).toBeGreaterThan(1);
  });

  it('7. Coefficient de réflexion Rho', () => {
    const res = calcRhoFromSwr(1.5);
    expect(res.rho).toBe(0.2);
  });

  it('8. Perte de retour (Return Loss)', () => {
    const res = calcReturnLoss(0.1);
    expect(res.returnLossDb).toBe(20);
  });

  it('9. Perte mismatch', () => {
    const res = calcMismatchLoss(0.2);
    expect(res.mismatchLossDb).toBeGreaterThan(0);
  });

  it('10. Puissance rayonnée vs ROS', () => {
    const res = calcRadiatedPowerVsSwr(100, 1.5);
    expect(res.pRadiatedWatts).toBe(96);
  });

  it('11. Ligne de transmission', () => {
    const res = calcTransmissionLine(30, 10, 0.5);
    expect(res.pOutDbm).toBe(25);
  });

  it('12. EIRP / ERP', () => {
    const res = calcEirpErp(20, 2, 12);
    expect(res.eirpDbm).toBe(30);
    expect(res.erpDbm).toBe(27.85);
  });

  it('13. Zone de Fresnel', () => {
    const res = calcFresnelZone(5, 5, 2.4);
    expect(res.r1Meters).toBeGreaterThan(5);
  });
});
