import { AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

import { FEATURES, planFeatureLimit } from '../entitlements';
import { useOrganizationSubscription } from '../hooks/useEntitlements';

/**
 * L'échéance de la période d'essai, dite à voix haute.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE BANDEAU EXISTE
 *
 * Quand l'essai expire, `app.org_plan_code()` cesse de renvoyer un plan et
 * l'organisation retombe sur la formule Gratuite. Rien n'annonce ce passage :
 * la date existait en base depuis le premier jour — `trial_ends_at`, posée par
 * le trigger — mais aucun écran ne la montrait. Le bandeau la rend lisible, et
 * de plus en plus insistante à mesure qu'elle approche.
 *
 * CE QUE « GRATUIT » VEUT DIRE, ET POURQUOI LE TEXTE NE L'ÉCRIT PAS EN DUR
 *
 * Depuis `20260902100000_realigne_la_matrice_des_formules`, la formule
 * Gratuite n'est plus une coquille vide : elle garde un aperçu plafonné du
 * terrain — quelques clients, missions et interventions. Les policies de ces
 * modules continuent donc de répondre, et c'est `app.enforce_plan_row_quota`
 * qui refuse la ligne de trop. Seuls les modules absents de la formule —
 * équipes, planning, stock… — se vident réellement.
 *
 * La version précédente de ce bandeau annonçait « Missions, Clients, Équipes et
 * Interventions suspendus » : vrai avant cette migration, faux après, et
 * personne ne l'a vu parce que la phrase était écrite en dur. Les plafonds
 * viennent désormais de `PLAN_FEATURES`, dont un test compare chaque valeur à
 * la migration : la grille ne peut plus bouger sans que ce texte suive.
 *
 * QUI LE VOIT
 *
 * `subscriptions` n'est lisible que par `billing.view`, c'est-à-dire le
 * propriétaire et les administrateurs. Pour tous les autres, la requête renvoie
 * zéro ligne et le bandeau ne s'affiche pas : un technicien n'a pas à porter
 * une échéance commerciale, et ne peut rien y faire.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Nombre de jours entiers d'ici l'échéance. Négatif si elle est passée. */
function daysUntil(iso: string): number {
  const MS_PER_DAY = 86_400_000;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / MS_PER_DAY);
}

export function TrialBanner({
  organizationId,
  urgentOnly = false,
}: {
  organizationId: string | null;
  urgentOnly?: boolean;
}) {
  const subscription = useOrganizationSubscription(organizationId);
  const row = subscription.data ?? null;

  // DEUX ESSAIS DE NATURE DIFFÉRENTE, et ils ne finissent pas pareil : celui
  // ouvert à la création de l'entreprise s'éteint et referme les modules ;
  // celui qui suit une souscription porte une carte et se transforme en
  // prélèvement. Annoncer l'un pour l'autre, c'est promettre une coupure à qui
  // va être débité, ou l'inverse.
  const avecCarte = row?.provider_subscription_id != null;

  if (row === null || row.status !== 'trialing') return null;

  // `trial_ends_at` peut être NULL sur un abonnement posé à la main. Sans date,
  // il n'y a rien à annoncer — et surtout rien à inventer.
  const endsAt = row.trial_ends_at ?? row.current_period_end;
  if (endsAt === null) return null;

  const remaining = daysUntil(endsAt);

  // Hors tableau de bord, ne reprendre de la place que lorsque l'échéance
  // devient réellement urgente. L'état expiré reste naturellement visible.
  if (urgentOnly && remaining > 3) return null;

  // Au-delà d'un mois, l'échéance n'est pas une information : elle deviendrait
  // un bandeau permanent, donc invisible le jour où elle compte vraiment.
  if (remaining > 30) return null;

  const expired = remaining <= 0;
  const urgent = remaining <= 7;

  // Les plafonds de la formule Gratuite, lus dans le miroir plutôt qu'écrits
  // ici : voir l'en-tête. Une valeur absente signifierait que la grille a
  // retiré le module — le texte le dit alors sans inventer de chiffre.
  const plafonds = [
    [planFeatureLimit('free', FEATURES.customers), 'client', 'clients'],
    [planFeatureLimit('free', FEATURES.missions), 'mission', 'missions'],
    [planFeatureLimit('free', FEATURES.interventions), 'intervention', 'interventions'],
  ] as const;
  const apercuGratuit = plafonds
    .flatMap(([n, un, plusieurs]) => (n === null ? [] : [`${String(n)} ${n > 1 ? plusieurs : un}`]))
    .join(', ');

  const formattedDate = new Date(endsAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      role={expired ? 'alert' : 'status'}
      className={cn(
        'mb-4 flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:gap-3',
        expired
          ? 'border-error-border bg-error-subtle text-foreground'
          : urgent
            ? 'border-warning-border bg-warning-subtle text-foreground'
            : 'border-border bg-surface-sunken text-muted-foreground',
      )}
    >
      {expired || urgent ? (
        <AlertTriangle
          className={cn('size-4 shrink-0', expired ? 'text-error' : 'text-warning')}
          aria-hidden="true"
        />
      ) : (
        <Clock className="size-4 shrink-0" aria-hidden="true" />
      )}

      <p className="min-w-0 flex-1">
        {expired ? (
          <>
            <strong className="font-semibold">Votre période d’essai a pris fin</strong> le{' '}
            {formattedDate}. Vous êtes en formule Gratuite
            {apercuGratuit !== '' ? ` : ${apercuGratuit} au maximum` : ''}. Les autres modules
            professionnels sont suspendus — vos données sont intactes et réapparaîtront dès la
            souscription.
          </>
        ) : (
          <>
            <strong className="font-semibold">
              {remaining === 1 ? 'Dernier jour d’essai' : `Essai : ${remaining} jours restants`}
            </strong>{' '}
            — jusqu’au {formattedDate}.{' '}
            {avecCarte
              ? 'Votre abonnement démarrera automatiquement à cette date. Vous pouvez y renoncer d’ici là depuis le portail de facturation.'
              : `Passé cette date, vous repasserez en formule Gratuite${apercuGratuit !== '' ? ` (${apercuGratuit} au maximum)` : ''} ; les autres modules professionnels seront suspendus jusqu’à la souscription.`}
          </>
        )}
      </p>

      <Link
        to={ROUTES.organizationBilling}
        className="text-primary shrink-0 font-semibold hover:underline"
      >
        Voir la facturation
      </Link>
    </div>
  );
}
