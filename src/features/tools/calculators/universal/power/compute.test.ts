import { describe, expect, it } from 'vitest';
import {
  computeEnergyConsumption,
  computePowerConversions,
} from './compute';

describe('Power Calculator Engine (compute.ts)', () => {
  it('computes 5 kW power conversions (5000 W, 5 kVA, ~6.8 hp)', () => {
    const res = computePowerConversions(5, 'kw');
    expect(res.valueInWatts).toBe(5000);

    const w = res.conversions.find((c) => c.unit === 'w');
    expect(w?.value).toBe(5000);

    const kva = res.conversions.find((c) => c.unit === 'kva');
    expect(kva?.value).toBe(5);

    const hp = res.conversions.find((c) => c.unit === 'hp');
    expect(hp?.value).toBeCloseTo(6.798, 2);
  });

  it('computes energy consumption (2 kW for 3.5 hours = 7 kWh = 25.2 MJ)', () => {
    const res = computeEnergyConsumption(2, 'kw', 3.5);
    expect(res.kwh).toBe(7);
    expect(res.wh).toBe(7000);
    expect(res.joules).toBe(25200000);
    expect(res.formattedKwh).toBe('7 kWh');
  });

  it('handles zero and negative inputs safely', () => {
    const resZero = computePowerConversions(0, 'w');
    expect(resZero.valueInWatts).toBe(0);

    const resNeg = computeEnergyConsumption(-5, 'kw', 2);
    expect(resNeg.kwh).toBe(0);
  });
});
