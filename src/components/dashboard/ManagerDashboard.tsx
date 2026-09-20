import { ArrowRight, ClipboardCheck, ClipboardList, Plus, UsersRound } from 'lucide-react';
import { Link } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { formatNewNoun, formatNoneNoun, useLabel } from '@/features/industries';
import { useReportsPendingReview } from '@/features/interventions';
import { MissionStatusBadge, useMissionStatusCounts, useMissions } from '@/features/missions';
import { useCurrentOrganization } from '@/features/organizations';
import { useTeams } from '@/features/teams';

export function ManagerDashboard() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const jobPlural = useLabel('job', true);
  const jobSingular = useLabel('job');

  const missions = useMissions(organizationId, { limit: 12 });
  const missionStatusCounts = useMissionStatusCounts(organizationId);
  const pendingReports = useReportsPendingReview(organizationId);
  const teams = useTeams(organizationId);

  const pendingReportsCount = (pendingReports.data ?? []).length;
  const missionList = missions.data ?? [];
  const missionCount = Object.values(missionStatusCounts.data ?? {}).reduce(
    (total, count) => total + count,
    0,
  );
  const teamList = teams.data ?? [];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Tableau de bord"
        description={`${organization?.name ?? 'Votre périmètre'} — ${jobPlural.toLowerCase()} attribuées, revue des comptes rendus et suivi des équipes.`}
        className="mb-0"
        actions={
          <Button asChild size="sm">
            <Link to={ROUTES.missionNew}>
              <Plus className="size-4" aria-hidden="true" />
              {formatNewNoun(jobSingular)}
            </Link>
          </Button>
        }
      />

      {/* Ce qui attend une action d'abord, le volume ensuite. */}
      <div className="border-border bg-surface grid grid-cols-1 overflow-hidden rounded-lg border sm:grid-cols-3">
        <MetricCard
          layout="strip"
          label="Comptes rendus à contrôler"
          value={pendingReports.isPending || pendingReports.isError ? '—' : pendingReportsCount}
          icon={ClipboardCheck}
          to={ROUTES.review}
          actionLabel="Contrôler"
          attention={
            !pendingReports.isPending && !pendingReports.isError && pendingReportsCount > 0
          }
          badge={
            pendingReports.isPending
              ? { text: 'Chargement', variant: 'neutral' }
              : pendingReports.isError
                ? { text: 'Indisponible', variant: 'neutral' }
                : pendingReportsCount > 0
                  ? { text: 'En attente', variant: 'warning' }
                  : { text: 'À jour', variant: 'success' }
          }
        />
        <MetricCard
          layout="strip"
          label={`${jobPlural} du périmètre`}
          value={missionStatusCounts.isPending || missionStatusCounts.isError ? '—' : missionCount}
          icon={ClipboardList}
          to={ROUTES.missions}
          actionLabel="Voir"
        />
        <MetricCard
          layout="strip"
          label="Mes équipes"
          value={teams.isPending || teams.isError ? '—' : teamList.length}
          icon={UsersRound}
          to={ROUTES.teams}
          actionLabel="Organiser"
        />
      </div>

      {/* Missions de mon périmètre */}
      <Card className="overflow-hidden">
        <CardHeader className="border-border flex flex-row items-center justify-between border-b">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="text-primary size-4.5" aria-hidden="true" />
            {jobPlural} récentes
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to={ROUTES.missions}>
              Voir tout
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {missions.isPending ? (
            <ListSkeleton rows={4} />
          ) : missions.isError ? (
            <ErrorState
              error={missions.error}
              onRetry={() => {
                void missions.refetch();
              }}
            />
          ) : missionList.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={formatNoneNoun(jobSingular, 'attribué')}
              description={`Les ${jobPlural.toLowerCase()} de votre périmètre apparaîtront ici.`}
            />
          ) : (
            <ul className="divide-border divide-y">
              {missionList.map((m) => (
                <li key={m.id}>
                  <Link
                    to={ROUTES.mission(m.id)}
                    className="hover:bg-surface-hover min-h-touch -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors sm:min-h-0"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0 font-mono">
                          {m.reference}
                        </Badge>
                        <span className="text-foreground truncate text-sm font-semibold">
                          {m.title}
                        </span>
                      </div>
                      {m.customer !== null ? (
                        <p className="text-muted-foreground truncate text-sm">{m.customer.name}</p>
                      ) : null}
                    </div>
                    <MissionStatusBadge status={m.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
