import { describe, expect, it } from 'vitest';
import { computeDbmMwConversion } from './compute';

describe('computeDbmMwConversion', () => {
  it('convertit 0 dBm en 1 mW', () => {
    const result = computeDbmMwConversion({
      mode: 'dbm_to_mw',
      value: 0,
      impedanceOhms: 50,
    });

    expect(result.powerMw).toBe(1.0);
    expect(result.powerWatts).toBe(0.001);
  });

  it('convertit 10 dBm en 10 mW', () => {
    const result = computeDbmMwConversion({
      mode: 'dbm_to_mw',
      value: 10,
      impedanceOhms: 50,
    });

    expect(result.powerMw).toBe(10.0);
  });

  it('convertit 100 mW en 20 dBm', () => {
    const result = computeDbmMwConversion({
      mode: 'mw_to_dbm',
      value: 100,
      impedanceOhms: 50,
    });

    expect(result.powerDbm).toBe(20.0);
  });
});
