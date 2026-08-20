import { describe, expect, it } from 'vitest';
import {
  computeFillingTime,
  computeFlowFromVolumeAndTime,
} from './compute';

describe('Flow Calculator Engine (compute.ts)', () => {
  it('computes flow rate from 500 L in 30 min (16.67 L/min = 1.0 m³/h)', () => {
    const res = computeFlowFromVolumeAndTime(500, 30);
    expect(res.flowLmin).toBeCloseTo(16.6667, 2);
    expect(res.flowM3h).toBeCloseTo(1, 4);
    expect(res.formattedLmin).toBe('16,67 L/min');
  });

  it('computes filling time for 1000 L at 20 L/min (50 min)', () => {
    const res = computeFillingTime(1000, 20);
    expect(res.totalMinutes).toBe(50);
    expect(res.hours).toBe(0);
    expect(res.minutes).toBe(50);
    expect(res.formattedTime).toBe('50 min');
  });

  it('computes filling time over 1 hour (1500 L at 10 L/min = 2h 30min)', () => {
    const res = computeFillingTime(1500, 10);
    expect(res.hours).toBe(2);
    expect(res.minutes).toBe(30);
    expect(res.formattedTime).toBe('2 h 30 min');
  });

  it('handles division by zero safely', () => {
    const resFlowZero = computeFlowFromVolumeAndTime(500, 0);
    expect(resFlowZero.flowLmin).toBe(0);

    const resTimeZero = computeFillingTime(500, 0);
    expect(resTimeZero.totalMinutes).toBe(0);
  });
});
