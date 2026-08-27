import { describe, expect, it } from 'vitest';
import { btpTools } from '../trades/btp';

describe('Outils Métiers — BTP & Maçonnerie (Protocole de Fiabilité)', () => {
  const getTool = (slug: string) => btpTools.find((t) => t.slug === slug)!;

  // 1. Béton
  describe('1. Béton (beton)', () => {
    const tool = getTool('beton');

    it('Cas nominal : 10m × 4m × 0.15m = 6.00 m³ (marge 0%)', () => {
      const res = tool.compute({ length: 10, width: 4, thickness: 15, margin: 0, dosage: 350, bagWeight: 35 });
      expect(res.primaryResult).toBe('6.00 m³');
      expect(res.status).toBe('ok');
      const bags = res.details.find((d) => d.label.includes('ciment'));
      expect(bags?.value).toContain('60 sacs (2100 kg)');
    });

    it('Cas limite : très petite chape 1m × 1m × 1cm', () => {
      const res = tool.compute({ length: 1, width: 1, thickness: 1, margin: 0 });
      expect(res.primaryResult).toBe('0.01 m³');
      expect(res.status).toBe('ok');
    });

    it('Cas zéro : dimension 0 renvoie avertissement sans NaN', () => {
      const res = tool.compute({ length: 0, width: 4, thickness: 15 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('0.00 m³');
    });

    it('Cas invalide / négatif : valeurs négatives bloquées', () => {
      const res = tool.compute({ length: -5, width: -2, thickness: -10 });
      expect(res.status).toBe('warning');
      expect(res.statusMessage).toBeDefined();
    });
  });

  // 2. Tranchée
  describe('2. Tranchée (tranchee)', () => {
    const tool = getTool('tranchee');

    it('Cas nominal : 10m × 0.5m × 1.0m = 5.00 m³ en place, foisonné × 1.25 = 6.25 m³', () => {
      const res = tool.compute({ length: 10, width: 0.5, depth: 1.0, soilType: '1.25' });
      expect(res.primaryResult).toBe('5.00 m³');
      const swell = res.details.find((d) => d.label.includes('foisonné'));
      expect(swell?.value).toBe('6.25 m³');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : tranchée profonde 100m × 2m × 3m', () => {
      const res = tool.compute({ length: 100, width: 2, depth: 3, soilType: '1.40' });
      expect(res.primaryResult).toBe('600.00 m³');
      const trucks = res.details.find((d) => d.label.includes('bennes'));
      expect(trucks?.value).toContain('105 rotations');
    });

    it('Cas zéro : longueur 0', () => {
      const res = tool.compute({ length: 0, width: 0.6, depth: 0.9 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('0.00 m³');
    });

    it('Cas invalide : profondeur négative ou NaN', () => {
      const res = tool.compute({ length: 'invalid', width: -1, depth: NaN });
      expect(res.status).toBe('warning');
    });
  });

  // 3. Fondations
  describe('3. Fondations (fondation)', () => {
    const tool = getTool('fondation');

    it('Cas nominal : semelle filante 40m × 0.5m × 0.3m (+5% marge) = 6.30 m³', () => {
      const res = tool.compute({ type: 'filante', length: 40, width: 0.5, height: 0.3, count: 1, margin: 5 });
      expect(res.primaryResult).toBe('6.30 m³');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : 20 plots isolés 1m × 1m × 0.5m (+0% marge) = 10.00 m³', () => {
      const res = tool.compute({ type: 'isolee', length: 1, width: 1, height: 0.5, count: 20, margin: 0 });
      expect(res.primaryResult).toBe('10.00 m³');
      expect(res.status).toBe('ok');
    });

    it('Cas zéro : hauteur 0', () => {
      const res = tool.compute({ length: 40, width: 0.5, height: 0 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : dimensions négatives', () => {
      const res = tool.compute({ length: -10, width: -0.5, height: -0.3 });
      expect(res.status).toBe('warning');
    });
  });

  // 4. Parpaings
  describe('4. Parpaings (parpaings)', () => {
    const tool = getTool('parpaings');

    it('Cas nominal : 12m × 2.5m = 30 m² - 4 m² ouvertures = 26 m² net (+5% marge) = 273 parpaings', () => {
      const res = tool.compute({ wallLength: 12, wallHeight: 2.5, openingsArea: 4, margin: 5 });
      expect(res.primaryResult).toBe('273 parpaings');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : mur sans ouverture et marge 0% (10m × 2m = 20 m² = 200 parpaings)', () => {
      const res = tool.compute({ wallLength: 10, wallHeight: 2, openingsArea: 0, margin: 0 });
      expect(res.primaryResult).toBe('200 parpaings');
    });

    it('Cas zéro : mur de longueur 0', () => {
      const res = tool.compute({ wallLength: 0, wallHeight: 2 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('0 parpaings');
    });

    it('Cas invalide : ouvertures supérieures à la surface du mur', () => {
      const res = tool.compute({ wallLength: 5, wallHeight: 2, openingsArea: 20 });
      expect(res.primaryResult).toBe('0 parpaings');
      expect(res.status).toBe('ok');
    });
  });

  // 5. Sable
  describe('5. Sable (sable)', () => {
    const tool = getTool('sable');

    it('Cas nominal : 20 m² × 5 cm (0.05m) = 1.00 m³ × 1.6 t/m³ = 1.60 tonnes', () => {
      const res = tool.compute({ area: 20, thickness: 5, density: 1.6, margin: 0 });
      expect(res.primaryResult).toBe('1.60 tonnes');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : 500 m² d’emprise sous dallage', () => {
      const res = tool.compute({ area: 500, thickness: 10, density: 1.6, margin: 10 });
      expect(res.status).toBe('ok');
      expect(Number(res.primaryResult.replace(' tonnes', ''))).toBeGreaterThan(80);
    });

    it('Cas zéro : surface 0', () => {
      const res = tool.compute({ area: 0, thickness: 5 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : épaisseur négative', () => {
      const res = tool.compute({ area: 20, thickness: -5 });
      expect(res.status).toBe('warning');
    });
  });

  // 6. Gravier
  describe('6. Gravier (gravier)', () => {
    const tool = getTool('gravier');

    it('Cas nominal : 50 m² × 6 cm (0.06m) = 3 m³ × 1.5 t/m³ = 4.50 tonnes', () => {
      const res = tool.compute({ area: 50, thickness: 6, gravelType: '1.5', margin: 0 });
      expect(res.primaryResult).toBe('4.50 tonnes');
    });

    it('Cas limite : grande allée 200 m²', () => {
      const res = tool.compute({ area: 200, thickness: 5, gravelType: '1.6', margin: 5 });
      expect(res.status).toBe('ok');
    });

    it('Cas zéro : surface 0', () => {
      const res = tool.compute({ area: 0, thickness: 6 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : valeurs indéfinies / null', () => {
      const res = tool.compute({ area: null, thickness: undefined });
      expect(res.status).toBe('warning');
    });
  });

  // 7. Pente
  describe('7. Pente (pente)', () => {
    const tool = getTool('pente');

    it('Cas nominal : 20m distance, 1m dénivelé = 5.00 % (Conforme PMR)', () => {
      const res = tool.compute({ horizontalDist: 20, drop: 1.0 });
      expect(res.primaryResult).toBe('5.00 %');
      expect(res.status).toBe('ok');
      const pmr = res.details.find((d) => d.label.includes('PMR'));
      expect(pmr?.badgeVariant).toBe('success');
    });

    it('Cas limite PMR court : 2m distance, 0.16m dénivelé = 8.00 % (Toléré ≤ 2m)', () => {
      const res = tool.compute({ horizontalDist: 2, drop: 0.16 });
      expect(res.primaryResult).toBe('8.00 %');
      const pmr = res.details.find((d) => d.label.includes('PMR'));
      expect(pmr?.badgeVariant).toBe('warning');
    });

    it('Cas zéro : distance 0 (évite division par zéro)', () => {
      const res = tool.compute({ horizontalDist: 0, drop: 1 });
      expect(res.status).toBe('warning');
      expect(res.primaryResult).toBe('0.00 %');
    });

    it('Cas invalide : dénivelé négatif', () => {
      const res = tool.compute({ horizontalDist: 10, drop: -1 });
      expect(res.status).toBe('warning');
    });
  });

  // 8. Escalier (Loi de Blondel)
  describe('8. Escalier (escalier)', () => {
    const tool = getTool('escalier');

    it('Cas nominal : 280 cm sol à sol, cible 17.5 cm = 16 marches de 17.5 cm (Blondel 63.0 cm)', () => {
      const res = tool.compute({ totalHeight: 280, targetStepHeight: 17.5, treadWidth: 28 });
      expect(res.primaryResult).toBe('16 marches');
      expect(res.status).toBe('ok');
      const blondel = res.details.find((d) => d.label.includes('Blondel'));
      expect(blondel?.value).toBe('63.0 cm');
    });

    it('Cas limite : pas de Blondel trop grand (alerte confort)', () => {
      const res = tool.compute({ totalHeight: 200, targetStepHeight: 22, treadWidth: 35 });
      expect(res.status).toBe('warning');
      expect(res.statusMessage).toContain('Blondel');
    });

    it('Cas zéro : hauteur 0', () => {
      const res = tool.compute({ totalHeight: 0, targetStepHeight: 17.5, treadWidth: 28 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : giron négatif', () => {
      const res = tool.compute({ totalHeight: 280, targetStepHeight: 17.5, treadWidth: -28 });
      expect(res.status).toBe('warning');
    });
  });

  // 9. Toiture
  describe('9. Toiture (toiture)', () => {
    const tool = getTool('toiture');

    it('Cas nominal : bâtiment 10m × 8m avec débord 0.5m (11 × 9 = 99 m²), pente 40% (développé > 99 m²)', () => {
      const res = tool.compute({ groundLength: 10, groundWidth: 8, overhang: 0.5, slopePercent: 40, tilesPerM2: 14 });
      expect(res.status).toBe('ok');
      expect(Number(res.primaryResult.replace(' m²', ''))).toBeGreaterThan(99);
    });

    it('Cas limite : toiture plate (pente 5%)', () => {
      const res = tool.compute({ groundLength: 10, groundWidth: 10, overhang: 0, slopePercent: 5, tilesPerM2: 10 });
      expect(res.status).toBe('ok');
      expect(res.primaryResult).toContain('100.');
    });

    it('Cas zéro : longueur 0', () => {
      const res = tool.compute({ groundLength: 0, groundWidth: 8 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : dimensions négatives', () => {
      const res = tool.compute({ groundLength: -10, groundWidth: -8 });
      expect(res.status).toBe('warning');
    });
  });

  // 10. Peinture
  describe('10. Peinture (peinture)', () => {
    const tool = getTool('peinture');

    it('Cas nominal : 50 m² - 5 m² = 45 m² × 2 couches / 10 m²/L (+10% marge) = 9.9 L', () => {
      const res = tool.compute({ wallArea: 50, openings: 5, layers: 2, yieldPerLiter: 10, pricePerLiter: 15 });
      expect(res.primaryResult).toBe('9.9 Litres');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : mono-couche rendement élevé', () => {
      const res = tool.compute({ wallArea: 100, openings: 0, layers: 1, yieldPerLiter: 12 });
      expect(res.status).toBe('ok');
    });

    it('Cas zéro : surface 0', () => {
      const res = tool.compute({ wallArea: 0 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : surface négative', () => {
      const res = tool.compute({ wallArea: -50 });
      expect(res.status).toBe('warning');
    });
  });

  // 11. Carrelage
  describe('11. Carrelage (carrelage)', () => {
    const tool = getTool('carrelage');

    it('Cas nominal : 30 m² en carreaux 60×60 cm (0.36 m²) pose droite (+7% marge)', () => {
      const res = tool.compute({ area: 30, tileLength: 60, tileWidth: 60, poseType: '7', m2PerBox: 1.44 });
      expect(res.primaryResult).toContain('carreaux');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : petits carreaux 10×10 cm en diagonale (+15% marge)', () => {
      const res = tool.compute({ area: 10, tileLength: 10, tileWidth: 10, poseType: '15', m2PerBox: 1.0 });
      expect(res.status).toBe('ok');
      expect(res.primaryResult).toBe('1150 carreaux');
    });

    it('Cas zéro : surface 0', () => {
      const res = tool.compute({ area: 0, tileLength: 60, tileWidth: 60 });
      expect(res.status).toBe('warning');
    });

    it('Cas invalide : dimension carreau 0 ou négative', () => {
      const res = tool.compute({ area: 30, tileLength: 0, tileWidth: -10 });
      expect(res.status).toBe('warning');
    });
  });

  // 12. Matériaux
  describe('12. Matériaux (materiaux)', () => {
    const tool = getTool('materiaux');

    it('Cas nominal : 500 € HT + 0% marge + 20% TVA = 600.00 € TTC', () => {
      const res = tool.compute({ qty1: 100, price1: 2, qty2: 10, price2: 30, lossMargin: 0, tvaRate: '20' });
      expect(res.primaryResult).toBe('600.00 € TTC');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : taux TVA 5.5% et marge de perte 10%', () => {
      const res = tool.compute({ qty1: 10, price1: 100, lossMargin: 10, tvaRate: '5.5' });
      // 1000 * 1.10 = 1100 HT * 1.055 = 1160.50 TTC
      expect(res.primaryResult).toBe('1160.50 € TTC');
    });

    it('Cas zéro : toutes quantités à 0 = 0.00 € TTC', () => {
      const res = tool.compute({ qty1: 0, price1: 0, qty2: 0, price2: 0 });
      expect(res.primaryResult).toBe('0.00 € TTC');
      expect(res.status).toBe('ok');
    });

    it('Cas invalide : quantités ou prix négatifs (automatiquement ramenés à 0)', () => {
      const res = tool.compute({ qty1: -10, price1: -50 });
      expect(res.primaryResult).toBe('0.00 € TTC');
    });
  });

  // 13. Devis BTP
  describe('13. Devis BTP (devis)', () => {
    const tool = getTool('devis');

    it('Cas nominal : Fournitures 1000€ (+20% marge = 1200€) + MO 10h×50€ (500€) + Déplacement 100€ = 1800€ HT (+20% TVA) = 2160.00 € TTC', () => {
      const res = tool.compute({ materialsCost: 1000, marginPercent: 20, laborHours: 10, hourlyRate: 50, travelCost: 100, tvaRate: '20' });
      expect(res.primaryResult).toBe('2160.00 € TTC');
      expect(res.status).toBe('ok');
    });

    it('Cas limite : main d’œuvre seule sans fournitures (0€)', () => {
      const res = tool.compute({ materialsCost: 0, laborHours: 8, hourlyRate: 45, travelCost: 0, tvaRate: '10' });
      // 360 HT * 1.10 = 396 TTC
      expect(res.primaryResult).toBe('396.00 € TTC');
    });

    it('Cas zéro : devis à blanc', () => {
      const res = tool.compute({ materialsCost: 0, laborHours: 0, travelCost: 0 });
      expect(res.primaryResult).toBe('0.00 € TTC');
      expect(res.status).toBe('ok');
    });

    it('Cas invalide : valeurs négatives protégées', () => {
      const res = tool.compute({ materialsCost: -500, laborHours: -10 });
      expect(res.primaryResult).toBe('0.00 € TTC');
    });
  });
});
