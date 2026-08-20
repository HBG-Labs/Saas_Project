import { describe, expect, it } from 'vitest';
import { compute2DDistance, computeDistanceConversions } from './compute';

describe('Distance Calculator Engine (compute.ts)', () => {
  it('computes distance conversions accurately (1250 m -> km, cm, mm)', () => {
    const res = computeDistanceConversions(1250, 'm');
    expect(res.meters).toBe(1250);

    const km = res.conversions.find((c) => c.unit === 'km');
    expect(km?.value).toBe(1.25);

    const cm = res.conversions.find((c) => c.unit === 'cm');
    expect(cm?.value).toBe(125000);

    const mm = res.conversions.find((c) => c.unit === 'mm');
    expect(mm?.value).toBe(1250000);
  });

  it('computes 2D distance between points (3, 4) from (0, 0)', () => {
    const res = compute2DDistance(0, 0, 3, 4, 'm');
    expect(res.distance).toBe(5);
    expect(res.deltaX).toBe(3);
    expect(res.deltaY).toBe(4);
  });

  it('handles negative coordinates and zeros', () => {
    const res = compute2DDistance(-2, -3, 1, 1, 'm');
    expect(res.distance).toBe(5); // dx=3, dy=4 -> 5
  });

  it('handles NaN or invalid inputs safely', () => {
    const res = computeDistanceConversions(NaN, 'm');
    expect(res.meters).toBe(0);
    expect(res.conversions).toHaveLength(0);
  });
});
