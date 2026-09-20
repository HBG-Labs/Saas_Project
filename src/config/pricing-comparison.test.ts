import { describe, expect, it } from 'vitest';

import { PLAN_CODES, planFeatureLimit, planHasFeature } from '@/features/billing/entitlements';

import { COMPARISON_FEATURES, formatNumber } from './pricing-comparison';

/*
  La page Tarifs ne doit jamais vendre ce que la base refuse, ni taire ce
  qu'elle accorde. Les lignes à quota sont dérivées des entitlements ; ce test
  vérifie que la dérivation dit la même chose que `planHasFeature`.
*/

const ligne = (nom: string) => {
  const row = COMPARISON_FEATURES.find((r) => r.name.startsWith(nom));
  if (!row) throw new Error(`Ligne « ${nom} » absente de la matrice`);
  return row;
};

describe('matrice de comparaison des tarifs', () => {
  it('a une valeur pour chacune des cinq formules, sur chaque ligne', () => {
    for (const row of COMPARISON_FEATURES) {
      for (const plan of PLAN_CODES) {
        expect(row[plan], `${row.name} / ${plan}`).not.toBeUndefined();
      }
    }
  });

  it("suit les entitlements pour l'Assistant IA", () => {
    const row = ligne('Assistant IA');
    for (const plan of PLAN_CODES) {
      const attendu = planHasFeature(plan, 'ai_assistant');
      expect(row[plan] !== false, `${plan}`).toBe(attendu);
      if (attendu) {
        expect(row[plan]).toBe(
          `${formatNumber(planFeatureLimit(plan, 'ai_assistant') ?? 0)} req./mois`,
        );
      }
    }
  });

  it('suit les entitlements pour la transcription vocale', () => {
    const row = ligne('Enregistrement vocal');
    expect(row.free).toBe(false);
    expect(row.starter).toBe(false);
    expect(row.pro).toBe('120 min/mois');
    expect(row.business).toBe('600 min/mois');
    // Espace fine insécable du format français : c'est bien « 3 000 ».
    expect(row.enterprise).toBe(`${formatNumber(3000)} min/mois`);
  });

  it('accorde le Workspace à toutes les formules (D6)', () => {
    const row = ligne('Workspace');
    for (const plan of PLAN_CODES) expect(row[plan]).toBe(true);
  });
});
