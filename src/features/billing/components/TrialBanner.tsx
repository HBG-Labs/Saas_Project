import { AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

import { useOrganizationSubscription } from '../hooks/useEntitlements';

/**
 * L'échéance de la période d'essai, dite à voix haute.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE BANDEAU EXISTE
 *
 * Une organisation naît avec un essai `business`. Quand il expire,
 * `app.org_plan_code()` cesse de renvoyer un plan, `can_use_pro_module()`
 * renvoie `false`, et TOUTES les policies du module professionnel se mettent à
 * renvoyer des ensembles vides : missions, clients, équipes, interventions,
 * audit. En une nuit, sans aucune erreur ni message.
 *
 * Techniquement, c'est correct. Vu du patron, son logiciel s'est vidé.
 *
 * La date existait pourtant en base depuis le premier jour — `trial_ends_at`,
 * posée par le trigger — mais aucun écran ne la montrait. Le bandeau ne fait
 * que la rendre lisible, et de plus en plus insistante à mesure qu'elle
 * approche.
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

export function TrialBanner({ organizationId }: { organizationId: string | null }) {
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

  // Au-delà d'un mois, l'échéance n'est pas une information : elle deviendrait
  // un bandeau permanent, donc invisible le jour où elle compte vraiment.
  if (remaining > 30) return null;

  const expired = remaining <= 0;
  const urgent = remaining <= 7;

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
            {formattedDate}. Les modules Missions, Clients, Équipes et Interventions sont
            suspendus — vos données sont intactes et réapparaîtront dès la souscription.
          </>
        ) : (
          <>
            <strong className="font-semibold">
              {remaining === 1 ? 'Dernier jour d’essai' : `Essai : ${remaining} jours restants`}
            </strong>{' '}
            — jusqu’au {formattedDate}.{' '}
            {avecCarte
              ? 'Votre abonnement démarrera automatiquement à cette date. Vous pouvez y renoncer d’ici là depuis le portail de facturation.'
              : 'Passé cette date, les modules professionnels sont suspendus jusqu’à la souscription.'}
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
