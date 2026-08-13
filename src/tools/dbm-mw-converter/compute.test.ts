import { describe, expect, it } from 'vitest';
import {
  computeDbmMwConversion,
  convertPower,
  convertVoltage,
  convertCurrent,
  convertTerminated,
  convertFieldStrength,
  convertDistance,
} from './compute';

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

describe('Module de Conversion Universel 6 Domaines', () => {
  it('convertit la puissance (dBm, W, dBW)', () => {
    const res = convertPower(30, 'dbm');
    expect(res.dbm).toBe(30);
    expect(res.mw).toBe(1000);
    expect(res.w).toBe(1);
    expect(res.dbw).toBe(0);
  });

  it('convertit la tension (Volt, dBu, dBµV)', () => {
    const res = convertVoltage(1, 'v');
    expect(res.v).toBe(1);
    expect(res.mv).toBe(1000);
    expect(res.dbv).toBe(0);
    expect(res.dbuv).toBe(120);
  });

  it('convertit le courant (Ampères, dBµA)', () => {
    const res = convertCurrent(1, 'a');
    expect(res.a).toBe(1);
    expect(res.ma).toBe(1000);
    expect(res.dbua).toBe(120);
  });

  it('convertit la terminaison RF sous 50Ω', () => {
    const res = convertTerminated(0, 'dbm', 50);
    expect(res.dbm).toBe(0);
    // 90 + 10·log10(50) = 106,9897. Les tables RF arrondissent à 107 ; la
    // comparaison porte donc sur la décimale, pas sur l'entier de commodité.
    expect(res.dbuv).toBeCloseTo(107, 1);
    expect(res.vrms).toBeCloseTo(0.2236, 3);
  });

  it('convertit l’intensité du champ (dBµV/m ↔ V/m)', () => {
    const res = convertFieldStrength(120, 'dbuv_m');
    expect(res.dbuv_m).toBe(120);
    expect(res.v_m).toBe(1);
  });

  it('convertit les distances (mètres, km, pieds, pouces)', () => {
    const res = convertDistance(1000, 'm');
    expect(res.km).toBe(1);
    expect(res.m).toBe(1000);
  });
});
