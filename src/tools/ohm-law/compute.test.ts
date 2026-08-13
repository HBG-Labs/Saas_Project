import { describe, expect, it } from 'vitest';

import { computeOhmLaw } from './compute';

describe('computeOhmLaw', () => {
  describe('Formule U = R * I (Calcul de la Tension)', () => {
    it('calcule correctement U = 50 Ω * 2 A = 100 V', () => {
      const res = computeOhmLaw({
        target: 'U',
        resistance: 50,
        resistanceUnit: 'Ω',
        current: 2,
        currentUnit: 'A',
        voltageUnit: 'V',
      });

      expect(res.success).toBe(true);
      expect(res.value).toBe(100);
      expect(res.unit).toBe('V');
      expect(res.formattedValue).toContain('100 V');
      expect(res.formulaUsed).toBe('U = R × I');
    });

    it('gère les conversions d\'unités : 1 kΩ * 20 mA = 20 V', () => {
      const res = computeOhmLaw({
        target: 'U',
        resistance: 1,
        resistanceUnit: 'kΩ', // 1000 Ω
        current: 20,
        currentUnit: 'mA', // 0.02 A
        voltageUnit: 'V',
      });

      expect(res.success).toBe(true);
      expect(res.value).toBe(20);
      expect(res.formattedValue).toContain('20 V');
    });

    it('gère les conversions en mV : 100 Ω * 5 mA = 500 mV', () => {
      const res = computeOhmLaw({
        target: 'U',
        resistance: 100,
        resistanceUnit: 'Ω',
        current: 5,
        currentUnit: 'mA',
        voltageUnit: 'mV',
      });

      expect(res.success).toBe(true);
      expect(res.value).toBe(500);
      expect(res.unit).toBe('mV');
    });
  });

  describe('Formule I = U / R (Calcul de l\'Intensité)', () => {
    it('calcule correctement I = 230 V / 10 Ω = 23 A', () => {
      const res = computeOhmLaw({
        target: 'I',
        voltage: 230,
        voltageUnit: 'V',
        resistance: 10,
        resistanceUnit: 'Ω',
        currentUnit: 'A',
      });

      expect(res.success).toBe(true);
      expect(res.value).toBe(23);
      expect(res.unit).toBe('A');
      expect(res.formulaUsed).toBe('I = U / R');
    });

    it('gère les conversions d\'unités : 12 V / 1 kΩ = 12 mA', () => {
      const res = computeOhmLaw({
        target: 'I',
        voltage: 12,
        voltageUnit: 'V',
        resistance: 1,
        resistanceUnit: 'kΩ',
        currentUnit: 'mA',
      });

      expect(res.success).toBe(true);
      expect(res.value).toBe(12);
      expect(res.unit).toBe('mA');
    });

    it('détecte la division par zéro lorsque R = 0', () => {
      const res = computeOhmLaw({
        target: 'I',
        voltage: 12,
        voltageUnit: 'V',
        resistance: 0,
        resistanceUnit: 'Ω',
        currentUnit: 'A',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Division par zéro impossible');
    });
  });

  describe('Formule R = U / I (Calcul de la Résistance)', () => {
    it('calcule correctement R = 12 V / 3 A = 4 Ω', () => {
      const res = computeOhmLaw({
        target: 'R',
        voltage: 12,
        voltageUnit: 'V',
        current: 3,
        currentUnit: 'A',
        resistanceUnit: 'Ω',
      });

      expect(res.success).toBe(true);
      expect(res.value).toBe(4);
      expect(res.unit).toBe('Ω');
      expect(res.formulaUsed).toBe('R = U / I');
    });

    it('gère la conversion en MΩ : 1 kV / 1 mA = 1 MΩ', () => {
      const res = computeOhmLaw({
        target: 'R',
        voltage: 1,
        voltageUnit: 'kV', // 1000 V
        current: 1,
        currentUnit: 'mA', // 0.001 A
        resistanceUnit: 'MΩ', // 1,000,000 Ω
      });

      expect(res.success).toBe(true);
      expect(res.value).toBe(1);
      expect(res.unit).toBe('MΩ');
    });

    it('détecte la division par zéro lorsque I = 0', () => {
      const res = computeOhmLaw({
        target: 'R',
        voltage: 230,
        voltageUnit: 'V',
        current: 0,
        currentUnit: 'A',
        resistanceUnit: 'Ω',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Division par zéro impossible');
    });
  });

  describe('Validation des saisies & Cas limites', () => {
    it('détecte les champs manquants', () => {
      const res = computeOhmLaw({
        target: 'U',
        resistance: 10,
        resistanceUnit: 'Ω',
        current: undefined,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Veuillez saisir');
    });

    it('rejette les valeurs négatives', () => {
      const res = computeOhmLaw({
        target: 'U',
        resistance: -10,
        resistanceUnit: 'Ω',
        current: 2,
        currentUnit: 'A',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('positives');
    });

    it('prend en charge la virgule dans les saisies sous forme de chaîne', () => {
      const res = computeOhmLaw({
        target: 'U',
        resistance: '2,5',
        resistanceUnit: 'Ω',
        current: '4',
        currentUnit: 'A',
      });

      expect(res.success).toBe(true);
      expect(res.value).toBe(10);
    });
  });
});
