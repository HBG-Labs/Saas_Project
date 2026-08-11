import { ArrowRight, ClipboardCheck, ClipboardList, UsersRound } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { useReportsPendingReview } from '@/features/interventions';
import { MissionStatusBadge, useMissions } from '@/features/missions';
import { useCurrentOrganization } from '@/features/organizations';
import { useTeams } from '@/features/teams';

export function ManagerDashboard() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const missions = useMissions(organizationId, { limit: 5 });
  const pendingReports = useReportsPendingReview(organizationId);
  const teams = useTeams(organizationId);

  const pendingReportsCount = (pendingReports.data ?? []).length;
  const missionList = missions.data ?? [];
  const teamList = teams.data ?? [];

  return (
    <div className="space-y-8 pb-12">
      {/* Header Manager */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-slate-900/90 via-slate-900/95 to-emerald-950/40 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                Espace Responsable & Chef d'équipe
              </span>
              <span className="text-xs text-muted-foreground">• {organization?.name}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Tableau de Bord — Management des Équipes & Missions
            </h1>
            <p className="text-xs text-muted-foreground">
              Suivi des missions attribuées, revue des rapports d'intervention et pilotage du périmètre.
            </p>
          </div>
        </div>
      </div>

      {/* KPIs Manager */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className={pendingReportsCount > 0 ? "border-amber-500/50 bg-amber-950/10 shadow-xs" : ""}>
          <CardContent className="pt-5">
            <Link to={ROUTES.review} className="block group space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ClipboardCheck className="size-4 text-amber-400" />
                  Rapports à contrôler
                </span>
                <Badge variant={pendingReportsCount > 0 ? "warning" : "outline"}>{pendingReportsCount}</Badge>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold tracking-tight tabular-nums text-amber-400">{pendingReportsCount}</span>
                <span className="text-xs font-semibold text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Revoir & Valider
                  <ArrowRight className="size-3.5" />
                </span>
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <Link to={ROUTES.missions} className="block group space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ClipboardList className="size-4 text-blue-400" />
                  Missions du périmètre
                </span>
                <Badge variant="primary">{missionList.length}</Badge>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">{missionList.length}</span>
                <span className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Voir mes missions
                  <ArrowRight className="size-3.5" />
                </span>
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <Link to={ROUTES.teams} className="block group space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <UsersRound className="size-4 text-emerald-400" />
                  Mes Équipes
                </span>
                <Badge variant="success">{teamList.length}</Badge>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">{teamList.length}</span>
                <span className="text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Voir les équipes
                  <ArrowRight className="size-3.5" />
                </span>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Missions de mon périmètre */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            Missions & Avancement
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to={ROUTES.missions} className="flex items-center gap-1">
              Toutes mes missions
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {missionList.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Aucune mission actuellement attribuée.</p>
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
