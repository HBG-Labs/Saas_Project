/**
 * Fonctionnalités débloquées par plan — miroir de `plan_features`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Grille tarifaire officielle NexoraTech :
 * - FREE       (0 €)  : 1 utilisateur (monocompte strict, pas de siège supp)
 * - STARTER    (19 €) : 2 utilisateurs inclus (+5 €/user supp/mois)
 * - PRO ⭐    (39 €) : 5 utilisateurs inclus (+5 €/user supp/mois, Recommandé)
 * - BUSINESS   (69 €) : 10 utilisateurs inclus (+5 €/user supp/mois)
 * - ENTERPRISE (99 €) : 20 utilisateurs inclus (+5 €/user supp/mois, illimité)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const PLAN_CODES = ['free', 'starter', 'pro', 'business', 'enterprise'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const FEATURES = {
  catalogAccess: 'catalog_access',
  calculationHistory: 'calculation_history',
  favorites: 'favorites',
  proTools: 'pro_tools',
  exportPdf: 'export_pdf',
  exportCsv: 'export_csv',

  // Module professionnel — organisations, équipes, missions, membres, etc.
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
  equipment: 'equipment',
  quotes: 'quotes',
  planning: 'planning',
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

  starter: {
    catalog_access: null,
    calculation_history: null,
    favorites: null,
    pro_tools: null,
    export_pdf: null,
    export_csv: null,
    organizations: null,
    members: 2,
  },

  pro: {
    catalog_access: null,
    calculation_history: null,
    favorites: null,
    pro_tools: null,
    export_pdf: null,
    export_csv: null,
    organizations: null,
    customers: null,
    teams: null,
    members: 5,
    missions: null,
    interventions: null,
    equipment: null,
    quotes: null,
  },

  business: {
    catalog_access: null,
    calculation_history: null,
    favorites: null,
    pro_tools: null,
    export_pdf: null,
    export_csv: null,
    organizations: null,
    customers: null,
    teams: null,
    members: 10,
    missions: null,
    interventions: null,
    intervention_review: null,
    audit_log: null,
    statistics: null,
    attachments: null,
    equipment: null,
    quotes: null,
    planning: null,
  },

  enterprise: {
    catalog_access: null,
    calculation_history: null,
    favorites: null,
    pro_tools: null,
    export_pdf: null,
    export_csv: null,
    organizations: null,
    customers: null,
    teams: null,
    members: 20,
    missions: null,
    interventions: null,
    intervention_review: null,
    audit_log: null,
    statistics: null,
    attachments: null,
    equipment: null,
    quotes: null,
    planning: null,
  },
};

/**
 * Plan retenu en l'absence d'abonnement lisible.
 */
export const DEFAULT_PLAN: PlanCode = 'free';

/**
 * La fonctionnalité est-elle incluse dans le plan ?
 */
export function planHasFeature(plan: PlanCode | null, feature: FeatureKey): boolean {
  const matrix = PLAN_FEATURES[plan ?? DEFAULT_PLAN] ?? PLAN_FEATURES.free;

  if (!(feature in matrix)) return false;

  const limit = matrix[feature];
  return limit === null || limit === undefined || limit > 0;
}

/**
 * Quota d'une fonctionnalité. `null` = illimité, ou fonctionnalité absente du
 * plan — les deux cas se distinguent par `planHasFeature`.
 */
export function planFeatureLimit(plan: PlanCode | null, feature: FeatureKey): number | null {
  return (PLAN_FEATURES[plan ?? DEFAULT_PLAN] ?? PLAN_FEATURES.free)[feature] ?? null;
}

/** Le plan débloque-t-il le module professionnel (organisations, équipes, missions) ? */
export function planUnlocksProModule(plan: PlanCode | null): boolean {
  return planHasFeature(plan, FEATURES.organizations);
}

/** Plans capables de porter une organisation — utile aux parcours d'inscription. */
export const ORGANIZATION_PLANS: readonly PlanCode[] = PLAN_CODES.filter((code) =>
  planUnlocksProModule(code),
);
