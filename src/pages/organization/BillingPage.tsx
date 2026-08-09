import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  FEATURES,
  useOrganizationEntitlements,
  useOrganizationSubscription,
} from '@/features/billing';
import { MemberQuotaBar, useCurrentOrganization, useMembers } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { SubscriptionStatus } from '@/types/database';

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'Période d’essai',
  active: 'Actif',
  past_due: 'Paiement en retard',
  canceled: 'Résilié',
  expired: 'Expiré',
};

/**
 * `past_due` est un avertissement, pas une erreur : `app.org_has_feature`
 * conserve délibérément les droits dans cet état — une équipe en intervention ne
 * doit pas être bloquée par un incident de carte bancaire. `canceled` et
 * `expired` les retirent, d'où le rouge.
 */
const STATUS_VARIANTS: Record<SubscriptionStatus, NonNullable<BadgeProps['variant']>> = {
  trialing: 'info',
  active: 'success',
  past_due: 'warning',
  canceled: 'error',
  expired: 'error',
};

function formatDate(value: string | null): string {
  if (value === null) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function BillingPage() {
  useDocumentTitle('Facturation');

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const subscription = useOrganizationSubscription(organizationId);
  const { planCode, limit } = useOrganizationEntitlements(organizationId);
  const members = useMembers(organizationId);

  const activeMembers = (members.data ?? []).filter((member) => member.status === 'active');
  const memberLimit = limit(FEATURES.members);

  if (subscription.isError) {
    return (
      <ErrorState
        error={subscription.error}
        onRetry={() => {
          void subscription.refetch();
        }}
      />
    );
  }

  const data = subscription.data ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Facturation"
        description="Formule de l’entreprise et consommation associée."
      />

      <Card>
        <CardHeader>
          <CardTitle>Formule en cours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-foreground text-lg font-semibold capitalize">
                  {planCode === 'business' ? 'Entreprise' : planCode === 'pro' ? 'Pro' : 'Gratuit'}
                </span>
                {data !== null ? (
                  <Badge variant={STATUS_VARIANTS[data.status]}>
                    {STATUS_LABELS[data.status]}
                  </Badge>
                ) : (
                  <Badge variant="neutral">Aucun abonnement</Badge>
                )}
              </div>

              {data !== null ? (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground text-xs">Début de période</dt>
                    <dd className="text-foreground font-mono tabular-nums">
                      {formatDate(data.current_period_start)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Fin de période</dt>
                    <dd className="text-foreground font-mono tabular-nums">
                      {formatDate(data.current_period_end)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Cette entreprise n’a pas d’abonnement actif. Le module professionnel — missions,
                  équipes, clients — nécessite la formule Entreprise.
                </p>
              )}

              {data?.status === 'past_due' ? (
                <p className="border-warning/40 bg-warning-subtle text-foreground rounded-lg border p-3 text-xs">
                  Le dernier paiement n’a pas abouti. Vos accès sont maintenus pour le moment, mais
                  ils seront suspendus si la situation n’est pas régularisée.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {memberLimit !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Consommation</CardTitle>
          </CardHeader>
          <CardContent>
            {members.isPending ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <MemberQuotaBar current={activeMembers.length} max={memberLimit} />
            )}
          </CardContent>
        </Card>
      ) : null}

      {/*
        Aucune action de paiement : `subscriptions` est fermée en écriture au
        client — l'y autoriser reviendrait à laisser chacun s'attribuer la
        formule Entreprise. L'abonnement sera alimenté par le webhook Stripe,
        avec le rôle `service_role`, en Phase 12.
      */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <p className="text-muted-foreground text-sm">
            Le changement de formule en ligne arrive prochainement.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.pricing}>
              Comparer les formules
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
