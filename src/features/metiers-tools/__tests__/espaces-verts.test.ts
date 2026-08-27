import { describe, expect, it } from 'vitest';
import { espacesVertsTools } from '../trades/espaces-verts';

describe('Outils Métiers — Espaces Verts (Protocole de Fiabilité)', () => {
  const getTool = (slug: string) => espacesVertsTools.find((t) => t.slug === slug)!;

  // 1. Plantation
  describe('1. Plantation (plantation)', () => {
    const tool = getTool('plantation');

    it('Cas nominal : haie 20m, espacement 50cm = 41 plants', () => {
      const res = tool.compute({ plantMode: 'haie', dimension: 20, spacingCm: 50 });
      expect(res.primaryResult).toBe('41 plants');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : massif 100 m² en quinconce espacement 30 cm', () => {
      const res = tool.compute({ plantMode: 'massif', dimension: 100, spacingCm: 30, layoutPattern: 'quinconce' });
      expect(res.status).toBe('ok');
      expect(Number(res.primaryResult.replace(' plants', ''))).toBeGreaterThan(1000);
    });

    it('Cas zéro : dimension 0', () => {
      const res = tool.compute({ plantMode: 'haie', dimension: 0, spacingCm: 50 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('0 plants');
    });

    it('Cas invalide : espacement négatif', () => {
      const res = tool.compute({ plantMode: 'massif', dimension: 50, spacingCm: -30 });
      expect(res.status).toBe('warning');
    });
  });

  // 2. Gazon
  describe('2. Gazon (gazon)', () => {
    const tool = getTool('gazon');

    it('Cas nominal : 200 m² - 50 m² = 150 m² à 35 g/m² (+10% marge) = 5.8 kg', () => {
      const res = tool.compute({ totalArea: 200, excludedArea: 50, dosageGPerM2: '35' });
      expect(res.primaryResult).toBe('5.8 kg');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : rouleaux de placage (m² direct +8% chutes)', () => {
      const res = tool.compute({ totalArea: 100, excludedArea: 0, dosageGPerM2: 'turf_roll' });
      expect(res.primaryResult).toBe('108 m² de rouleaux');
      expect(res.status).toBe('ok');
    });

    it('Cas zéro : surface 0', () => {
      const res = tool.compute({ totalArea: 0, excludedArea: 0 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : surface négative', () => {
      const res = tool.compute({ totalArea: -100 });
      expect(res.status).toBe('warning');
    });
  });

  // 3. Semences
  describe('3. Semences (semences)', () => {
    const tool = getTool('semences');

    it('Cas nominal : 1000 m² à 25 g/m² = 25.00 kg (1 sac de 25 kg)', () => {
      const res = tool.compute({ areaM2: 1000, doseGPerM2: 25, bagSizeKg: 25 });
      expect(res.primaryResult).toBe('25.00 kg');
      const bags = res.details.find((d) => d.label.toLowerCase().includes('sacs'));
      expect(bags?.value).toBe('1 sacs (25 kg livrés)');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : grande prairie 2 hectares (20 000 m²)', () => {
      const res = tool.compute({ areaM2: 20000, doseGPerM2: 30, bagSizeKg: 25 });
      expect(res.primaryResult).toBe('600.00 kg');
    });

    it('Cas zéro : surface 0', () => {
      const res = tool.compute({ areaM2: 0, doseGPerM2: 25 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : dose négative', () => {
      const res = tool.compute({ areaM2: 1000, doseGPerM2: -25 });
      expect(res.status).toBe('warning');
    });
  });

  // 4. Arrosage
  describe('4. Arrosage (arrosage)', () => {
    const tool = getTool('arrosage');

    it('Cas nominal : 50 goutteurs à 4 L/h pendant 60 min = 200 Litres / cycle', () => {
      const res = tool.compute({ nozzleType: '4', emittersCount: 50, durationMinutes: 60, timesPerWeek: 3, waterPricePerM3: 4.0 });
      expect(res.primaryResult).toBe('200 Litres / cycle');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : 12 turbines (900 L/h) pendant 30 min = 5400 L / cycle', () => {
      const res = tool.compute({ nozzleType: '900', emittersCount: 12, durationMinutes: 30 });
      expect(res.primaryResult).toBe('5400 Litres / cycle');
    });

    it('Cas zéro : 0 émetteurs', () => {
      const res = tool.compute({ emittersCount: 0, durationMinutes: 30 });
      expect(res.status).toBe('ok'); // Defaulted to 1
    });

    it('Cas invalide : durée négative ou nulle', () => {
      const res = tool.compute({ emittersCount: 50, durationMinutes: 0 });
      expect(res.status).toBe('warning');
    });
  });

  // 5. Paillage
  describe('5. Paillage (paillage)', () => {
    const tool = getTool('paillage');

    it('Cas nominal : 20 m² × 10 cm sans tassement (1.0) = 2.00 m³ (2000 L)', () => {
      const res = tool.compute({ area: 20, thicknessCm: 10, settlement: '1.0' });
      expect(res.primaryResult).toBe('2.00 m³');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : 100 m² d’écorces (+15% tassement)', () => {
      const res = tool.compute({ area: 100, thicknessCm: 8, settlement: '1.15' });
      // 100 * 0.08 * 1.15 = 9.20 m³
      expect(res.primaryResult).toBe('9.20 m³');
    });

    it('Cas zéro : surface 0', () => {
      const res = tool.compute({ area: 0, thicknessCm: 8 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : épaisseur négative', () => {
      const res = tool.compute({ area: 30, thicknessCm: -8 });
      expect(res.status).toBe('warning');
    });
  });
});
