import { describe, expect, it } from 'vitest';
import {
  computeAddSubtractDuration,
  computeBetweenTimes,
  convertDecimalHours,
} from './compute';

describe('Time Calculator Engine (compute.ts)', () => {
  it('computes duration between 07:30 and 15:45 (8h 15min = 8.25h)', () => {
    const res = computeBetweenTimes('07:30', '15:45', 0);
    expect(res.hours).toBe(8);
    expect(res.minutes).toBe(15);
    expect(res.decimalHours).toBe(8.25);
    expect(res.formattedDuration).toBe('8 h 15 min');
  });

  it('computes duration with break deducted (08:00 to 17:00 minus 60 min break = 8h)', () => {
    const res = computeBetweenTimes('08:00', '17:00', 60);
    expect(res.hours).toBe(8);
    expect(res.minutes).toBe(0);
    expect(res.decimalHours).toBe(8);
  });

  it('handles overnight shift (22:00 to 06:00 = 8h)', () => {
    const res = computeBetweenTimes('22:00', '06:00', 0);
    expect(res.hours).toBe(8);
    expect(res.minutes).toBe(0);
  });

  it('adds and subtracts durations correctly', () => {
    const addRes = computeAddSubtractDuration(3, 45, 0, 2, 30, 0, 'add');
    expect(addRes.hours).toBe(6);
    expect(addRes.minutes).toBe(15);

    const subRes = computeAddSubtractDuration(5, 0, 0, 1, 30, 0, 'subtract');
    expect(subRes.hours).toBe(3);
    expect(subRes.minutes).toBe(30);
  });

  it('converts decimal hours (8.25h -> 8h 15min, 8.5h -> 8h 30min)', () => {
    const res1 = convertDecimalHours(8.25, 'decimal_to_hms');
    expect(res1.hours).toBe(8);
    expect(res1.minutes).toBe(15);

    const res2 = convertDecimalHours(8.5, 'decimal_to_hms');
    expect(res2.hours).toBe(8);
    expect(res2.minutes).toBe(30);
  });
});
