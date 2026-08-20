import { describe, expect, it } from 'vitest';
import { computeSurface } from './compute';

describe('Surface Calculator Engine (compute.ts)', () => {
  it('computes rectangle area correctly (12m x 5m = 60m²)', () => {
    const res = computeSurface({ shape: 'rectangle', length: 12, width: 5, inputUnit: 'm' });
    expect(res.areaInM2).toBe(60);
    expect(res.perimeterInM).toBe(34);
  });

  it('computes square area correctly (8m side = 64m²)', () => {
    const res = computeSurface({ shape: 'square', side: 8, inputUnit: 'm' });
    expect(res.areaInM2).toBe(64);
    expect(res.perimeterInM).toBe(32);
  });

  it('computes circle area correctly (radius 3m = 28.27m²)', () => {
    const res = computeSurface({ shape: 'circle', radius: 3, inputUnit: 'm' });
    expect(res.areaInM2).toBeCloseTo(28.2743, 3);
  });

  it('computes triangle area correctly (base 6m, height 4m = 12m²)', () => {
    const res = computeSurface({ shape: 'triangle', base: 6, height: 4, inputUnit: 'm' });
    expect(res.areaInM2).toBe(12);
  });

  it('computes trapezoid area correctly', () => {
    const res = computeSurface({ shape: 'trapezoid', base: 4, base2: 6, height: 3, inputUnit: 'm' });
    expect(res.areaInM2).toBe(15);
  });

  it('handles centimeter and millimeter unit inputs', () => {
    const resCm = computeSurface({ shape: 'rectangle', length: 100, width: 200, inputUnit: 'cm' });
    expect(resCm.areaInM2).toBe(2); // 1m * 2m = 2m²

    const resMm = computeSurface({ shape: 'square', side: 1000, inputUnit: 'mm' });
    expect(resMm.areaInM2).toBe(1); // 1m²
  });

  it('handles 0 and negative inputs safely', () => {
    const resZero = computeSurface({ shape: 'rectangle', length: 0, width: 5, inputUnit: 'm' });
    expect(resZero.areaInM2).toBe(0);

    const resNeg = computeSurface({ shape: 'rectangle', length: -10, width: 5, inputUnit: 'm' });
    expect(resNeg.areaInM2).toBe(0);
  });
});
