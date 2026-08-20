import { describe, expect, it } from 'vitest';
import { computeTotalWeight } from './compute';

describe('Weight Calculator Engine (compute.ts)', () => {
  it('computes total weight (12 items x 2.5 kg = 30 kg)', () => {
    const res = computeTotalWeight(12, 2.5, 'kg');
    expect(res.totalWeight).toBe(30);
    expect(res.totalInKg).toBe(30);

    const g = res.conversions.find((c) => c.unit === 'g');
    expect(g?.value).toBe(30000);

    const t = res.conversions.find((c) => c.unit === 't');
    expect(t?.value).toBe(0.03);

    const lb = res.conversions.find((c) => c.unit === 'lb');
    expect(lb?.value).toBeCloseTo(66.1387, 2);
  });

  it('handles zero and negative inputs safely', () => {
    const resZero = computeTotalWeight(0, 5, 'kg');
    expect(resZero.totalWeight).toBe(0);

    const resNeg = computeTotalWeight(-5, 10, 'kg');
    expect(resNeg.totalWeight).toBe(0);
  });
});
