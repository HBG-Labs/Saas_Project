import { describe, expect, it } from 'vitest';
import { computeVolume } from './compute';

describe('Volume Calculator Engine (compute.ts)', () => {
  it('computes cuboid volume correctly (2m x 3m x 4m = 24m³ = 24 000 L)', () => {
    const res = computeVolume({ shape: 'cuboid', length: 2, width: 3, height: 4, inputUnit: 'm' });
    expect(res.volumeInM3).toBe(24);
    expect(res.liters).toBe(24000);
  });

  it('computes cylinder volume correctly (r=1m, h=2m = 2pi m³ = ~6283.18 L)', () => {
    const res = computeVolume({ shape: 'cylinder', radius: 1, height: 2, inputUnit: 'm' });
    expect(res.volumeInM3).toBeCloseTo(2 * Math.PI, 4);
    expect(res.liters).toBeCloseTo(2000 * Math.PI, 1);
  });

  it('computes sphere volume correctly (r=1m = 4/3 * pi m³)', () => {
    const res = computeVolume({ shape: 'sphere', radius: 1, inputUnit: 'm' });
    expect(res.volumeInM3).toBeCloseTo((4 / 3) * Math.PI, 4);
  });

  it('handles centimeter and millimeter unit inputs (100cm x 100cm x 100cm = 1m³ = 1000L)', () => {
    const resCm = computeVolume({ shape: 'cuboid', length: 100, width: 100, height: 100, inputUnit: 'cm' });
    expect(resCm.volumeInM3).toBe(1);
    expect(resCm.liters).toBe(1000);
  });

  it('handles 0 and negative values safely', () => {
    const resZero = computeVolume({ shape: 'cuboid', length: 0, width: 2, height: 3, inputUnit: 'm' });
    expect(resZero.volumeInM3).toBe(0);
    expect(resZero.liters).toBe(0);

    const resNeg = computeVolume({ shape: 'cylinder', radius: -2, height: 3, inputUnit: 'm' });
    expect(resNeg.volumeInM3).toBe(0);
  });
});
