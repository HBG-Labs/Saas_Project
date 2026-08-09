/**
 * Fonctionnalités débloquées par plan — miroir de `plan_features`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI CHANGE PAR RAPPORT À L'EXISTANT
 *
 * Les limitations vivaient dans deux fichiers TypeScript et s'appliquaient dans
 * un `useState` : `useCalculationHistory` exposait `setUserPlan`, et un bouton
 * du composant `ScientificCalculatorTool` faisait passer l'utilisateur en Pro.
 * Autrement dit, le plan était une préférence locale.
 *
 * Désormais la décision appartient à PostgreSQL. Ce fichier ne fait que
 * REFLÉTER la table pour que l'interface sache quoi afficher — il ne décide
 * plus d'aucun droit. `entitlements.test.ts` vérifie l'égalité avec le seed
 * SQL, de sorte que le reflet ne puisse pas mentir.
 *
 * Source : supabase/migrations/20260808100300_billing.sql
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const PLAN_CODES = ['free', 'pro', 'business'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const FEATURES = {
  catalogAccess: 'catalog_access',
  calculationHistory: 'calculation_history',
  favorites: 'favorites',
  proTools: 'pro_tools',
  exportPdf: 'export_pdf',
  exportCsv: 'export_csv',

  // Module professionnel — réservé au plan `business`.
  organizations: 'organizations',
  customers: 'customers',
  teams: 'teams',
  members: 'members',
  missions: 'missions',
  interventions: 'interventions',
  interventionReview: 'intervention_review',
  auditLog: 'audit_log',
  statistics: 'statistics',
  attachments: 'attachments',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * `null` = illimité · `0` = explicitement interdit · `n` = quota.
 * L'ABSENCE de clé signifie que la fonctionnalité n'est pas incluse dans le
 * plan — distinction volontaire avec `0`, qui décrit une interdiction assumée.
 */
export type FeatureMatrix = Partial<Record<FeatureKey, number | null>>;

export const PLAN_FEATURES: Record<PlanCode, FeatureMatrix> = {
  free: {
    catalog_access: null,
    calculation_history: 10,
    favorites: 3,
  },

  pro: {
    catalog_access: null,
    calculation_history: null,
    favorites: null,
    pro_tools: null,
    export_pdf: null,
    export_csv: null,
  },

  business: {
    catalog_access: null,
    calculation_history: null,
    favorites: null,
    pro_tools: null,
    export_pdf: null,
    export_csv: null,
    organizations: null,
    // Le nombre de clients ne distingue pas les offres : c'est l'accès au
    // module qui les distingue. L'absence de cette clé pour `free` et `pro`
    // suffit à le refuser.
    customers: null,
    teams: null,
    members: 25,
    missions: null,
    interventions: null,
    intervention_review: null,
    audit_log: null,
    statistics: null,
    attachments: null,
  },
};

/** Le plan par défaut de tout compte sans abonnement actif. */
export const DEFAULT_PLAN: PlanCode = 'free';

export function planHasFeature(plan: PlanCode | null, feature: FeatureKey): boolean {
  const matrix = PLAN_FEATURES[plan ?? DEFAULT_PLAN];
  if (!(feature in matrix)) return false;

  // `0` vaut interdiction explicite : la clé existe, mais le quota est nul.
  return matrix[feature] !== 0;
}

/**
 * Quota d'une fonctionnalité. `null` couvre deux cas — illimité, ou absent du
 * plan. Levez l'ambiguïté avec `planHasFeature()` quand elle compte.
 */
export function planFeatureLimit(plan: PlanCode | null, feature: FeatureKey): number | null {
  return PLAN_FEATURES[plan ?? DEFAULT_PLAN][feature] ?? null;
}

/** Le plan débloque-t-il le module professionnel (organisations, équipes, missions) ? */
export function planUnlocksProModule(plan: PlanCode | null): boolean {
  return planHasFeature(plan, FEATURES.organizations);
}

/** Plans capables de porter une organisation — utile aux parcours d'inscription. */
export const ORGANIZATION_PLANS: readonly PlanCode[] = PLAN_CODES.filter((code) =>
  planUnlocksProModule(code),
);
