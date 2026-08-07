import { describe, expect, it } from 'vitest';
import { computeOhmLawPower } from './compute';

describe('computeOhmLawPower', () => {
  it('calcule la puissance en monophasé 230V 16A cos φ 0.9', () => {
    const result = computeOhmLawPower({
      phaseType: 'single',
      voltageVolts: 230,
      currentAmps: 16,
      cosPhi: 0.9,
      cableLengthMeters: 20,
      cableSectionMm2: 2.5,
    });

    // P = 230 * 16 * 0.9 = 3312 W = 3.31 kW
    expect(result.activePowerKw).toBe(3.31);
    expect(result.apparentPowerKva).toBe(3.68);
    expect(result.isVoltageDropCompliant).toBe(true);
  });

  it('calcule la puissance en triphasé 400V 45A cos φ 0.85', () => {
    const result = computeOhmLawPower({
      phaseType: 'three',
      voltageVolts: 400,
      currentAmps: 45,
      cosPhi: 0.85,
      cableLengthMeters: 50,
      cableSectionMm2: 16,
    });

    // P = √3 * 400 * 45 * 0.85 = 26499.7 W = 26.5 kW
    expect(result.activePowerKw).toBeCloseTo(26.5, 0);
    expect(result.isVoltageDropCompliant).toBe(true);
  });
});
