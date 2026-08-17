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

export const PLAN_CODES = ['free', 'pro', 'business', 'ultimate'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const FEATURES = {
  catalogAccess: 'catalog_access',
  calculationHistory: 'calculation_history',
  favorites: 'favorites',
  proTools: 'pro_tools',
  exportPdf: 'export_pdf',
  exportCsv: 'export_csv',

  // Module professionnel — réservé aux plans `business` et `ultimate`.
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

  ultimate: {
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
 *
 * `free`, et pas autre chose : une organisation sans abonnement n'a AUCUNE
 * fonctionnalité professionnelle côté serveur — `app.org_plan_code()` renvoie
 * NULL et `can_use_pro_module` refuse tout. Annoncer `business` par défaut, comme
 * le faisait la version précédente, ouvrait des sections que la base laissait
 * désespérément vides, sans dire pourquoi.
 */
export const DEFAULT_PLAN: PlanCode = 'free';

/**
 * La fonctionnalité est-elle incluse dans le plan ?
 *
 * Trois cas distincts, et la nuance compte pour le message affiché :
 *   • clé absente  → la formule ne comprend pas la fonctionnalité ;
 *   • `0`          → comprise mais explicitement interdite ;
 *   • `null` ou n  → disponible, éventuellement plafonnée.
 *
 * Reproduit exactement `app.org_has_feature`, qui applique la même règle en SQL.
 */
export function planHasFeature(plan: PlanCode | null, feature: FeatureKey): boolean {
  const matrix = PLAN_FEATURES[plan ?? DEFAULT_PLAN];

  if (!(feature in matrix)) return false;

  const limit = matrix[feature];
  return limit === null || limit === undefined || limit > 0;
}

/**
 * Quota d'une fonctionnalité. `null` = illimité, ou fonctionnalité absente du
 * plan — les deux cas se distinguent par `planHasFeature`.
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
