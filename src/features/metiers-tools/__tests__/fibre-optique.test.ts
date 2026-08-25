import { describe, expect, it } from 'vitest';
import { fibreOptiqueTools } from '../trades/fibre-optique';

describe('Outils Métiers — Fibre Optique (Protocole de Fiabilité)', () => {
  const getTool = (slug: string) => fibreOptiqueTools.find((t) => t.slug === slug)!;

  // 1. Budget optique
  describe('1. Budget optique (budget-optique)', () => {
    const tool = getTool('budget-optique');

    it('Cas nominal : Tx=+3.0 dBm, Rx=-27.0 dBm (budget 30 dB), pertes 20 dB = 10.00 dB de marge', () => {
      const res = tool.compute({ txPowerDbm: 3.0, rxSensitivityDbm: -27.0, totalLossesDb: 20.0, safetyMarginRequired: 3.0 });
      expect(res.primaryResult).toBe('10.00 dB de marge');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : liaison rompue (pertes excessives supérieures au budget)', () => {
      const res = tool.compute({ txPowerDbm: 2.0, rxSensitivityDbm: -28.0, totalLossesDb: 35.0 });
      expect(res.status).toBe('danger');
      expect(res.statusMessage).toContain('Liaison non opérationnelle');
    });

    it('Cas zéro : pertes nulles (0 dB)', () => {
      const res = tool.compute({ txPowerDbm: 0, rxSensitivityDbm: -30, totalLossesDb: 0 });
      expect(res.status).toBe('ok');
      expect(res.primaryResult).toBe('30.00 dB de marge');
    });

    it('Cas invalide : valeurs aberrantes protégées', () => {
      const res = tool.compute({ txPowerDbm: NaN, rxSensitivityDbm: undefined, totalLossesDb: null });
      expect(res.status).toBeDefined();
    });
  });

  // 2. Longueur fibre
  describe('2. Longueur fibre (longueur-fibre)', () => {
    const tool = getTool('longueur-fibre');

    it('Cas nominal : 200m tracé, 2 chambres (20m), 1 poteau (8m), 1 boîtier (15m), marge 0% = 243 mètres', () => {
      const res = tool.compute({ linearDistance: 200, manholesCount: 2, poleRisingsCount: 1, splicesEnclosures: 1, pullMarginPercent: 0 });
      expect(res.primaryResult).toBe('243 mètres');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : long tracé FTTH 2000m avec 20 chambres et 10% marge', () => {
      const res = tool.compute({ linearDistance: 2000, manholesCount: 20, poleRisingsCount: 5, splicesEnclosures: 4, pullMarginPercent: 10 });
      expect(res.status).toBe('ok');
      // Subtotal = 2000 + 200 + 40 + 60 = 2300 * 1.1 = 2530m
      expect(res.primaryResult).toBe('2530 mètres');
    });

    it('Cas zéro : distance linéaire 0', () => {
      const res = tool.compute({ linearDistance: 0 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('0 mètres');
    });

    it('Cas invalide : distance négative', () => {
      const res = tool.compute({ linearDistance: -100 });
      expect(res.status).toBe('warning');
    });
  });

  // 3. Pertes optiques
  describe('3. Pertes optiques (pertes-optiques)', () => {
    const tool = getTool('pertes-optiques');

    it('Cas nominal : 10 km à 1310 nm (0.35 dB/km = 3.5 dB) + 2 conn (0.7 dB) + 4 soudures (0.2 dB) = 4.40 dB', () => {
      const res = tool.compute({ fiberLengthKm: 10, wavelength: '0.35', connectorsCount: 2, splicesCount: 4, splitterRatio: '0' });
      expect(res.primaryResult).toBe('4.40 dB');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : réseau GPON avec splitter 1:64 (21.0 dB de perte)', () => {
      const res = tool.compute({ fiberLengthKm: 15, wavelength: '0.25', connectorsCount: 4, splicesCount: 8, splitterRatio: '21.0' });
      expect(res.status).toBe('ok');
      // 15*0.25=3.75 + 4*0.35=1.4 + 8*0.05=0.4 + 21 = 26.55 dB
      expect(res.primaryResult).toBe('26.55 dB');
    });

    it('Cas zéro : longueur 0', () => {
      const res = tool.compute({ fiberLengthKm: 0 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('0.00 dB');
    });

    it('Cas invalide : longueur négative', () => {
      const res = tool.compute({ fiberLengthKm: -10 });
      expect(res.status).toBe('warning');
    });
  });

  // 4. FO Convertisseur
  describe('4. Convertisseur FO (fo)', () => {
    const tool = getTool('fo');

    it('Cas nominal : 0 dBm = 1.000 mW | Tronçon 4 km, perte 1.0 dB = 0.250 dB/km', () => {
      const res = tool.compute({ powerDbm: 0, sectionLossDb: 1.0, sectionLengthKm: 4.0 });
      expect(res.primaryResult).toBe('1.000 mW');
      const loss = res.details.find((d) => d.label.includes('Atténuation'));
      expect(loss?.value).toBe('0.250 dB / km');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : signal faible (-30 dBm = 1.00 µW)', () => {
      const res = tool.compute({ powerDbm: -30 });
      expect(res.primaryResult).toBe('1.00 µW');
      expect(res.status).toBe('ok');
    });

    it('Cas zéro : perte de 0 dB', () => {
      const res = tool.compute({ powerDbm: 10, sectionLossDb: 0, sectionLengthKm: 5 });
      expect(res.primaryResult).toBe('10.000 mW');
      expect(res.status).toBe('ok');
    });

    it('Cas invalide : longueur de tronçon 0 (évite division par zéro)', () => {
      const res = tool.compute({ powerDbm: 0, sectionLossDb: 2, sectionLengthKm: 0 });
      expect(res.status).toBe('ok');
      expect(res.primaryResult).toBe('1.000 mW');
    });
  });
});
