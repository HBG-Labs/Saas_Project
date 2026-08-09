import { describe, expect, it } from 'vitest';

import { PRICING_PLANS } from '@/config/pricing';
import { extractInsertTuplesAcross, MIGRATION_FILES, stripCast } from '@/test/sql-fixtures';

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
  it('déclare les trois plans du §13', () => {
    expect(PLAN_CODES).toEqual(['free', 'pro', 'business']);
  });

  it('retombe sur le plan gratuit par défaut', () => {
    expect(DEFAULT_PLAN).toBe('free');
    expect(planHasFeature(null, FEATURES.catalogAccess)).toBe(true);
    expect(planHasFeature(null, FEATURES.missions)).toBe(false);
  });

  it('réserve le module professionnel au plan Entreprise', () => {
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
    }
  });

  it('identifie les plans capables de porter une organisation', () => {
    expect(ORGANIZATION_PLANS).toEqual(['business']);
    expect(planUnlocksProModule('pro')).toBe(false);
    expect(planUnlocksProModule('business')).toBe(true);
  });

  it("conserve la limite d'historique du plan gratuit", () => {
    // Reprend PLAN_HISTORY_LIMITS.free, jusqu'ici appliqué côté navigateur.
    expect(planFeatureLimit('free', FEATURES.calculationHistory)).toBe(10);
    expect(planFeatureLimit('pro', FEATURES.calculationHistory)).toBeNull();
    expect(planFeatureLimit('business', FEATURES.calculationHistory)).toBeNull();
  });

  it('applique un quota de membres au plan Entreprise', () => {
    expect(planFeatureLimit('business', FEATURES.members)).toBe(25);
    // Le quota n'empêche pas la fonctionnalité d'exister.
    expect(planHasFeature('business', FEATURES.members)).toBe(true);
  });

  it('rend chaque plan au moins aussi généreux que le précédent', () => {
    const order: PlanCode[] = ['free', 'pro', 'business'];

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
  const tuples = extractInsertTuplesAcross(
    [MIGRATION_FILES.billing, MIGRATION_FILES.closure],
    'plan_features',
  );

  const seeded = new Map<string, Map<string, number | null>>();
  for (const tuple of tuples) {
    const plan = stripCast(tuple[0] ?? '');
    const feature = stripCast(tuple[1] ?? '');
    const raw = stripCast(tuple[2] ?? 'null');
    const limit = raw === 'null' ? null : Number(raw);

    if (!seeded.has(plan)) seeded.set(plan, new Map());
    seeded.get(plan)?.set(feature, limit);
  }

  it('extrait les fonctionnalités des trois plans', () => {
    expect(seeded.size).toBe(3);
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
