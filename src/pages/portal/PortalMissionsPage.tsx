import { ChevronRight, MapPin, Wrench } from 'lucide-react';
import { Link } from 'react-router';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
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
  const list = missions.data ?? [];
  const activeCount = list.filter((mission) =>
    ['assigned', 'accepted', 'in_progress'].includes(mission.status),
  ).length;

  return (
    <div>
      <PortalPageHeader
        title="Mes interventions"
        description="Suivez les rendez-vous planifiés, les passages en cours et les comptes rendus disponibles."
        icon={Wrench}
        summary={
          missions.isSuccess ? (
            <div className="flex gap-2">
              <Badge variant="primary" size="button">
                {activeCount} en cours
              </Badge>
              <Badge variant="neutral" size="button">
                {list.length} au total
              </Badge>
            </div>
          ) : null
        }
      />

      {missions.isPending ? (
        <ListSkeleton />
      ) : missions.isError ? (
        <ErrorState
          error={missions.error}
          onRetry={() => {
            void missions.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          illustration={<AtelierIllustration subject="missions" />}
          title="Aucune intervention"
          description="Vos interventions apparaîtront ici dès qu’elles seront planifiées."
        />
      ) : (
        <ul className="space-y-3">
          {list.map((m) => {
            const lieu = [m.site_name, m.city].filter(Boolean).join(' · ');
            return (
              <li key={m.id}>
                <Link
                  to={ROUTES.portalMission(m.id)}
                  className="border-border/80 bg-surface hover:border-primary/30 hover:shadow-raised focus-visible:ring-ring group flex min-h-24 items-start gap-3 rounded-2xl border p-4 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:outline-none motion-reduce:hover:translate-y-0"
                >
                  <span className="bg-primary-subtle text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <Wrench className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-foreground line-clamp-2 text-sm font-semibold">
                        {m.title}
                      </p>
                      <Badge variant="outline" className="font-mono">
                        {m.reference}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-xs font-medium">
                      {formatDateFr(m.scheduled_start, true)}
                    </p>
                    {lieu ? (
                      <p className="text-muted-foreground mt-1 flex items-start gap-1 text-xs">
                        <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                        <span className="line-clamp-1">{lieu}</span>
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={m.status} kind="mission" />
                      {m.has_approved_report ? (
                        <Badge variant="success">Rapport disponible</Badge>
                      ) : null}
                      {m.shared_attachments_count > 0 ? (
                        <Badge variant="neutral">
                          {m.shared_attachments_count} photo
                          {m.shared_attachments_count > 1 ? 's' : ''}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight
                    className="text-muted-foreground mt-3 size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
