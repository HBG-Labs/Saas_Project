import { describe, expect, it } from 'vitest';
import { computeFiberAttenuation, getAttenuationPerKm } from './compute';

describe('computeFiberAttenuation', () => {
  it('calcule correctement l’atténuation linéique à 1310nm', () => {
    expect(getAttenuationPerKm('1310')).toBe(0.35);
  });

  it('calcule correctement l’atténuation linéique à 1550nm', () => {
    expect(getAttenuationPerKm('1550')).toBe(0.21);
  });

  it('calcule un bilan de liaison FTTH type (10 km, 4 épissures, 2 connecteurs)', () => {
    const result = computeFiberAttenuation({
      wavelength: '1310',
      distanceKm: 10,
      splicesCount: 4,
      spliceLossDb: 0.05,
      connectorsCount: 2,
      connectorLossDb: 0.5,
      safetyMarginDb: 1.5,
    });

    // Fiber : 10 * 0.35 = 3.5 dB
    // Splices : 4 * 0.05 = 0.2 dB
    // Connectors : 2 * 0.5 = 1.0 dB
    // Total : 3.5 + 0.2 + 1.0 = 4.7 dB
    // With margin : 4.7 + 1.5 = 6.2 dB
    expect(result.fiberLossDb).toBe(3.5);
    expect(result.splicesLossDb).toBe(0.2);
    expect(result.connectorsLossDb).toBe(1.0);
    expect(result.totalLossDb).toBe(4.7);
    expect(result.totalWithMarginDb).toBe(6.2);
    expect(result.isCompliant).toBe(true);
  });
});
