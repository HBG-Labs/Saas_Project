import { describe, expect, it } from 'vitest';
import { convertUnit, UNIT_CATEGORIES } from './compute';

describe('Unit Converter Engine (compute.ts)', () => {
  it('converts length correctly (m to km, mm, in, ft)', () => {
    const resKm = convertUnit({ category: 'length', value: 1250, fromUnitId: 'm', toUnitId: 'km' });
    expect(resKm.result).toBe(1.25);

    const resMm = convertUnit({ category: 'length', value: 1, fromUnitId: 'm', toUnitId: 'mm' });
    expect(resMm.result).toBe(1000);

    const resIn = convertUnit({ category: 'length', value: 1, fromUnitId: 'in', toUnitId: 'cm' });
    expect(resIn.result).toBeCloseTo(2.54, 4);

    const resFt = convertUnit({ category: 'length', value: 1, fromUnitId: 'ft', toUnitId: 'm' });
    expect(resFt.result).toBeCloseTo(0.3048, 4);
  });

  it('converts area correctly (m2, ha, km2)', () => {
    const resHa = convertUnit({ category: 'area', value: 10000, fromUnitId: 'm2', toUnitId: 'ha' });
    expect(resHa.result).toBe(1);

    const resKm2 = convertUnit({ category: 'area', value: 1000000, fromUnitId: 'm2', toUnitId: 'km2' });
    expect(resKm2.result).toBe(1);
  });

  it('converts volume correctly (m3 to L, mL, cm3)', () => {
    const resL = convertUnit({ category: 'volume', value: 1, fromUnitId: 'm3', toUnitId: 'l' });
    expect(resL.result).toBe(1000);

    const resMl = convertUnit({ category: 'volume', value: 1, fromUnitId: 'l', toUnitId: 'ml' });
    expect(resMl.result).toBe(1000);
  });

  it('converts weight correctly (kg, g, t, lb)', () => {
    const resT = convertUnit({ category: 'weight', value: 1000, fromUnitId: 'kg', toUnitId: 't' });
    expect(resT.result).toBe(1);

    const resLb = convertUnit({ category: 'weight', value: 1, fromUnitId: 'kg', toUnitId: 'lb' });
    expect(resLb.result).toBeCloseTo(2.20462, 3);
  });

  it('converts temperature correctly (°C, °F, K)', () => {
    const resF = convertUnit({ category: 'temperature', value: 0, fromUnitId: 'c', toUnitId: 'f' });
    expect(resF.result).toBe(32);

    const resC = convertUnit({ category: 'temperature', value: 212, fromUnitId: 'f', toUnitId: 'c' });
    expect(resC.result).toBe(100);

    const resK = convertUnit({ category: 'temperature', value: 0, fromUnitId: 'c', toUnitId: 'k' });
    expect(resK.result).toBe(273.15);
  });

  it('converts pressure correctly (bar, PSI, Pa, kPa)', () => {
    const resPsi = convertUnit({ category: 'pressure', value: 1, fromUnitId: 'bar', toUnitId: 'psi' });
    expect(resPsi.result).toBeCloseTo(14.5038, 2);

    const resKpa = convertUnit({ category: 'pressure', value: 1, fromUnitId: 'bar', toUnitId: 'kpa' });
    expect(resKpa.result).toBe(100);
  });

  it('converts flow correctly (m3/h to L/min, L/h)', () => {
    const resLmin = convertUnit({ category: 'flow', value: 6, fromUnitId: 'm3h', toUnitId: 'lmin' });
    expect(resLmin.result).toBe(100);
  });

  it('converts power and energy correctly', () => {
    const resKw = convertUnit({ category: 'power', value: 1500, fromUnitId: 'w', toUnitId: 'kw' });
    expect(resKw.result).toBe(1.5);

    const resKwh = convertUnit({ category: 'energy', value: 3600000, fromUnitId: 'j', toUnitId: 'kwh' });
    expect(resKwh.result).toBe(1);
  });

  it('handles zero and negative values gracefully', () => {
    const resZero = convertUnit({ category: 'length', value: 0, fromUnitId: 'm', toUnitId: 'km' });
    expect(resZero.result).toBe(0);

    const resNegTemp = convertUnit({ category: 'temperature', value: -40, fromUnitId: 'c', toUnitId: 'f' });
    expect(resNegTemp.result).toBe(-40);
  });

  it('returns all conversions for the selected category', () => {
    const res = convertUnit({ category: 'pressure', value: 6, fromUnitId: 'bar', toUnitId: 'psi' });
    expect(res.allConversions.length).toBe(Object.keys(UNIT_CATEGORIES.pressure.units).length);
    expect(res.allConversions.find((c) => c.unitId === 'bar')?.value).toBe(6);
  });
});
