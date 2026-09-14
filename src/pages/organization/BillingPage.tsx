import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { computeSubscriptionPrice, PRICING_PLANS } from '@/config/pricing';
import { ROUTES } from '@/config/routes';
import {
  useBillingPortal,
  useBillingSummary,
  useCancelSubscription,
  useResumeSubscription,
  useUpdateSubscriptionPlan,
  useOrganizationEntitlements,
  useOrganizationSubscription,
  type PlanCode,
} from '@/features/billing';
import {
  MemberQuotaBar,
  OrganizationNavTabs,
  PERMISSIONS,
  useCurrentOrganization,
  useMembers,
  usePermission,
} from '@/features/organizations';

/** Les formules souscriptibles : Free est l'état par défaut, pas une offre. */
const PAYABLE_PLANS = PRICING_PLANS.filter((tier) => tier.id !== 'free');
import { useDocumentTitle } from '@/lib/use-document-title';
import type { SubscriptionStatus } from '@/types/database';

const PLAN_RANKS: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
  ultimate: 4,
};

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
  const summary = useBillingSummary(organizationId);
  const updatePlan = useUpdateSubscriptionPlan(organizationId);

  /*
    L'effectif sert de REPLI au décompte de sièges du serveur : tant que la
    synthèse de facturation n'est pas revenue, la projection s'appuie sur les
    membres actifs plutôt que d'annoncer un montant pour zéro utilisateur.
  */
  const members = useMembers(organizationId);
  const activeMembers = (members.data ?? []).filter((member) => member.status === 'active');
  const portal = useBillingPortal(organizationId);
  const cancel = useCancelSubscription(organizationId);
  const resume = useResumeSubscription(organizationId);

  const [confirmerResiliation, setConfirmerResiliation] = useState(false);
  const [planToDowngrade, setPlanToDowngrade] = useState<PlanCode | null>(null);
  const [planSuccessMessage, setPlanSuccessMessage] = useState<string | null>(null);

  const { can } = usePermission();
  // Masque les actions à qui ne les obtiendra pas. Cela ne SÉCURISE rien :
  // `requireBillingAccess` refuse de toute façon côté serveur. Mais proposer un
  // bouton que le serveur refusera décrit le produit, pas le travail de qui le
  // regarde.
  const canManageBilling = can(PERMISSIONS.billingManage);

  // Pendant un essai, l'entreprise ne doit RIEN. Afficher « 69 € par mois » à
  // côté d'un badge « Période d'essai » laisse croire à un prélèvement en cours.
  const enEssai = subscription.data?.status === 'trialing';

  const finDEssai =
    subscription.data?.trial_ends_at ?? subscription.data?.current_period_end ?? null;
  const joursDEssaiRestants = joursRestants(finDEssai);

  // Trois situations, et une seule sortie par situation. Le portail Stripe ne
  // s'ouvre que s'il y a quelque chose à y gérer ; sinon la résiliation se fait
  // ici. Un bouton grisé n'est une réponse dans aucun des cas : il donne à voir
  // une porte en interdisant de savoir pourquoi elle ne s'ouvre pas.
  const gereParStripe = subscription.data?.provider_subscription_id != null;
  const resiliationProgrammee = subscription.data?.cancel_at_period_end === true;

  const targetDowngradeTier = planToDowngrade
    ? (PAYABLE_PLANS.find((t) => t.id === planToDowngrade) ?? null)
    : null;

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
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <PageHeader
        title="Facturation"
        description="Formule de l’entreprise et consommation associée."
      />

      <OrganizationNavTabs />

      {planSuccessMessage ? (
        <div
          className="border-success/30 bg-success/10 text-success flex items-start gap-3 rounded-xl border p-4 text-sm"
          role="status"
        >
          <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{planSuccessMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setPlanSuccessMessage(null)}
            className="text-muted-foreground hover:bg-success/10 hover:text-foreground focus-visible:ring-primary -m-2 flex min-h-11 items-center rounded-md p-2 text-xs focus-visible:ring-2 focus-visible:outline-none sm:min-h-0"
          >
            Fermer
          </button>
        </div>
      ) : null}

      {paymentStatus === 'ok' ? (
        <div
          className="border-success/30 bg-success/10 text-success flex items-start gap-3 rounded-xl border p-4 text-sm"
          role="status"
        >
          <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Paiement validé avec succès !</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Votre abonnement a été pris en compte. Vos nouvelles fonctionnalités et vos quotas
              sont immédiatement actifs.
            </p>
          </div>
        </div>
      ) : paymentStatus === 'annule' ? (
        <div
          className="border-warning/40 bg-warning-subtle text-foreground flex items-start gap-3 rounded-xl border p-4 text-sm"
          role="status"
        >
          <AlertCircle className="text-warning mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Paiement non finalisé</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              La session de paiement Stripe a été interrompue. Aucun prélèvement n'a été effectué.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <CreditCard className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle>Formule en cours</CardTitle>
              <CardDescription>
                Statut de l’abonnement et prochaine échéance de votre entreprise.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="border-primary/20 bg-primary/[0.04] flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Votre formule</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-foreground text-xl font-bold tracking-tight">
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
                </div>
                <span className="bg-surface text-primary flex size-11 items-center justify-center self-start rounded-xl shadow-xs sm:self-auto">
                  <Sparkles className="size-5" />
                </span>
              </div>

              {data !== null ? (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="border-border bg-surface-raised rounded-lg border p-3">
                    <dt className="text-muted-foreground flex items-center gap-2 text-xs">
                      <CalendarDays className="text-primary size-3.5" /> Début de période
                    </dt>
                    <dd className="text-foreground mt-1 font-mono font-medium tabular-nums">
                      {formatDate(data.current_period_start)}
                    </dd>
                  </div>
                  <div className="border-border bg-surface-raised rounded-lg border p-3">
                    <dt className="text-muted-foreground flex items-center gap-2 text-xs">
                      <CalendarDays className="text-primary size-3.5" /> Fin de période
                    </dt>
                    <dd className="text-foreground mt-1 font-mono font-medium tabular-nums">
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

      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 border-b">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Users className="size-4" />
            </span>
            <div className="space-y-1">
              <CardTitle>Changer de formule</CardTitle>
              <CardDescription>
                Comparez les capacités et visualisez le coût pour votre effectif actuel.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* L'erreur s'affiche de manière claire */}
          <FormError error={updatePlan.error ?? portal.error ?? resume.error} />

          {summary.data !== null && summary.data !== undefined ? (
            <div className="border-border bg-surface-sunken/35 space-y-3 rounded-xl border p-3 sm:p-4">
              {summary.isPending ? (
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

          {enEssai && !gereParStripe && joursDEssaiRestants > 2 ? (
            <p className="border-primary/30 bg-primary/[0.06] text-muted-foreground rounded-xl border px-3 py-2.5 text-xs">
              Vous gardez vos{' '}
              <strong className="text-foreground">{joursDEssaiRestants} jours d’essai</strong> : en
              souscrivant maintenant, rien n’est prélevé avant le{' '}
              <strong className="text-foreground">
                {formatDate(data?.trial_ends_at ?? data?.current_period_end ?? null)}
              </strong>
              , et vous pouvez renoncer d’ici là.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {PAYABLE_PLANS.map((tier) => {
              const isCurrent = tier.id === planCode;
              const currentRank = PLAN_RANKS[planCode] ?? 0;
              const targetRank = PLAN_RANKS[tier.id] ?? 0;
              const isDowngrade = targetRank < currentRank;
              const seats = summary.data?.activeSeats ?? activeMembers.length;
              const projete = computeSubscriptionPrice(tier.id, seats);
              const auDela = Math.max(0, seats - tier.includedUsers);

              return (
                <Button
                  key={tier.id}
                  type="button"
                  variant="outline"
                  disabled={isCurrent || updatePlan.isPending || !canManageBilling}
                  onClick={() => {
                    if (isDowngrade && gereParStripe) {
                      setPlanToDowngrade(tier.id);
                    } else {
                      updatePlan.mutate(tier.id, {
                        onSuccess: (res) => {
                          if (res.updatedInPlace) {
                            setPlanSuccessMessage(
                              `Votre formule a été mise à jour vers ${tier.name} avec succès.`,
                            );
                          }
                        },
                      });
                    }
                  }}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={`h-auto min-h-[112px] w-full flex-col items-start justify-center gap-2 rounded-xl p-4 text-left whitespace-normal transition-[border-color,background-color,box-shadow,transform] sm:h-auto ${
                    isCurrent
                      ? 'border-primary/60 bg-primary/[0.07] cursor-default shadow-xs disabled:opacity-100'
                      : 'hover:border-primary/40 hover:bg-surface-hover hover:shadow-raised hover:-translate-y-0.5 motion-reduce:hover:translate-y-0'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {tier.name}
                      {isCurrent ? ' — actuelle' : ''}
                      {!isCurrent && isDowngrade && gereParStripe ? (
                        <ArrowDownRight className="text-warning size-3.5 shrink-0" />
                      ) : !isCurrent ? (
                        <ArrowUpRight className="text-primary size-3.5 shrink-0" />
                      ) : null}
                    </span>
                    {tier.popular && !isCurrent ? (
                      <span className="border-primary/30 bg-primary/10 text-primary rounded-md border px-1.5 py-0.5 text-[10px] font-bold">
                        Populaire
                      </span>
                    ) : null}
                  </div>
                  <div className="text-2xs flex flex-col gap-1">
                    <span className="text-foreground font-semibold">
                      {tier.priceMonthly} € / mois · {tier.includedUsers} utilisateur
                      {tier.includedUsers > 1 ? 's' : ''} inclus
                    </span>
                    <span className="text-muted-foreground font-normal">
                      +{tier.additionalUserPriceMonthly} € / mois par utilisateur supplémentaire
                    </span>
                    {auDela > 0 ? (
                      <span className="text-warning font-semibold">
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

          <div className="border-border flex flex-col items-stretch justify-between gap-4 border-t pt-4 sm:flex-row sm:items-center">
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

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button asChild variant="ghost" size="sm" className="w-full sm:w-auto">
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
                  disabled={!canManageBilling}
                  isLoading={portal.isPending}
                  loadingLabel="Ouverture du portail Stripe"
                  onClick={() => portal.mutate()}
                  trailingIcon={<ExternalLink />}
                  className="w-full sm:w-auto"
                >
                  {portal.isPending ? 'Ouverture…' : 'Gérer mon abonnement'}
                </Button>
              ) : resiliationProgrammee ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canManageBilling}
                  isLoading={resume.isPending}
                  loadingLabel="Reprise de l’abonnement"
                  onClick={() => {
                    resume.mutate();
                  }}
                  className="w-full sm:w-auto"
                >
                  {resume.isPending ? 'Reprise…' : 'Reprendre l’abonnement'}
                </Button>
              ) : data !== null && canManageBilling ? (
                <Button
                  type="button"
                  variant="danger-outline"
                  size="sm"
                  className="w-full sm:w-auto"
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

      {/* Modale de Confirmation de Rétrogradation (Downgrade) */}
      <Modal
        open={planToDowngrade !== null}
        onOpenChange={(open) => {
          if (!open) setPlanToDowngrade(null);
        }}
        title={`Rétrograder vers la formule ${targetDowngradeTier?.name ?? ''}`}
        description="Votre changement prendra effet immédiatement sans prélèvement supplémentaire."
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={updatePlan.isPending}
              className="w-full sm:w-auto"
              onClick={() => {
                setPlanToDowngrade(null);
              }}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={updatePlan.isPending}
              loadingLabel="Modification de la formule"
              className="w-full sm:w-auto"
              onClick={() => {
                if (planToDowngrade) {
                  updatePlan.mutate(planToDowngrade, {
                    onSuccess: (res) => {
                      setPlanToDowngrade(null);
                      if (res.updatedInPlace) {
                        setPlanSuccessMessage(
                          `Votre formule a été rétrogradée vers ${targetDowngradeTier?.name} avec succès.`,
                        );
                      }
                    },
                  });
                }
              }}
            >
              {updatePlan.isPending ? 'Modification…' : 'Confirmer la rétrogradation'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="border-primary/20 bg-primary/5 space-y-1.5 rounded-lg border p-3 text-xs">
            <p className="text-foreground flex items-center gap-1.5 font-semibold">
              💰 Aucun paiement immédiat requis
            </p>
            <p className="text-muted-foreground">
              Le montant non consommé de votre formule actuelle (au prorata des jours restants) sera
              automatiquement transformé en crédit et déduit de vos prochaines factures.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <p className="text-foreground font-medium">Ajustement de vos quotas :</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1">
              <li>
                Sièges inclus : passe à{' '}
                <strong className="text-foreground">
                  {targetDowngradeTier?.includedUsers ?? 0} utilisateur(s) inclus
                </strong>
                .
              </li>
              {(summary.data?.activeSeats ?? 0) > (targetDowngradeTier?.includedUsers ?? 0) ? (
                <li className="text-warning">
                  Vos {summary.data?.activeSeats} membres actifs restent conservés. Les{' '}
                  {(summary.data?.activeSeats ?? 0) - (targetDowngradeTier?.includedUsers ?? 0)}{' '}
                  siège(s) en supplément seront facturés à +5 €/mois chacun.
                </li>
              ) : (
                <li>Aucun dépassement de siège à ce jour.</li>
              )}
            </ul>
          </div>

          <FormError error={updatePlan.error} />
        </div>
      </Modal>

      {/* Modale de Résiliation */}
      <Modal
        open={confirmerResiliation}
        onOpenChange={setConfirmerResiliation}
        title="Résilier l’abonnement"
        description="Vous ne perdez rien aujourd’hui."
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              disabled={cancel.isPending}
              className="w-full sm:w-auto"
              onClick={() => {
                setConfirmerResiliation(false);
              }}
            >
              Revenir
            </Button>
            <Button
              variant="danger-outline"
              size="sm"
              isLoading={cancel.isPending}
              loadingLabel="Résiliation de l’abonnement"
              className="w-full sm:w-auto"
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
