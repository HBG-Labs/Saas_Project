import { Sparkles } from 'lucide-react';
import { Link, Outlet } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { useOrganizationEntitlements, type FeatureKey } from '@/features/billing';
import { useCurrentOrganization } from '@/features/organizations';
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

  if (isLoading) {
    return <LoadingScreen label="Vérification de votre formule…" />;
  }

  if (!has(feature)) {
    return (
      <EmptyState
        icon={Sparkles}
        title={`${label} nécessite la formule Entreprise`}
        description="Cette section fait partie du module professionnel. Si votre entreprise y était abonnée, vérifiez l’état de la facturation : un abonnement expiré rend ces données inaccessibles sans les supprimer."
        action={
          <Button asChild variant="primary" size="sm">
            <Link to={ROUTES.pricing}>Voir les formules</Link>
          </Button>
        }
      />
    );
  }

  return <Outlet />;
}
