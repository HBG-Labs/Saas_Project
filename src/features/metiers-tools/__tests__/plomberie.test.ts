import { describe, expect, it } from 'vitest';
import { plomberieTools } from '../trades/plomberie';

describe('Outils Métiers — Plomberie (Protocole de Fiabilité)', () => {
  const getTool = (slug: string) => plomberieTools.find((t) => t.slug === slug)!;

  // 1. Débit
  describe('1. Débit (debit)', () => {
    const tool = getTool('debit');

    it('Cas nominal : 60 Litres en 60 secondes = 60.0 L/min (3.60 m³/h)', () => {
      const res = tool.compute({ volume: 60, durationSeconds: 60, targetVolumeLiters: 120 });
      expect(res.primaryResult).toBe('60.0 L/min');
      expect(res.primaryUnit).toContain('3.60 m³/h');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : petit goutte-à-goutte 0.5 L en 120 s', () => {
      const res = tool.compute({ volume: 0.5, durationSeconds: 120 });
      expect(res.primaryResult).toBe('0.3 L/min');
      expect(res.status).toBe('ok');
    });

    it('Cas zéro : durée 0 (évite division par zéro)', () => {
      const res = tool.compute({ volume: 10, durationSeconds: 0 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('0.0 L/min');
    });

    it('Cas invalide : volume négatif', () => {
      const res = tool.compute({ volume: -10, durationSeconds: 30 });
      expect(res.status).toBe('warning');
    });
  });

  // 2. Canalisation
  describe('2. Canalisation (canalisation)', () => {
    const tool = getTool('canalisation');

    it('Cas nominal : tube DN 20 (20 mm int.) sur 10 m = 3.14 Litres', () => {
      const res = tool.compute({ length: 10, diameter: '20' });
      expect(res.primaryResult).toBe('3.14 Litres');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : collecteur DN 100 sur 100 m = 785.40 Litres', () => {
      const res = tool.compute({ length: 100, diameter: '100' });
      expect(res.primaryResult).toBe('785.40 Litres');
      expect(res.status).toBe('ok');
    });

    it('Cas zéro : longueur 0', () => {
      const res = tool.compute({ length: 0, diameter: '14' });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : longueur négative', () => {
      const res = tool.compute({ length: -20, diameter: '14' });
      expect(res.status).toBe('warning');
    });
  });

  // 3. Perte de charge
  describe('3. Perte de charge (perte-charge)', () => {
    const tool = getTool('perte-charge');

    it('Cas nominal : 18 L/min sur 25 m en tube Ø14 mm', () => {
      const res = tool.compute({ flowRate: 18, pipeLength: 25, innerDiameter: 14, material: '0.007', elbowsCount: 4 });
      expect(res.primaryResult).toContain('bar');
      expect(res.status).toBeDefined();
    });

    it('Cas limite : vitesse excessive (> 1.5 m/s) déclenche statut warning', () => {
      const res = tool.compute({ flowRate: 50, pipeLength: 20, innerDiameter: 12 });
      expect(res.status).toBe('warning');
      expect(res.statusMessage).toContain('Vitesse');
    });

    it('Cas zéro : débit 0', () => {
      const res = tool.compute({ flowRate: 0, pipeLength: 25, innerDiameter: 14 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('0.000 bar');
    });

    it('Cas invalide : diamètre 0 ou négatif', () => {
      const res = tool.compute({ flowRate: 20, pipeLength: 20, innerDiameter: -14 });
      expect(res.status).toBe('warning');
    });
  });

  // 4. Pente d'évacuation
  describe('4. Pente d’évacuation (pente-evacuation)', () => {
    const tool = getTool('pente-evacuation');

    it('Cas nominal : 10m à 2% (2 cm/m) = 20.0 cm de dénivelé', () => {
      const res = tool.compute({ pipeLength: 10, slopePercent: '2', diameter: '100' });
      expect(res.primaryResult).toBe('20.0 cm');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : parcours court 1.5 m à 3%', () => {
      const res = tool.compute({ pipeLength: 1.5, slopePercent: '3', diameter: '40' });
      expect(res.primaryResult).toBe('4.5 cm');
    });

    it('Cas zéro : longueur 0', () => {
      const res = tool.compute({ pipeLength: 0, slopePercent: '2' });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : longueur négative', () => {
      const res = tool.compute({ pipeLength: -5, slopePercent: '2' });
      expect(res.status).toBe('warning');
    });
  });

  // 5. Eau chaude & Énergie
  describe('5. Eau chaude (eau-chaude)', () => {
    const tool = getTool('eau-chaude');

    it('Cas nominal : 100 L de 10°C à 60°C (ΔT = 50°C) = 5.82 kWh (chauffe sous 2.4 kW)', () => {
      const res = tool.compute({ volumeLiters: 100, tempCold: 10, tempHot: 60, powerKw: 2.4, kwhPrice: 0.25 });
      expect(res.status).toBe('ok');
      const energy = res.details.find((d) => d.label.includes('Énergie'));
      expect(energy?.value).toBe('5.82 kWh');
    });

    it('Cas limite : grand ballon 300 L avec petite résistance 1.5 kW', () => {
      const res = tool.compute({ volumeLiters: 300, tempCold: 15, tempHot: 65, powerKw: 1.5, kwhPrice: 0.25 });
      expect(res.status).toBe('ok');
      expect(res.primaryResult).toContain('11h');
    });

    it('Cas zéro / incohérent : T° chaude <= T° froide', () => {
      const res = tool.compute({ volumeLiters: 200, tempCold: 60, tempHot: 40 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : puissance 0', () => {
      const res = tool.compute({ volumeLiters: 200, tempCold: 10, tempHot: 55, powerKw: 0 });
      expect(res.status).toBe('warning');
    });
  });
});
