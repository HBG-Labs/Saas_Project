import { ArrowRight, ClipboardCheck, ClipboardList, Plus, UsersRound } from 'lucide-react';
import { Link } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
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

  const missions = useMissions(organizationId, { limit: 5 });
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
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {organization?.name ?? 'Votre périmètre'} — {jobPlural.toLowerCase()} attribuées, revue
            des comptes rendus et suivi des équipes.
          </p>
        </div>

        <Button asChild size="sm">
          <Link to={ROUTES.missionNew}>
            <Plus className="size-4" aria-hidden="true" />
            {formatNewNoun(jobSingular)}
          </Link>
        </Button>
      </div>

      {/* Ce qui attend une action d'abord, le volume ensuite. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Comptes rendus à contrôler"
          value={pendingReports.isPending || pendingReports.isError ? '—' : pendingReportsCount}
          icon={ClipboardCheck}
          to={ROUTES.review}
          actionLabel="Contrôler"
          attention={!pendingReports.isPending && !pendingReports.isError && pendingReportsCount > 0}
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
          label={`${jobPlural} du périmètre`}
          value={missionStatusCounts.isPending || missionStatusCounts.isError ? '—' : missionCount}
          icon={ClipboardList}
          to={ROUTES.missions}
          actionLabel="Voir"
        />
        <MetricCard
          label="Mes équipes"
          value={teams.isPending || teams.isError ? '—' : teamList.length}
          icon={UsersRound}
          to={ROUTES.teams}
          actionLabel="Organiser"
        />
      </div>

      {/* Missions de mon périmètre */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="text-primary size-4" />
            {jobPlural} & Avancement
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to={ROUTES.missions} className="flex items-center gap-1">
              Toutes mes {jobPlural.toLowerCase()}
              <ArrowRight className="size-3.5" />
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
            <p className="text-muted-foreground py-4 text-center text-xs">
              {formatNoneNoun(jobSingular, 'attribué')} actuellement.
            </p>
          ) : (
            <div className="divide-border space-y-1 divide-y">
              {missionList.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-4 py-2.5">
                  <Link
                    to={ROUTES.mission(m.id)}
                    className="hover:text-primary flex min-w-0 flex-1 items-center justify-between text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Badge variant="outline" className="text-2xs font-mono">
                        {m.reference}
                      </Badge>
                      <span className="text-foreground truncate font-medium">{m.title}</span>
                    </div>
                  </Link>
                  <MissionStatusBadge status={m.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
