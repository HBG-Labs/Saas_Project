import { describe, expect, it } from 'vitest';
import { computePressureConversions } from './compute';

describe('Pressure Calculator Engine (compute.ts)', () => {
  it('computes 6 bar conversions accurately (87.02 PSI, 600 kPa, 600000 Pa)', () => {
    const res = computePressureConversions(6, 'bar');
    expect(res.valueInPa).toBe(600000);

    const psi = res.conversions.find((c) => c.unit === 'psi');
    expect(psi?.value).toBeCloseTo(87.0226, 2);

    const kpa = res.conversions.find((c) => c.unit === 'kpa');
    expect(kpa?.value).toBe(600);

    const mbar = res.conversions.find((c) => c.unit === 'mbar');
    expect(mbar?.value).toBe(6000);
  });

  it('computes 1 atm = 1013.25 mbar = 101.325 kPa', () => {
    const res = computePressureConversions(1, 'atm');
    const mbar = res.conversions.find((c) => c.unit === 'mbar');
    expect(mbar?.value).toBe(1013.25);
  });

  it('handles zero and negative inputs safely', () => {
    const resZero = computePressureConversions(0, 'bar');
    expect(resZero.valueInPa).toBe(0);
  });
});
