import { Sparkles } from 'lucide-react';
import { Link, Outlet } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import {
  getMinimumRequiredPlan,
  useOrganizationEntitlements,
  type FeatureKey,
} from '@/features/billing';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { ROUTES } from '@/config/routes';

export interface RequirePlanProps {
  /** Fonctionnalité que l'abonnement de l'organisation doit inclure. */
  feature: FeatureKey;
  /** Nom affiché de la section, pour un message compréhensible. */
  label: string;
}

/**
 * Réserve une branche de routes aux organisations dont l'abonnement l'inclut.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE COMPOSANT NE SÉCURISE RIEN.
 *
 * Sans l'entitlement, les policies passant par `app.can_use_pro_module`
 * renvoient un ensemble vide : la section serait accessible mais désespérément
 * vide, sans indiquer que c'est l'abonnement qui est en cause. C'est ce
 * malentendu que ce garde évite — pas un accès.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Le cas le plus délicat n'est pas l'organisation qui n'a jamais souscrit, mais
 * celle dont l'abonnement vient d'expirer : ses données existent toujours et
 * disparaissent d'un coup. Le message doit permettre de faire la différence
 * entre « cette offre ne l'inclut pas » et « quelque chose est cassé ».
 */
export function RequirePlan({ feature, label }: RequirePlanProps) {
  const { organization } = useCurrentOrganization();
  const { has, isLoading } = useOrganizationEntitlements(organization?.id ?? null);
  const { can } = usePermission();

  // Le propriétaire est envoyé là où il peut AGIR ; un technicien, là où il peut
  // comprendre. L'inverse le ferait buter sur un second mur — celui de la
  // permission — juste après le premier.
  const peutVoirFacturation = can(PERMISSIONS.billingView);
  const requiredPlan = getMinimumRequiredPlan(feature);

  if (isLoading) {
    return <LoadingScreen label="Vérification de votre formule…" />;
  }

  if (!has(feature)) {
    return (
      <EmptyState
        icon={Sparkles}
        title={`${label} nécessite la formule ${requiredPlan.name}`}
        description={`Cette fonctionnalité est disponible à partir du forfait ${requiredPlan.name} (${requiredPlan.priceMonthly} €/mois). Passez à la formule supérieure pour débloquer cet espace professionnel.`}
        action={
          <Button asChild variant="primary" size="sm">
            {peutVoirFacturation ? (
              <Link to={ROUTES.organizationBilling}>Mettre à niveau l’abonnement</Link>
            ) : (
              <Link to={ROUTES.pricing}>Découvrir les offres</Link>
            )}
          </Button>
        }
      />
    );
  }

  return <Outlet />;
}
