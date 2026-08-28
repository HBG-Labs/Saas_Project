/** API publique de la feature « billing ». */
export {
  DEFAULT_PLAN,
  FEATURES,
  ORGANIZATION_PLANS,
  PLAN_CODES,
  PLAN_FEATURES,
  getMinimumRequiredPlan,
  planFeatureLimit,
  planHasFeature,
  planUnlocksProModule,
  type FeatureKey,
  type FeatureMatrix,
  type PlanCode,
  type RequiredPlanInfo,
} from './entitlements';

export {
  createBillingPortalSession,
  createCheckoutSession,
  getBillingSummary,
  getEffectiveFeatures,
  getMySubscription,
  getOrganizationSubscription,
  getPlan,
  listPlanFeatures,
  listPlans,
  resolvePlanCode,
  syncSubscriptionSeats,
  updateSubscriptionPlan,
  type BillingSummary,
} from './api/billing.api';

export {
  useBillingPortal,
  useCancelSubscription,
  useBillingSummary,
  useCheckout,
  useResumeSubscription,
  useUpdateSubscriptionPlan,
} from './hooks/useCheckout';
export { useSeatBilling, type SeatBilling } from './hooks/useSeatBilling';

export {
  useOrganizationEntitlements,
  useOrganizationSubscription,
  useUserEntitlements,
  type Entitlements,
} from './hooks/useEntitlements';

export { TrialBanner } from './components/TrialBanner';
export { ProToolUpgradeModal, type ProToolUpgradeModalProps } from './components/ProToolUpgradeModal';
