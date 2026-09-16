import { Link } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { PROSPECT_STATUS_LABELS, useProspectingDashboard } from '@/features/prospecting';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { ProspectStatus } from '@/types/database';

/**
 * §14 du cahier des charges — tableau de bord du jour. Chaque carte est
 * cliquable et pointe vers la liste déjà filtrée (§ « Toutes les cartes
 * pertinentes doivent être cliquables »).
 */
function scoreTierCard(
  emoji: string,
  label: string,
  count: number,
  minScore: number,
  colorClass: string,
) {
  return (
    <Link
      to={`${ROUTES.prospectingList}?minScore=${minScore}`}
      className={`block rounded-2xl border p-4 transition-colors hover:brightness-95 ${colorClass}`}
    >
      <p className="text-3xs font-bold tracking-wide uppercase opacity-80">
        {emoji} {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-extrabold">{count}</p>
    </Link>
  );
}

export default function ProspectingDashboardPage() {
  useDocumentTitle('Prospect Radar');

  const { data, isPending, error, refetch } = useProspectingDashboard();

  return (
    <div>
      <PageHeader
        title="Prospect Radar"
        description="Détection interne de prospects B2B — jamais visible des clients REZO360."
      />

      {isPending ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-6">
          <Card className="border-border/80 bg-surface p-5 shadow-xs">
            <p className="text-muted-foreground text-3xs font-bold tracking-wide uppercase">
              Aujourd’hui
            </p>
            <p className="text-foreground mt-1 text-2xl font-extrabold">
              {data.detected_today} entreprise{data.detected_today !== 1 ? 's' : ''} détectée
              {data.detected_today !== 1 ? 's' : ''}
            </p>
            <p className="text-subtle-foreground mt-1 text-xs">
              {data.total} prospect{data.total !== 1 ? 's' : ''} au total dans le radar.
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {scoreTierCard(
              '🔥',
              'Opportunités fortes',
              data.score_tiers.forte,
              70,
              'border-error-border bg-error-subtle text-error',
            )}
            {scoreTierCard(
              '🟠',
              'Opportunités moyennes',
              data.score_tiers.moyenne,
              40,
              'border-warning-border bg-warning-subtle text-warning',
            )}
            {scoreTierCard(
              '🔵',
              'Autres prospects',
              data.score_tiers.basse,
              0,
              'border-info-border bg-info-subtle text-info',
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="border-border/80 bg-surface p-5 shadow-xs">
              <h2 className="text-foreground text-sm font-bold">Par statut</h2>
              <ul className="mt-3 space-y-2">
                {Object.entries(data.by_status).map(([status, count]) => (
                  <li key={status} className="flex items-center justify-between text-xs">
                    <Link
                      to={`${ROUTES.prospectingList}?status=${status}`}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {PROSPECT_STATUS_LABELS[status as ProspectStatus] ?? status}
                    </Link>
                    <span className="text-foreground font-mono font-bold">{count}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="border-border/80 bg-surface p-5 shadow-xs">
              <h2 className="text-foreground text-sm font-bold">Répartition géographique</h2>
              <ul className="mt-3 space-y-2">
                {Object.entries(data.by_zone).map(([zone, count]) => (
                  <li key={zone} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{zone}</span>
                    <span className="text-foreground font-mono font-bold">{count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
