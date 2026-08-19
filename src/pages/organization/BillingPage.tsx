import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { computeSubscriptionPrice, PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import {
  useBillingPortal,
  useBillingSummary,
  useCancelSubscription,
  useCheckout,
  useResumeSubscription,
  useOrganizationEntitlements,
  useOrganizationSubscription,
} from '@/features/billing';
import {
  MemberQuotaBar,
  PERMISSIONS,
  useCurrentOrganization,
  useMembers,
  usePermission,
} from '@/features/organizations';

/** Les formules souscriptibles : Free est l'état par défaut, pas une offre. */
const PAYABLE_PLANS = PRICING_PLANS.filter((tier) => tier.id !== 'free');
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

/**
 * Jours entiers d'ici l'échéance, `0` si elle est absente ou passée.
 *
 * Hors du composant : `Date.now()` rend le rendu impur, ce que le compilateur
 * React refuse à juste titre. Même parti que `daysUntil` dans `TrialBanner`.
 */
function joursRestants(iso: string | null): number {
  if (iso === null) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function formatDate(value: string | null): string {
  if (value === null) return '—';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free (Gratuit)',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
  ultimate: 'Enterprise',
};

export default function BillingPage() {
  useDocumentTitle('Facturation');

  const [searchParams] = useSearchParams();
  const paymentStatus = searchParams.get('paiement');

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const subscription = useOrganizationSubscription(organizationId);
  const { planCode } = useOrganizationEntitlements(organizationId);
  const members = useMembers(organizationId);
  const summary = useBillingSummary(organizationId);
  const checkout = useCheckout(organizationId);
  const portal = useBillingPortal(organizationId);
  const cancel = useCancelSubscription(organizationId);
  const resume = useResumeSubscription(organizationId);

  const [confirmerResiliation, setConfirmerResiliation] = useState(false);

  const { can } = usePermission();
  // Masque les actions à qui ne les obtiendra pas. Cela ne SÉCURISE rien :
  // `requireBillingAccess` refuse de toute façon côté serveur. Mais proposer un
  // bouton que le serveur refusera décrit le produit, pas le travail de qui le
  // regarde.
  const canManageBilling = can(PERMISSIONS.billingManage);

  // Pendant un essai, l'entreprise ne doit RIEN. Afficher « 69 € par mois » à
  // côté d'un badge « Période d'essai » laisse croire à un prélèvement en cours.
  const enEssai = subscription.data?.status === 'trialing';

  const finDEssai = subscription.data?.trial_ends_at ?? subscription.data?.current_period_end ?? null;
  const joursDEssaiRestants = joursRestants(finDEssai);

  // Repli quand le résumé de facturation n'est pas encore chargé : compter les
  // membres actifs donne le même effectif que le serveur facturera.
  const activeMembers = (members.data ?? []).filter((member) => member.status === 'active');

  // Trois situations, et une seule sortie par situation. Le portail Stripe ne
  // s'ouvre que s'il y a quelque chose à y gérer ; sinon la résiliation se fait
  // ici. Un bouton grisé n'est une réponse dans aucun des cas : il donne à voir
  // une porte en interdisant de savoir pourquoi elle ne s'ouvre pas.
  const gereParStripe = subscription.data?.provider_subscription_id != null;
  const resiliationProgrammee = subscription.data?.cancel_at_period_end === true;

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

      {paymentStatus === 'ok' ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-500 mt-0.5" />
          <div>
            <p className="font-semibold">Paiement validé avec succès !</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Votre abonnement a été pris en compte. Vos nouvelles fonctionnalités et vos quotas sont immédiatement actifs.
            </p>
          </div>
        </div>
      ) : paymentStatus === 'annule' ? (
        <div className="rounded-xl border border-warning/40 bg-warning-subtle p-4 text-sm text-foreground flex items-start gap-3">
          <AlertCircle className="size-5 shrink-0 text-warning mt-0.5" />
          <div>
            <p className="font-semibold">Paiement non finalisé</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              La session de paiement Stripe a été interrompue. Aucun prélèvement n'a été effectué.
            </p>
          </div>
        </div>
      ) : null}

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
                <span className="text-foreground text-lg font-bold">
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
                  équipes, interventions — nécessite la formule Pro, Business ou Enterprise.
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

      {/*
        Le paiement est possible, et il l'est SANS que le client puisse décider
        de son montant : `subscriptions` reste fermée en écriture, et
        `create-checkout-session` recalcule plan, sièges et prix depuis la base.
        Ce que le navigateur envoie ici, c'est une intention — pas un tarif.
      */}
      <Card>
        <CardHeader>
          <CardTitle>Changer de formule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lerreur de résiliation saffiche dans sa fenêtre ; celle de reprise
              na pas de fenêtre, donc elle remonte ici. */}
          <FormError error={checkout.error ?? portal.error ?? resume.error} />

          {summary.data !== null && summary.data !== undefined ? (
            <div className="space-y-3">
              {/* La jauge vit ICI, au moment de choisir — et non dans une carte
                  « Consommation » séparée qui répétait la même donnée deux
                  centimètres plus haut. */}
              {members.isPending ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <MemberQuotaBar
                  current={summary.data.activeSeats}
                  max={summary.data.includedSeats}
                  planCode={planCode}
                  isBilled={summary.data.isBilled}
                />
              )}

              <p className="text-muted-foreground text-sm">
                {summary.data.extraSeats > 0
                  ? `${String(summary.data.extraSeats)} utilisateur${
                      summary.data.extraSeats > 1 ? 's' : ''
                    } au-delà des ${String(summary.data.includedSeats)} compris, à ${String(
                      summary.data.extraSeatCents / 100,
                    )} € chacun. `
                  : ''}
                {enEssai ? (
                  <>
                    Gratuit jusqu’au{' '}
                    <strong className="text-foreground">
                      {formatDate(data?.trial_ends_at ?? data?.current_period_end ?? null)}
                    </strong>
                    {/* « puis X € par mois » n'est vrai QUE si une carte est
                        enregistrée. Sans elle, l'échéance ne déclenche aucun
                        prélèvement : elle ferme les modules. Annoncer un prix
                        qui ne sera pas réclamé, c'est le travers déjà corrigé
                        sur la fenêtre d'invitation et la barre de quota. */}
                    {gereParStripe ? (
                      <>
                        , puis {(summary.data.totalCents / 100).toFixed(2)} € par mois, prélevés
                        automatiquement. Résiliable jusque-là depuis le portail.
                      </>
                    ) : (
                      <>
                        . Aucun moyen de paiement n’est enregistré : à cette date, l’entreprise
                        repasse en formule Gratuite tant que vous n’avez pas souscrit.
                      </>
                    )}
                  </>
                ) : (
                  <>
                    Soit{' '}
                    <strong className="text-foreground">
                      {(summary.data.totalCents / 100).toFixed(2)} € par mois
                    </strong>
                    .
                  </>
                )}
              </p>
            </div>
          ) : null}

          {/* LE MESSAGE QUI LÈVE LE FREIN. Souscrire pendant l'essai reprend
              désormais les jours restants : la carte est enregistrée, mais rien
              n'est prélevé avant la date déjà promise. Sans cette phrase, le
              dirigeant suppose l'inverse — c'était d'ailleurs vrai jusqu'ici,
              et attendre le dernier jour lui coûtait moins cher. */}
          {enEssai && !gereParStripe && joursDEssaiRestants > 2 ? (
            <p className="border-primary/30 bg-primary/[0.06] text-muted-foreground rounded-xl border px-3 py-2 text-xs">
              Vous gardez vos <strong className="text-foreground">{joursDEssaiRestants} jours
              d’essai</strong> : en souscrivant maintenant, rien n’est prélevé avant le{' '}
              <strong className="text-foreground">
                {formatDate(data?.trial_ends_at ?? data?.current_period_end ?? null)}
              </strong>
              , et vous pouvez renoncer d’ici là.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {PAYABLE_PLANS.map((tier) => {
              const isCurrent = tier.id === planCode;
              const seats = summary.data?.activeSeats ?? activeMembers.length;
              // Ce que coûterait CETTE formule à l'effectif actuel. Un montant
              // annoncé avant de cliquer vaut mieux qu'une surprise sur la page
              // de paiement — et il vient de la même formule que le serveur.
              // N'apparaît que s'il dépasse le forfait : le répéter à
              // l'identique sur les formules assez larges ferait du bruit là où
              // il doit servir d'avertissement.
              const projete = computeSubscriptionPrice(tier.id, seats);
              const auDela = Math.max(0, seats - tier.includedUsers);

              return (
                <Button
                  key={tier.id}
                  type="button"
                  variant="outline"
                  disabled={isCurrent || checkout.isPending || !canManageBilling}
                  onClick={() => checkout.mutate(tier.id)}
                  className={`h-auto sm:h-auto min-h-[82px] whitespace-normal flex-col items-start justify-center gap-1.5 p-4 text-left w-full transition-all ${
                    isCurrent
                      ? 'border-primary/60 bg-primary/5 cursor-default'
                      : 'hover:border-primary/40 hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="font-semibold text-sm">
                      {tier.name}
                      {isCurrent ? ' — formule actuelle' : ''}
                    </span>
                    {tier.popular && !isCurrent ? (
                      <span className="text-[10px] font-bold text-primary border border-primary/30 bg-primary/10 rounded-md px-1.5 py-0.5">
                        Populaire
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-0.5 text-2xs">
                    <span className="font-medium text-foreground">
                      {tier.priceMonthly} € / mois · {tier.includedUsers} utilisateur
                      {tier.includedUsers > 1 ? 's' : ''} inclus
                    </span>
                    <span className="font-normal text-muted-foreground">
                      +{tier.additionalUserPriceMonthly} € / mois par utilisateur supplémentaire
                    </span>
                    {auDela > 0 ? (
                      <span className="font-semibold text-warning">
                        {projete} € pour vos {seats} — {auDela} au-delà à{' '}
                        {tier.additionalUserPriceMonthly} €
                      </span>
                    ) : null}
                  </div>
                </Button>
              );
            })}
          </div>

          {!canManageBilling ? (
            <p className="text-muted-foreground text-xs">
              Seul le propriétaire de l’entreprise peut modifier l’abonnement. Le serveur applique
              la même règle : un autre rôle serait refusé.
            </p>
          ) : null}

          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-muted-foreground text-sm">
              {gereParStripe ? (
                'Moyen de paiement, factures et résiliation.'
              ) : resiliationProgrammee ? (
                <>
                  Résiliation programmée. Vous gardez l’accès complet jusqu’au{' '}
                  <strong className="text-foreground">
                    {formatDate(data?.current_period_end ?? null)}
                  </strong>
                  , puis l’entreprise repasse en formule Gratuite.
                </>
              ) : (
                'Le portail Stripe — cartes et factures — s’ouvrira dès votre premier paiement.'
              )}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to={ROUTES.pricing}>
                  Comparer les formules
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>

              {gereParStripe ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={portal.isPending || !canManageBilling}
                  onClick={() => portal.mutate()}
                >
                  {portal.isPending ? 'Ouverture…' : 'Gérer mon abonnement'}
                  <ExternalLink className="size-3.5" />
                </Button>
              ) : resiliationProgrammee ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resume.isPending || !canManageBilling}
                  onClick={() => {
                    resume.mutate();
                  }}
                >
                  {resume.isPending ? 'Reprise…' : 'Reprendre l’abonnement'}
                </Button>
              ) : data !== null && canManageBilling ? (
                <Button
                  type="button"
                  variant="danger-outline"
                  size="sm"
                  onClick={() => {
                    setConfirmerResiliation(true);
                  }}
                >
                  Résilier
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* La résiliation ne coupe rien sur-le-champ, mais elle engage : mieux
          vaut la dire en toutes lettres, avec la date, que de la faire tenir
          dans un bouton. */}
      <Modal
        open={confirmerResiliation}
        onOpenChange={setConfirmerResiliation}
        title="Résilier l’abonnement"
        description="Vous ne perdez rien aujourd’hui."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={cancel.isPending}
              onClick={() => {
                setConfirmerResiliation(false);
              }}
            >
              Revenir
            </Button>
            <Button
              variant="danger-outline"
              size="sm"
              disabled={cancel.isPending}
              onClick={() => {
                cancel.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmerResiliation(false);
                  },
                });
              }}
            >
              {cancel.isPending ? 'Résiliation…' : 'Confirmer la résiliation'}
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Vous conservez l’accès complet — missions, clients, équipes, comptes rendus — jusqu’au{' '}
            <strong className="text-foreground">
              {formatDate(data?.current_period_end ?? null)}
            </strong>
            . À cette date, l’entreprise repasse en formule Gratuite.
          </p>
          <p className="text-muted-foreground">
            Ensuite, vous gardez un accès Gratuit : les calculatrices, le catalogue d’outils, trois
            favoris et dix calculs d’historique. Les modules Missions, Clients et Équipes se
            ferment.
          </p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">Rien n’est supprimé.</strong> Vos missions et vos
            clients restent en base — simplement invisibles — et réapparaissent dès une nouvelle
            souscription. Vous pouvez aussi revenir sur cette décision tant qu’elle n’a pas pris
            effet.
          </p>
          <FormError error={cancel.error} />
        </div>
      </Modal>
    </div>
  );
}
