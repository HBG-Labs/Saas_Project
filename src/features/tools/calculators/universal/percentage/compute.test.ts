import { describe, expect, it } from 'vitest';
import {
  computeAddPercent,
  computeEvolution,
  computePartOfTotal,
  computePercentOf,
  computeSubtractPercent,
} from './compute';

describe('Percentage Calculator Engine (compute.ts)', () => {
  it('computes 20% of 500 = 100', () => {
    const res = computePercentOf(20, 500);
    expect(res.result).toBe(100);
    expect(res.formatted).toBe('100');
  });

  it('computes evolution from 100 to 125 = +25%', () => {
    const res = computeEvolution(100, 125);
    expect(res.percentChange).toBe(25);
    expect(res.formatted).toBe('+25 %');
    expect(res.isIncrease).toBe(true);
  });

  it('computes negative evolution from 200 to 150 = -25%', () => {
    const res = computeEvolution(200, 150);
    expect(res.percentChange).toBe(-25);
    expect(res.formatted).toBe('-25 %');
    expect(res.isIncrease).toBe(false);
  });

  it('computes subtract percent: 500 - 20% = 400 (discount = 100)', () => {
    const res = computeSubtractPercent(500, 20);
    expect(res.finalValue).toBe(400);
    expect(res.discount).toBe(100);
  });

  it('computes add percent: 500 + 20% = 600 (increase = 100)', () => {
    const res = computeAddPercent(500, 20);
    expect(res.finalValue).toBe(600);
    expect(res.increase).toBe(100);
  });

  it('computes part of total: 25 on 200 = 12.5%', () => {
    const res = computePartOfTotal(25, 200);
    expect(res.percent).toBe(12.5);
    expect(res.formatted).toBe('12,5 %');
  });

  it('handles division by zero in evolution and part_of_total', () => {
    const resEvolZero = computeEvolution(0, 50);
    expect(resEvolZero.percentChange).toBe(0);

    const resPartZero = computePartOfTotal(50, 0);
    expect(resPartZero.percent).toBe(0);
  });
});
