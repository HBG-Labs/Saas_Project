import { describe, expect, it } from 'vitest';

import { PRICING_PLANS } from '@/config/pricing';
import {
  extractDeletedValuesAcross,
  extractInsertTuplesAcross,
  MIGRATION_FILES,
  stripCast,
} from '@/test/sql-fixtures';

import {
  DEFAULT_PLAN,
  FEATURES,
  ORGANIZATION_PLANS,
  PLAN_CODES,
  PLAN_FEATURES,
  planFeatureLimit,
  planHasFeature,
  planUnlocksProModule,
  type FeatureKey,
  type PlanCode,
} from './entitlements';

describe('matrice des entitlements', () => {
  it('déclare les quatre plans du système tarifaire', () => {
    expect(PLAN_CODES).toEqual(['free', 'pro', 'business', 'ultimate']);
  });

  it('retombe sur le plan gratuit par défaut', () => {
    expect(DEFAULT_PLAN).toBe('free');
    expect(planHasFeature(null, FEATURES.catalogAccess)).toBe(true);
    expect(planHasFeature(null, FEATURES.missions)).toBe(false);
  });

  it('réserve le module professionnel aux plans Business et Ultimate', () => {
    const proOnly: FeatureKey[] = [
      FEATURES.organizations,
      FEATURES.teams,
      FEATURES.missions,
      FEATURES.interventions,
      FEATURES.interventionReview,
      FEATURES.auditLog,
      FEATURES.attachments,
    ];

    for (const feature of proOnly) {
      expect(planHasFeature('free', feature), `free ne doit pas avoir ${feature}`).toBe(false);
      expect(planHasFeature('pro', feature), `pro ne doit pas avoir ${feature}`).toBe(false);
      expect(planHasFeature('business', feature), `business doit avoir ${feature}`).toBe(true);
      expect(planHasFeature('ultimate', feature), `ultimate doit avoir ${feature}`).toBe(true);
    }
  });

  it('identifie les plans capables de porter une organisation', () => {
    expect(ORGANIZATION_PLANS).toEqual(['business', 'ultimate']);
    expect(planUnlocksProModule('pro')).toBe(false);
    expect(planUnlocksProModule('business')).toBe(true);
    expect(planUnlocksProModule('ultimate')).toBe(true);
  });

  it("conserve la limite d'historique du plan gratuit", () => {
    expect(planFeatureLimit('free', FEATURES.calculationHistory)).toBe(10);
    expect(planFeatureLimit('pro', FEATURES.calculationHistory)).toBeNull();
    expect(planFeatureLimit('business', FEATURES.calculationHistory)).toBeNull();
    expect(planFeatureLimit('ultimate', FEATURES.calculationHistory)).toBeNull();
  });

  it('applique un quota de membres aux plans Business et Ultimate', () => {
    expect(planFeatureLimit('business', FEATURES.members)).toBe(10);
    expect(planFeatureLimit('ultimate', FEATURES.members)).toBe(20);
    expect(planHasFeature('business', FEATURES.members)).toBe(true);
    expect(planHasFeature('ultimate', FEATURES.members)).toBe(true);
  });

  it('rend chaque plan au moins aussi généreux que le précédent', () => {
    const order: PlanCode[] = ['free', 'pro', 'business', 'ultimate'];

    for (let i = 0; i < order.length - 1; i += 1) {
      const lower = order[i]!;
      const higher = order[i + 1]!;

      for (const feature of Object.keys(PLAN_FEATURES[lower]) as FeatureKey[]) {
        expect(
          planHasFeature(higher, feature),
          `« ${higher} » devrait inclure « ${feature} », présente dans « ${lower} »`,
        ).toBe(true);
      }
    }
  });
});

describe('cohérence avec la grille tarifaire publique', () => {
  it("n'affiche aucune offre dont le code n'existe pas en base", () => {
    // Le troisième palier s'appelait « team » côté marketing et « business » en
    // base. `resolvePlanCode` faisant retomber tout code inconnu sur `free`, un
    // abonné aurait silencieusement perdu ses droits. Ce test rend la
    // divergence impossible à réintroduire.
    for (const tier of PRICING_PLANS) {
      expect(PLAN_CODES, `l'offre « ${tier.name} » annonce un code inconnu`).toContain(tier.id);
    }
  });

  it('propose une offre pour chaque plan actif', () => {
    const advertised = PRICING_PLANS.map((tier) => tier.id).sort();
    expect(advertised).toEqual([...PLAN_CODES].sort());
  });
});

describe('synchronisation avec le seed SQL', () => {
  // L'entitlement du module Clients a été ajouté avec la table `customers`,
  // dans une migration ultérieure au seed d'origine.
  // L'ordre compte : `ultimate` arrive en dernier et son `on conflict do update`
  // corrige le quota de membres du plan Entreprise. Lire les migrations dans
  // l'ordre chronologique reproduit l'état réel de la table.
  const tuples = extractInsertTuplesAcross(
    [
      MIGRATION_FILES.billing,
      MIGRATION_FILES.closure,
      MIGRATION_FILES.ultimate,
      MIGRATION_FILES.equipment,
      MIGRATION_FILES.quotes,
      MIGRATION_FILES.planning,
      MIGRATION_FILES.locations,
      MIGRATION_FILES.retireTracking,
    ],
    'plan_features',
  );

  // `live_tracking` a été retiré des formules avec l'abandon du suivi GPS.
  const revoked = extractDeletedValuesAcross(
    [MIGRATION_FILES.retireTracking],
    'plan_features',
    'feature_key',
  );

  const seeded = new Map<string, Map<string, number | null>>();
  for (const tuple of tuples) {
    const plan = stripCast(tuple[0] ?? '');
    const feature = stripCast(tuple[1] ?? '');
    const raw = stripCast(tuple[2] ?? 'null');
    const limit = raw === 'null' ? null : Number(raw);

    if (revoked.has(feature)) continue;
    if (!seeded.has(plan)) seeded.set(plan, new Map());
    seeded.get(plan)?.set(feature, limit);
  }

  it('extrait les fonctionnalités des quatre plans', () => {
    expect(seeded.size).toBe(4);
    expect(tuples.length).toBeGreaterThan(20);
  });

  it('déclare exactement les mêmes fonctionnalités que le miroir TypeScript', () => {
    for (const plan of PLAN_CODES) {
      const fromSql = [...(seeded.get(plan)?.keys() ?? [])].sort();
      const fromTs = Object.keys(PLAN_FEATURES[plan]).sort();

      expect(fromTs, `divergence de fonctionnalités pour « ${plan} »`).toEqual(fromSql);
    }
  });

  it('déclare exactement les mêmes quotas', () => {
    for (const plan of PLAN_CODES) {
      for (const [feature, limit] of seeded.get(plan) ?? []) {
        expect(
          planFeatureLimit(plan, feature as FeatureKey),
          `quota divergent : ${plan}.${feature}`,
        ).toBe(limit);
      }
    }
  });

  it('utilise exclusivement des clés déclarées dans FEATURES', () => {
    const known = new Set<string>(Object.values(FEATURES));

    for (const [plan, features] of seeded) {
      for (const feature of features.keys()) {
        expect(known, `« ${feature} » (plan ${plan}) absente de FEATURES`).toContain(feature);
      }
    }
  });
});
