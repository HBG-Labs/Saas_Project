import { Crown, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';

import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { useOrganizationEntitlements, useOrganizationSubscription } from '@/features/billing';
import type { SubscriptionStatus } from '@/types/database';

import { memberDisplayName, useMembers } from '../hooks/useMembers';

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'Période d’essai',
  active: 'Actif',
  past_due: 'Paiement en retard',
  canceled: 'Résilié',
  expired: 'Expiré',
};

const STATUS_VARIANTS: Record<SubscriptionStatus, NonNullable<BadgeProps['variant']>> = {
  trialing: 'info',
  active: 'success',
  past_due: 'warning',
  canceled: 'error',
  expired: 'error',
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Free (Gratuit)',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
  ultimate: 'Enterprise',
};


export function OrganizationBillingCard({ organizationId }: { organizationId: string }) {
  const subscription = useOrganizationSubscription(organizationId);
  const { planCode } = useOrganizationEntitlements(organizationId);
  const members = useMembers(organizationId);

  const owners = (members.data ?? []).filter(
    (member) => member.role === 'owner' && member.status === 'active',
  );
  const data = subscription.data ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle>Formule & Propriété de l’entreprise</CardTitle>
        {/* Mène là où l'on AGIT. « Comparer les formules » renvoyait vers la
            page tarifaire publique — informative, mais sans aucun bouton pour
            souscrire. La page Facturation, elle, ouvre la session de paiement
            et le portail Stripe. */}
        <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
          <Link to={ROUTES.organizationBilling}>
            <span>Gérer l’abonnement</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        {/* Propriétaire & Formule */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <Crown className="size-3.5 text-amber-500" aria-hidden="true" />
              {owners.length > 1 ? 'Propriétaires de l’entreprise' : 'Propriétaire de l’entreprise'}
            </p>
            {members.isPending ? (
              <Skeleton className="h-5 w-48" />
            ) : owners.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun propriétaire actif.</p>
            ) : (
              <ul className="space-y-1">
                {owners.map((owner) => (
                  <li key={owner.id} className="text-foreground text-sm font-semibold">
                    {memberDisplayName(owner)}
                    {owner.job_title !== null && owner.job_title !== '' && (
                      <span className="text-muted-foreground font-normal"> — {owner.job_title}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">Formule active</p>
            {subscription.isPending ? (
              <Skeleton className="h-6 w-36" />
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-foreground text-base font-bold">
                  {PLAN_LABELS[planCode] ?? 'Business'}
                </span>
                {data !== null ? (
                  <Badge variant={STATUS_VARIANTS[data.status]}>
                    {STATUS_LABELS[data.status]}
                  </Badge>
                ) : (
                  <Badge variant="neutral">Aucun abonnement</Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Ni période, ni jauge de consommation ICI.
            ─────────────────────────────────────────────────────────────────
            Les deux figuraient à l'identique sur la page Facturation. Deux
            affichages de la même donnée finissent par diverger — et celui
            qu'on met à jour n'est jamais celui que l'utilisateur regarde.

            Cet écran répond à « qui possède l'entreprise ». La page Facturation
            répond à « que paie-t-elle ». La formule apparaît ici parce qu'elle
            situe l'entreprise, pas pour être administrée. */}

        <p className="text-subtle-foreground text-2xs leading-relaxed border-t border-border/40 pt-2.5">
          L’abonnement est rattaché à l’entreprise, jamais aux comptes individuels. Les
          personnes invitées disposent de leur propre compte et travaillent sous cet
          abonnement : elles n’en souscrivent aucun.
        </p>
      </CardContent>
    </Card>
  );
}
