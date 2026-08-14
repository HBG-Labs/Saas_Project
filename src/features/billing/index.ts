/** API publique de la feature « billing ». */
export {
  DEFAULT_PLAN,
  FEATURES,
  ORGANIZATION_PLANS,
  PLAN_CODES,
  PLAN_FEATURES,
  planFeatureLimit,
  planHasFeature,
  planUnlocksProModule,
  type FeatureKey,
  type FeatureMatrix,
  type PlanCode,
} from './entitlements';

export {
  getEffectiveFeatures,
  getMySubscription,
  getOrganizationSubscription,
  getPlan,
  listPlanFeatures,
  listPlans,
  resolvePlanCode,
} from './api/billing.api';

export {
  useOrganizationEntitlements,
  useOrganizationSubscription,
  useUserEntitlements,
  type Entitlements,
} from './hooks/useEntitlements';

export { TrialBanner } from './components/TrialBanner';
