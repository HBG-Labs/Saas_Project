import { describe, expect, it } from 'vitest';
import {
  computeProportionalSplit,
  computeRuleOfThree,
  gcd,
  simplifyRatio,
} from './compute';

describe('Ratio Calculator Engine (compute.ts)', () => {
  it('computes GCD correctly', () => {
    expect(gcd(100, 50)).toBe(50);
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
  });

  it('computes rule of three (If 2 -> 10, then 5 -> 25)', () => {
    const res = computeRuleOfThree(2, 10, 5);
    expect(res.d).toBe(25);
    expect(res.formattedD).toBe('25');
    expect(res.isValid).toBe(true);
  });

  it('simplifies ratios (100:50 -> 2:1, 1920:1080 -> 16:9)', () => {
    const res1 = simplifyRatio(100, 50);
    expect(res1.formatted).toBe('2 : 1');

    const res2 = simplifyRatio(1920, 1080);
    expect(res2.formatted).toBe('16 : 9');
  });

  it('computes proportional split (1000 split by 2:3:5 -> 200, 300, 500)', () => {
    const res = computeProportionalSplit(1000, [2, 3, 5]);
    expect(res.shares).toEqual([200, 300, 500]);
    expect(res.formattedShares).toEqual(['200', '300', '500']);
  });

  it('handles division by zero safely in rule of three', () => {
    const res = computeRuleOfThree(0, 10, 5);
    expect(res.isValid).toBe(false);
    expect(res.d).toBe(0);
  });
});
