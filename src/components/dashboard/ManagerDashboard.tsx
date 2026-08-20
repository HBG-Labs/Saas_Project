import { ArrowRight, Briefcase, ClipboardCheck, ClipboardList, Plus, UsersRound } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { formatNewNoun, formatNoneNoun, useCurrentIndustry, useLabel } from '@/features/industries';
import { useReportsPendingReview } from '@/features/interventions';
import { MissionStatusBadge, useMissions } from '@/features/missions';
import { useCurrentOrganization } from '@/features/organizations';
import { useTeams } from '@/features/teams';

export function ManagerDashboard() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { label: industryLabel, isResolved } = useCurrentIndustry();

  const jobPlural = useLabel('job', true);
  const jobSingular = useLabel('job');

  const missions = useMissions(organizationId, { limit: 5 });
  const pendingReports = useReportsPendingReview(organizationId);
  const teams = useTeams(organizationId);

  const pendingReportsCount = (pendingReports.data ?? []).length;
  const missionList = missions.data ?? [];
  const teamList = teams.data ?? [];

  return (
    <div className="space-y-8 pb-12">
      {/* Header Manager */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Espace Responsable & Chef d&apos;équipe
              </span>
              {isResolved && industryLabel ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-2xs font-medium text-muted-foreground">
                  <Briefcase className="size-3 text-primary" />
                  {industryLabel}
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">• {organization?.name}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Tableau de Bord — Management des Équipes & {jobPlural}
            </h1>
            <p className="text-xs text-muted-foreground">
              Suivi des {jobPlural.toLowerCase()} attribuées, revue des rapports d&apos;intervention et pilotage du périmètre.
            </p>
          </div>

          <Button asChild size="sm" className="shadow-xs">
            <Link to={ROUTES.missionNew}>
              <Plus className="size-4 mr-1" />
              {formatNewNoun(jobSingular)}
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs Manager */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {/* KPI 1 : Rapports à contrôler */}
        <div
          className={
            pendingReportsCount > 0
              ? 'group relative flex flex-col justify-between rounded-xl border border-amber-500/50 bg-amber-500/5 p-3.5 sm:p-4 shadow-xs transition-all duration-200 hover:border-amber-500 hover:shadow-md'
              : 'group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-xs transition-all duration-200 hover:border-border-strong hover:shadow-md'
          }
        >
          <Link to={ROUTES.review} className="flex h-full flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-transform group-hover:scale-105">
                <ClipboardCheck className="size-4" />
              </div>
              <Badge variant={pendingReportsCount > 0 ? 'warning' : 'outline'} className="font-semibold text-3xs px-2 py-0.5">
                {pendingReportsCount > 0 ? `${pendingReportsCount} à valider` : 'À jour'}
              </Badge>
            </div>

            <div>
              <p className="text-muted-foreground text-3xs font-semibold uppercase tracking-wider">
                Rapports à contrôler
              </p>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className="text-2xl font-extrabold tracking-tight tabular-nums text-amber-600 dark:text-amber-400">
                  {pendingReportsCount}
                </span>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Revoir & Valider
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* KPI 2 : Missions du périmètre */}
        <div className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md">
          <Link to={ROUTES.missions} className="flex h-full flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 transition-transform group-hover:scale-105">
                <ClipboardList className="size-4" />
              </div>
              <Badge variant="primary" className="font-mono text-3xs px-2 py-0.5">
                {missionList.length} au total
              </Badge>
            </div>

            <div>
              <p className="text-muted-foreground text-3xs font-semibold uppercase tracking-wider">
                {jobPlural} du périmètre
              </p>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className="text-2xl font-extrabold tracking-tight tabular-nums text-foreground">
                  {missionList.length}
                </span>
                <span className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Voir mes {jobPlural.toLowerCase()}
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* KPI 3 : Équipes */}
        <div className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-xs transition-all duration-200 hover:border-emerald-500/50 hover:shadow-md">
          <Link to={ROUTES.teams} className="flex h-full flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-transform group-hover:scale-105">
                <UsersRound className="size-4" />
              </div>
              <Badge variant="success" className="font-medium text-3xs px-2 py-0.5">
                {teamList.length} équipe{teamList.length > 1 ? 's' : ''}
              </Badge>
            </div>

            <div>
              <p className="text-muted-foreground text-3xs font-semibold uppercase tracking-wider">
                Mes Équipes
              </p>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className="text-2xl font-extrabold tracking-tight tabular-nums text-foreground">
                  {teamList.length}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Voir les équipes
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Missions de mon périmètre */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
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
          {missionList.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">{formatNoneNoun(jobSingular, 'attribué')} actuellement.</p>
          ) : (
            <div className="divide-y divide-border space-y-1">
              {missionList.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-4">
                  <Link to={ROUTES.mission(m.id)} className="flex items-center justify-between text-xs hover:text-primary transition-colors min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate">
                      <Badge variant="outline" className="font-mono text-2xs">{m.reference}</Badge>
                      <span className="font-medium text-foreground truncate">{m.title}</span>
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
