import { Crown, ReceiptText, Users } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useOrganizationSubscription } from '@/features/billing';

import { memberDisplayName, useMembers } from '../hooks/useMembers';

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trialing: 'Période d’essai',
  active: 'Actif',
  past_due: 'Paiement en retard',
  canceled: 'Résilié',
  expired: 'Expiré',
};

/**
 * Qui possède l'entreprise, et qui paie.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CET ENCART
 *
 * Le modèle distingue deux choses que l'interface confondait : la personne qui
 * a créé l'entreprise et souscrit — propriétaire — et celles qu'elle a invitées
 * ensuite. Chacune a son propre compte, son propre profil, son propre rôle ;
 * aucune n'a d'abonnement personnel. L'abonnement appartient à l'ORGANISATION,
 * ce que la contrainte `subscriptions_subject_xor` impose en base.
 *
 * Le dire à l'écran évite la question qui revient sans cesse : « qui est
 * facturé quand j'ajoute un technicien ? » Personne d'autre que l'entreprise —
 * seul le quota de membres du plan s'applique.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * L'abonnement n'est lu que par qui détient `billing.view`. Pour les autres, la
 * requête renvoie zéro ligne : l'encart montre alors la propriété sans la
 * facturation, plutôt qu'une erreur.
 */
export function OwnershipCard({ organizationId }: { organizationId: string }) {
  const members = useMembers(organizationId);
  const subscription = useOrganizationSubscription(organizationId);

  const owners = (members.data ?? []).filter(
    (member) => member.role === 'owner' && member.status === 'active',
  );
  const activeCount = (members.data ?? []).filter((member) => member.status === 'active').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Propriété & abonnement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <Crown className="size-3.5" aria-hidden="true" />
            {owners.length > 1 ? 'Propriétaires' : 'Propriétaire'}
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

        <div className="border-border space-y-2 border-t pt-4">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <ReceiptText className="size-3.5" aria-hidden="true" />
            Abonnement
          </p>

          {subscription.isPending ? (
            <Skeleton className="h-5 w-40" />
          ) : subscription.data === null || subscription.data === undefined ? (
            <p className="text-muted-foreground text-sm">
              Aucun abonnement lisible depuis ce compte.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-foreground text-sm font-semibold capitalize">
                {subscription.data.plan_code}
              </span>
              <Badge variant={subscription.data.status === 'active' ? 'success' : 'warning'}>
                {SUBSCRIPTION_LABELS[subscription.data.status] ?? subscription.data.status}
              </Badge>
            </div>
          )}

          <p className="text-muted-foreground text-xs leading-relaxed">
            L’abonnement est rattaché à l’entreprise, jamais aux comptes individuels. Les
            personnes invitées disposent de leur propre compte et travaillent sous cet
            abonnement : elles n’en souscrivent aucun.
          </p>
        </div>

        <div className="border-border flex items-center gap-1.5 border-t pt-4 text-xs">
          <Users className="text-muted-foreground size-3.5" aria-hidden="true" />
          <span className="text-muted-foreground">
            {members.isPending
              ? 'Chargement des membres…'
              : `${activeCount} membre${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
