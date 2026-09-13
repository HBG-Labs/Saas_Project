import { ChevronRight, MapPin, Wrench } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { formatDateFr, PortalPageHeader, StatusBadge, usePortalMissions } from '@/features/portal';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function PortalMissionsPage() {
  useDocumentTitle('Mes interventions — Espace client');
  const missions = usePortalMissions();

  return (
    <div>
      <PortalPageHeader title="Mes interventions" description="Planifiées, en cours ou réalisées chez vous." />

      {missions.isPending ? (
        <ListSkeleton />
      ) : missions.isError ? (
        <ErrorState
          error={missions.error}
          onRetry={() => {
            void missions.refetch();
          }}
        />
      ) : (missions.data ?? []).length === 0 ? (
        <EmptyState icon={Wrench} title="Aucune intervention" description="Vos interventions apparaîtront ici dès qu’elles seront planifiées." />
      ) : (
        <ul className="space-y-2">
          {(missions.data ?? []).map((m) => {
            const lieu = [m.site_name, m.city].filter(Boolean).join(' · ');
            return (
              <li key={m.id}>
                <Link
                  to={ROUTES.portalMission(m.id)}
                  className="border-border bg-surface hover:border-primary/50 flex items-center gap-3 rounded-xl border p-3 transition-colors sm:p-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-foreground truncate text-sm font-semibold">{m.title}</p>
                      <Badge variant="outline" className="font-mono">
                        {m.reference}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {formatDateFr(m.scheduled_start, true)}
                      {lieu ? (
                        <>
                          {' · '}
                          <MapPin className="inline size-3" aria-hidden="true" /> {lieu}
                        </>
                      ) : null}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={m.status} kind="mission" />
                      {m.has_approved_report ? <Badge variant="success">Rapport disponible</Badge> : null}
                      {m.shared_attachments_count > 0 ? (
                        <Badge variant="neutral">
                          {m.shared_attachments_count} photo{m.shared_attachments_count > 1 ? 's' : ''}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
