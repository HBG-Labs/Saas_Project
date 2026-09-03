import { describe, expect, it } from 'vitest';

import { computeSubscriptionPrice, PRICING_PLANS } from '@/config/pricing';
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
  it('déclare les cinq plans du système tarifaire officiel', () => {
    expect(PLAN_CODES).toEqual(['free', 'starter', 'pro', 'business', 'enterprise']);
  });

  it('retombe sur le plan gratuit par défaut', () => {
    expect(DEFAULT_PLAN).toBe('free');
    expect(planHasFeature(null, FEATURES.catalogAccess)).toBe(true);

    // Un abonnement illisible ne doit rien débloquer de plus que la formule
    // gratuite. On le vérifie sur `quotes`, qu'elle n'inclut pas — et non sur
    // `missions`, qu'elle inclut désormais sous plafond.
    expect(planHasFeature(null, FEATURES.quotes)).toBe(false);
    for (const feature of Object.values(FEATURES)) {
      expect(planHasFeature(null, feature), `plan illisible : ${feature}`).toBe(
        planHasFeature('free', feature),
      );
    }
  });

  it('ouvre les missions, interventions et devis dès le plan Starter', () => {
    const starterFeatures: FeatureKey[] = [
      FEATURES.missions,
      FEATURES.interventions,
      FEATURES.quotes,
      FEATURES.customers,
    ];

    for (const feature of starterFeatures) {
      expect(planHasFeature('starter', feature), `starter doit avoir ${feature}`).toBe(true);
      expect(planHasFeature('pro', feature), `pro doit avoir ${feature}`).toBe(true);
      expect(planHasFeature('business', feature), `business doit avoir ${feature}`).toBe(true);
      expect(planHasFeature('enterprise', feature), `enterprise doit avoir ${feature}`).toBe(true);
    }
  });

  it('laisse la formule gratuite parcourir la chaîne complète, sous plafond', () => {
    // Une formule gratuite qui ne montre rien ne convertit personne : un artisan
    // qui n'a jamais vu une intervention se créer n'a aucune raison de sortir sa
    // carte. Le plafond, lui, est appliqué par le serveur
    // (`app.enforce_plan_row_quota`) et non par l'interface.
    expect(planFeatureLimit('free', FEATURES.customers)).toBe(3);
    expect(planFeatureLimit('free', FEATURES.missions)).toBe(5);
    expect(planFeatureLimit('free', FEATURES.interventions)).toBe(10);

    for (const feature of [FEATURES.customers, FEATURES.missions, FEATURES.interventions]) {
      expect(planHasFeature('free', feature), `free doit pouvoir essayer ${feature}`).toBe(true);
    }
  });

  it('garde la facturation et le pilotage hors de la formule gratuite', () => {
    // Ce sont ces modules qu'on achète : les ouvrir viderait les formules
    // payantes de leur raison d'être.
    const payantes: FeatureKey[] = [
      FEATURES.quotes,
      FEATURES.teams,
      FEATURES.statistics,
      FEATURES.planning,
      FEATURES.auditLog,
      FEATURES.exportPdf,
      FEATURES.exportCsv,
    ];

    for (const feature of payantes) {
      expect(planHasFeature('free', feature), `free ne doit pas avoir ${feature}`).toBe(false);
    }
  });

  it('réserve les calculateurs métiers, la gestion de matériel, stocks et achats aux forfaits Pro et supérieurs', () => {
    const proExclusiveFeatures: FeatureKey[] = [
      FEATURES.proTools,
      FEATURES.equipment,
      FEATURES.stock,
      FEATURES.purchases,
    ];

    for (const feature of proExclusiveFeatures) {
      expect(planHasFeature('free', feature), `free ne doit pas avoir ${feature}`).toBe(false);
      expect(planHasFeature('starter', feature), `starter ne doit pas avoir ${feature}`).toBe(false);
      expect(planHasFeature('pro', feature), `pro doit avoir ${feature}`).toBe(true);
      expect(planHasFeature('business', feature), `business doit avoir ${feature}`).toBe(true);
      expect(planHasFeature('enterprise', feature), `enterprise doit avoir ${feature}`).toBe(true);
    }
  });

  it('identifie les plans capables de porter une organisation', () => {
    expect(ORGANIZATION_PLANS).toEqual(['starter', 'pro', 'business', 'enterprise']);
    expect(planUnlocksProModule('free')).toBe(false);
    expect(planUnlocksProModule('starter')).toBe(true);
    expect(planUnlocksProModule('pro')).toBe(true);
    expect(planUnlocksProModule('business')).toBe(true);
    expect(planUnlocksProModule('enterprise')).toBe(true);
  });

  it("conserve la limite d'historique du plan gratuit", () => {
    expect(planFeatureLimit('free', FEATURES.calculationHistory)).toBe(10);
    expect(planFeatureLimit('starter', FEATURES.calculationHistory)).toBeNull();
    expect(planFeatureLimit('pro', FEATURES.calculationHistory)).toBeNull();
    expect(planFeatureLimit('business', FEATURES.calculationHistory)).toBeNull();
    expect(planFeatureLimit('enterprise', FEATURES.calculationHistory)).toBeNull();
  });

  it('applique les quotas de membres officiels aux différents plans', () => {
    expect(planFeatureLimit('free', FEATURES.members)).toBeNull();
    expect(planFeatureLimit('starter', FEATURES.members)).toBe(2);
    expect(planFeatureLimit('pro', FEATURES.members)).toBe(5);
    expect(planFeatureLimit('business', FEATURES.members)).toBe(10);
    expect(planFeatureLimit('enterprise', FEATURES.members)).toBe(20);
  });

  it('rend chaque plan au moins aussi généreux que le précédent', () => {
    const order: PlanCode[] = ['free', 'starter', 'pro', 'business', 'enterprise'];

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

describe('calcul des tarifs et quotas', () => {
  it('calcule correctement les prix sans utilisateurs supplémentaires', () => {
    expect(computeSubscriptionPrice('free', 1)).toBe(0);
    expect(computeSubscriptionPrice('starter', 2)).toBe(19);
    expect(computeSubscriptionPrice('pro', 5)).toBe(39);
    expect(computeSubscriptionPrice('business', 10)).toBe(69);
    expect(computeSubscriptionPrice('enterprise', 20)).toBe(99);
  });

  it('calcule correctement les utilisateurs supplémentaires à +5 €/mois', () => {
    // Starter (2 inclus) avec 4 utilisateurs -> 19 + 2*5 = 29 €
    expect(computeSubscriptionPrice('starter', 4)).toBe(29);
    // Pro (5 inclus) avec 7 utilisateurs -> 39 + 2*5 = 49 €
    expect(computeSubscriptionPrice('pro', 7)).toBe(49);
    // Business (10 inclus) avec 12 utilisateurs -> 69 + 2*5 = 79 €
    expect(computeSubscriptionPrice('business', 12)).toBe(79);
    // Enterprise (20 inclus) avec 25 utilisateurs -> 99 + 5*5 = 124 €
    expect(computeSubscriptionPrice('enterprise', 25)).toBe(124);
  });

  it('le plan Free reste toujours à 0 €', () => {
    expect(computeSubscriptionPrice('free', 1)).toBe(0);
    expect(computeSubscriptionPrice('free', 5)).toBe(0);
  });
});

describe('cohérence avec la grille tarifaire publique', () => {
  it("n'affiche aucune offre dont le code n'existe pas dans le modèle", () => {
    for (const tier of PRICING_PLANS) {
      expect(PLAN_CODES, `l'offre « ${tier.name} » annonce un code inconnu`).toContain(tier.id);
    }
  });

  it('propose une offre pour chaque plan actif', () => {
    const advertised = PRICING_PLANS.map((tier) => tier.id).sort();
    expect(advertised).toEqual([...PLAN_CODES].sort());
  });

  it('attribue le badge Recommandé exclusivement au plan Pro ⭐', () => {
    const recommendedPlans = PRICING_PLANS.filter((tier) => tier.popular);
    expect(recommendedPlans).toHaveLength(1);
    expect(recommendedPlans[0]?.id).toBe('pro');
    expect(recommendedPlans[0]?.priceMonthly).toBe(39);
    expect(recommendedPlans[0]?.includedUsers).toBe(5);
  });
});

describe('synchronisation avec le seed SQL', () => {
  // La matrice est REMISE À PLAT par
  // `20260902100000_realigne_la_matrice_des_formules.sql` : ce fichier supprime
  // les cinq plans puis les réinsère d'un bloc, `stock` et `purchases` compris.
  // Lire les migrations antérieures — dont `pricing_model`, qui procédait de la
  // même façon — reconstituerait un état que la base n'a plus.
  //
  // ───────────────────────────────────────────────────────────────────────────
  // CE QUE CE TEST NE PEUT PAS VOIR
  //
  // Il lit les FICHIERS de migration, jamais le serveur. Il valide donc une
  // intention, pas un état déployé — et cette nuance a coûté cher :
  // `20260817101000_pricing_model.sql` a été modifié deux fois APRÈS son
  // application (ajout des missions, interventions, devis et clients à Starter,
  // puis retrait de `pro_tools`). Sa version étant déjà inscrite dans
  // `supabase_migrations`, `db push` la saute : les corrections ne sont jamais
  // parties en base. Fichier et TypeScript ayant été corrigés ensemble, ce test
  // est resté vert pendant qu'un client Starter à 19 €/mois se voyait refuser
  // par la RLS la création de la moindre mission.
  //
  // D'où la règle : une migration appliquée ne se corrige pas en l'éditant. On
  // en écrit une nouvelle, et ce bloc pointe vers la plus récente.
  // ───────────────────────────────────────────────────────────────────────────
  //
  // `attachmentsInPro` s'ajoute à cette même remise à plat sans la redéfinir —
  // décision explicite du 02/09/2026 : l'ajout de photos et documents,
  // jusque-là réservé à Business et Enterprise, rejoint la formule Pro. Même
  // schéma que `stock`/`purchases` après `pricing_model`.
  const tuples = extractInsertTuplesAcross(
    [MIGRATION_FILES.planMatrix, MIGRATION_FILES.attachmentsInPro],
    'plan_features',
  );

  const seeded = new Map<string, Map<string, number | null>>();
  for (const tuple of tuples) {
    const plan = stripCast(tuple[0] ?? '');
    const feature = stripCast(tuple[1] ?? '');
    const raw = stripCast(tuple[2] ?? 'null');

    if (!seeded.has(plan)) seeded.set(plan, new Map());
    seeded.get(plan)?.set(feature, raw === 'null' ? null : Number(raw));
  }

  it('sème exactement les cinq plans du miroir', () => {
    expect([...seeded.keys()].sort()).toEqual([...PLAN_CODES].sort());
  });

  it('déclare exactement les mêmes fonctionnalités que le miroir TypeScript', () => {
    // C'est CETTE assertion qui manquait. La version précédente se contentait
    // de `expect(seeded.size).toBe(4)` : elle constatait que la base avait
    // quatre plans quand le code en déclarait cinq, et inscrivait la divergence
    // dans le test au lieu de la détecter.
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

  it('accorde à chaque plan payant les sièges annoncés par la grille', () => {
    // Les sièges INCLUS et le quota `members` sont la même donnée : c'est
    // `plan_features.members` que lit `app.org_feature_limit`, donc le moteur
    // de facturation. Une divergence ici se paierait en euros.
    const expected: Record<string, number | undefined> = {
      free: undefined,
      starter: 2,
      pro: 5,
      business: 10,
      enterprise: 20,
    };

    for (const [plan, seats] of Object.entries(expected)) {
      expect(seeded.get(plan)?.get('members'), `sièges inclus de « ${plan} »`).toBe(seats);
    }
  });
});
