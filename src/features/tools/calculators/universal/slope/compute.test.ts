import { describe, expect, it } from 'vitest';
import {
  computeSlopeDirect,
  computeSlopeInverseDegrees,
  computeSlopeInversePercent,
} from './compute';

describe('Slope Calculator Engine (compute.ts)', () => {
  it('computes direct slope for H=2m, D=10m (20%, 11.31°, 10.20m)', () => {
    const res = computeSlopeDirect({ heightDifference: 2, horizontalDistance: 10 });
    expect(res.slopePercent).toBe(20);
    expect(res.angleDegrees).toBeCloseTo(11.3099, 2);
    expect(res.slopeLength).toBeCloseTo(10.198, 2);
    expect(res.ratio).toBe('1 : 5.0');
    expect(res.isValid).toBe(true);
  });

  it('computes inverse percent slope (20% on 10m -> 2m height)', () => {
    const res = computeSlopeInversePercent({ slopePercent: 20, horizontalDistance: 10 });
    expect(res.heightDifference).toBe(2);
    expect(res.angleDegrees).toBeCloseTo(11.3099, 2);
  });

  it('computes inverse degrees slope (45° on 10m -> 10m height, 100% slope)', () => {
    const res = computeSlopeInverseDegrees({ angleDegrees: 45, horizontalDistance: 10 });
    expect(res.heightDifference).toBeCloseTo(10, 4);
    expect(res.slopePercent).toBeCloseTo(100, 4);
  });

  it('handles division by zero and invalid inputs safely', () => {
    const resZero = computeSlopeDirect({ heightDifference: 2, horizontalDistance: 0 });
    expect(resZero.isValid).toBe(false);
    expect(resZero.slopePercent).toBe(0);
  });
});
