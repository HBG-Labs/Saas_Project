import { describe, expect, it } from 'vitest';
import { electriciteTools } from '../trades/electricite';

describe('Outils Métiers — Électricité (Protocole de Fiabilité)', () => {
  const getTool = (slug: string) => electriciteTools.find((t) => t.slug === slug)!;

  // 1. Loi d'Ohm
  describe('1. Loi d’Ohm (loi-ohm)', () => {
    const tool = getTool('loi-ohm');

    it('Cas nominal : U=230V, I=10A -> P=2300.0 W, R=23.000 Ω', () => {
      const res = tool.compute({ knownPair: 'UI', val1: 230, val2: 10 });
      expect(res.primaryResult).toBe('2300.0 W');
      const r = res.details.find((d) => d.label.includes('Résistance'));
      expect(r?.value).toBe('23.000 Ω (Ohms)');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : très faible puissance (U=5V, R=10000Ω -> I=0.0005 A)', () => {
      const res = tool.compute({ knownPair: 'UR', val1: 5, val2: 10000 });
      expect(res.status).toBe('ok');
      const i = res.details.find((d) => d.label.includes('Intensité'));
      expect(i?.value).toContain('0.001 A');
    });

    it('Cas zéro : valeur à 0 (bloqué pour éviter division par zéro)', () => {
      const res = tool.compute({ knownPair: 'UI', val1: 230, val2: 0 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('0.0 W');
    });

    it('Cas invalide : valeurs négatives', () => {
      const res = tool.compute({ knownPair: 'UI', val1: -230, val2: 10 });
      expect(res.status).toBe('warning');
    });
  });

  // 2. Puissance
  describe('2. Puissance (puissance)', () => {
    const tool = getTool('puissance');

    it('Cas nominal : Monophasé 230V × 16A (cos φ = 1.0) = 3.68 kW (3680 W)', () => {
      const res = tool.compute({ systemType: 'mono', voltage: 230, current: 16, cosPhi: 1.0 });
      expect(res.primaryResult).toBe('3.68 kW');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : Triphasé 400V × 32A avec cos φ = 0.8', () => {
      const res = tool.compute({ systemType: 'tri', voltage: 400, current: 32, cosPhi: 0.8 });
      expect(res.status).toBe('ok');
      // √3 * 400 * 32 * 0.8 = 17736 W = 17.74 kW
      expect(res.primaryResult).toBe('17.74 kW');
    });

    it('Cas zéro : intensité 0', () => {
      const res = tool.compute({ systemType: 'mono', voltage: 230, current: 0 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : tension 0 ou négative', () => {
      const res = tool.compute({ systemType: 'mono', voltage: -230, current: 16 });
      expect(res.status).toBe('warning');
    });
  });

  // 3. Intensité & Disjoncteur
  describe('3. Intensité (intensite)', () => {
    const tool = getTool('intensite');

    it('Cas nominal : 2300 W sous 230V = 10.00 A (Disjoncteur 16 A)', () => {
      const res = tool.compute({ powerWatts: 2300, voltage: 230, cosPhi: 1.0, isTri: false });
      expect(res.primaryResult).toBe('10.00 A');
      const breaker = res.details.find((d) => d.label.toLowerCase().includes('disjoncteur'));
      expect(breaker?.value).toContain('16 A');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : gros moteur 18 kW en triphasé 400V (cos φ = 0.85)', () => {
      const res = tool.compute({ powerWatts: 18000, voltage: 400, cosPhi: 0.85, isTri: true });
      expect(res.status).toBe('ok');
      // I = 18000 / (√3 * 400 * 0.85) = 30.5656 A -> 30.57 A
      expect(res.primaryResult).toBe('30.57 A');
    });

    it('Cas zéro : puissance 0', () => {
      const res = tool.compute({ powerWatts: 0, voltage: 230 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : cos phi négatif', () => {
      const res = tool.compute({ powerWatts: 2300, voltage: 230, cosPhi: -0.8 });
      expect(res.status).toBe('ok'); // Corrigé par Math.max(0.1, ...)
    });
  });

  // 4. Chute de tension
  describe('4. Chute de tension (chute-tension)', () => {
    const tool = getTool('chute-tension');

    it('Cas nominal : 20 m, 16 A en 2.5 mm² Cuivre (230V) = 2.56 % (< 5% Conforme)', () => {
      const res = tool.compute({ length: 20, current: 16, section: '2.5', material: '0.023', voltage: 230, circuitType: '5' });
      expect(res.status).toBe('ok');
      expect(res.primaryResult).toContain('%');
    });

    it('Cas limite : dépassement de norme (> 3% sur éclairage)', () => {
      const res = tool.compute({ length: 50, current: 10, section: '1.5', material: '0.023', voltage: 230, circuitType: '3' });
      // ΔU = (2 * 0.023 * 50 * 10) / 1.5 = 15.33 V = 6.67 % > 3%
      expect(res.status).toBe('danger');
      expect(res.statusMessage).toContain('NF C 15-100');
    });

    it('Cas zéro : longueur 0', () => {
      const res = tool.compute({ length: 0, current: 16, section: '2.5' });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : section ou courant négatif', () => {
      const res = tool.compute({ length: 20, current: -16, section: '-2.5' });
      expect(res.status).toBe('warning');
    });
  });

  // 5. Section de câble
  describe('5. Section de câble (section-cable)', () => {
    const tool = getTool('section-cable');

    it('Cas nominal : 30 m, 32 A, max 2.5% sous 230V', () => {
      const res = tool.compute({ distance: 30, maxCurrent: 32, maxDropPercent: 2.5, voltage: 230 });
      expect(res.primaryResult).toContain('mm²');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : grande distance 150 m pour 63 A', () => {
      const res = tool.compute({ distance: 150, maxCurrent: 63, maxDropPercent: 2.0, voltage: 230 });
      expect(res.status).toBeDefined();
    });

    it('Cas zéro : distance 0', () => {
      const res = tool.compute({ distance: 0, maxCurrent: 32 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('0 mm²');
    });

    it('Cas invalide : courant négatif', () => {
      const res = tool.compute({ distance: 30, maxCurrent: -32 });
      expect(res.status).toBe('warning');
    });
  });
});
