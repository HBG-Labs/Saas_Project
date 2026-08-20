import {
  Activity,
  ArrowRight,
  Briefcase,
  Building2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { useAuditLogs } from '@/features/audit';
import { useSeatBilling } from '@/features/billing';
import { formatNewNoun, useCurrentIndustry, useLabel } from '@/features/industries';
import { useReportsPendingReview } from '@/features/interventions';
import { MissionStatusBadge, useMissions } from '@/features/missions';
import {
  AddMemberDialog,
  InviteMemberDialog,
  useCurrentOrganization,
  useMembers,
} from '@/features/organizations';
import { useTeams } from '@/features/teams';
import { cn } from '@/lib/cn';

import { FirstStepsCard } from './FirstStepsCard';

export function OwnerDashboard() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { label: industryLabel, isResolved } = useCurrentIndustry();

  const jobPlural = useLabel('job', true);
  const jobSingular = useLabel('job');
  const workerPlural = useLabel('worker', true);

  const sieges = useSeatBilling(organizationId);
  const members = useMembers(organizationId);
  const missions = useMissions(organizationId, { limit: 6 });
  const pendingReports = useReportsPendingReview(organizationId);
  const teams = useTeams(organizationId);
  const auditLogs = useAuditLogs(organizationId, { limit: 6 });

  const activeMembersCount = (members.data ?? []).filter((m) => m.status === 'active').length;
  const pendingReportsCount = (pendingReports.data ?? []).length;
  const missionList = missions.data ?? [];
  const teamList = teams.data ?? [];
  const recentLogs = auditLogs.data ?? [];

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Executive Hero Cockpit Banner */}
      <div className="relative rounded-2xl border border-border bg-surface p-6 shadow-xs">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <ShieldCheck className="size-3.5" />
                Espace Direction & Propriétaire
              </span>
              {isResolved && industryLabel ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-2xs font-medium text-muted-foreground">
                  <Briefcase className="size-3 text-primary" />
                  {industryLabel}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Cockpit Opérationnel
              </span>
            </div>

            <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              Tableau de Bord — Pilotage d’Entreprise
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Vue d&apos;ensemble 360° de vos effectifs, du suivi des {jobPlural.toLowerCase()} terrain et du contrôle qualité.
            </p>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {organizationId ? (
              <>
                {/* Les mêmes valeurs que sur l'écran des membres : un raccourci
                    qui tairait le coût d'un siège supplémentaire ferait de ce
                    bouton le chemin le moins informé vers la même dépense. */}
                <AddMemberDialog
                  organizationId={organizationId}
                  viewerIsOwner={true}
                  quotaReached={sieges.quotaBlocked}
                  isExtraSeat={sieges.isExtraSeat}
                  onMemberAdded={() => {
                    void members.refetch();
                  }}
                />
                <InviteMemberDialog
                  organizationId={organizationId}
                  viewerIsOwner={true}
                  quotaReached={false}
                />
              </>
            ) : null}

            <Button asChild size="sm" className="shadow-xs">
              <Link to={ROUTES.missionNew}>
                <Plus className="size-4" />
                {formatNewNoun(jobSingular)}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Le parcours guidé, tant qu'il n'est pas bouclé. Placé avant les KPI :
          une entreprise qui n'a pas encore de mission n'a pas de KPI à lire. */}
      <FirstStepsCard />

      {/* 2. Grille de 4 KPIs Entreprise avec Dimensions Compactes & Épurées */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1 : Missions / Chantiers de l'entreprise */}
        <div className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md">
          <Link to={ROUTES.missions} className="flex h-full flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 transition-transform group-hover:scale-105">
                <ClipboardList className="size-4" />
              </div>
              <Badge variant="outline" className="font-mono text-3xs px-2 py-0.5">
                {missionList.length} au total
              </Badge>
            </div>

            <div>
              <p className="text-muted-foreground text-3xs font-semibold uppercase tracking-wider">
                {jobPlural} de l&apos;entreprise
              </p>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className="text-foreground text-2xl font-extrabold tracking-tight tabular-nums">
                  {missionList.length}
                </span>
                <span className="text-primary group-hover:translate-x-0.5 inline-flex items-center gap-1 text-xs font-semibold transition-transform">
                  Voir les {jobPlural.toLowerCase()}
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* KPI 2 : Contrôle Qualité (Validation des Rapports) */}
        <div
          className={cn(
            'group relative flex flex-col justify-between rounded-xl border bg-surface p-3.5 sm:p-4 shadow-xs transition-all duration-200',
            pendingReportsCount > 0
              ? 'border-amber-500/50 bg-amber-500/5 hover:border-amber-500 hover:shadow-md'
              : 'border-border hover:border-border-strong hover:shadow-md',
          )}
        >
          <Link to={ROUTES.review} className="flex h-full flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-transform group-hover:scale-105">
                <ClipboardCheck className="size-4" />
              </div>
              {pendingReportsCount > 0 ? (
                <Badge variant="warning" className="font-semibold text-3xs px-2 py-0.5 animate-pulse">
                  {pendingReportsCount} à valider
                </Badge>
              ) : (
                <Badge variant="outline" className="text-3xs px-2 py-0.5">
                  À jour
                </Badge>
              )}
            </div>

            <div>
              <p className="text-muted-foreground text-3xs font-semibold uppercase tracking-wider">
                Contrôle Qualité
              </p>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className="text-amber-600 dark:text-amber-400 text-2xl font-extrabold tracking-tight tabular-nums">
                  {pendingReportsCount}
                </span>
                <span className="text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 inline-flex items-center gap-1 text-xs font-semibold transition-transform">
                  Revoir & Valider
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* KPI 3 : Équipes de terrain */}
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
                Équipes de terrain
              </p>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className="text-foreground text-2xl font-extrabold tracking-tight tabular-nums">
                  {teamList.length}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 inline-flex items-center gap-1 text-xs font-semibold transition-transform">
                  Organiser
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* KPI 4 : Effectifs & Membres */}
        <div className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5 sm:p-4 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md">
          <Link to={ROUTES.organizationMembers} className="flex h-full flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 transition-transform group-hover:scale-105">
                <Users className="size-4" />
              </div>
              <Badge variant="primary" className="font-medium text-3xs px-2 py-0.5">
                {activeMembersCount} actif{activeMembersCount > 1 ? 's' : ''}
              </Badge>
            </div>

            <div>
              <p className="text-muted-foreground text-3xs font-semibold uppercase tracking-wider">
                {workerPlural}
              </p>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className="text-foreground text-2xl font-extrabold tracking-tight tabular-nums">
                  {activeMembersCount}
                </span>
                <span className="text-primary group-hover:translate-x-0.5 inline-flex items-center gap-1 text-xs font-semibold transition-transform">
                  Gérer l&apos;équipe
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* 3. Section des Raccourcis de Gestion Rapide */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="size-3.5 text-primary" />
            Accès Rapide 360°
          </h2>
          <span className="text-muted-foreground text-xs">Raccourcis de gestion</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            to={ROUTES.organizationMembers}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all duration-150 hover:border-primary/50 hover:bg-surface-hover hover:shadow-sm"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <Users className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-xs font-semibold group-hover:text-primary transition-colors">
                {workerPlural}
              </p>
              <p className="text-muted-foreground truncate text-2xs">Membres & Rôles</p>
            </div>
            <ChevronRight className="text-subtle-foreground size-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            to={ROUTES.teams}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all duration-150 hover:border-emerald-500/50 hover:bg-surface-hover hover:shadow-sm"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <UsersRound className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-xs font-semibold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Équipes Terrain
              </p>
              <p className="text-muted-foreground truncate text-2xs">Groupes & Opérations</p>
            </div>
            <ChevronRight className="text-subtle-foreground size-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            to={ROUTES.customers}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all duration-150 hover:border-sky-500/50 hover:bg-surface-hover hover:shadow-sm"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
              <Building2 className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-xs font-semibold group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                Fichier Clients
              </p>
              <p className="text-muted-foreground truncate text-2xs">Contacts & Sites</p>
            </div>
            <ChevronRight className="text-subtle-foreground size-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            to={ROUTES.organization}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all duration-150 hover:border-amber-500/50 hover:bg-surface-hover hover:shadow-sm"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-xs font-semibold group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Paramètres
              </p>
              <p className="text-muted-foreground truncate text-2xs">Entreprise & Métier</p>
            </div>
            <ChevronRight className="text-subtle-foreground size-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* 4. Grille 2 Colonnes (Missions récentes + Fil d'activité) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne Gauche (2/3) : Missions récents Enrichies */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="size-4.5 text-primary" />
                {jobPlural} récentes de l&apos;entreprise
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link to={ROUTES.missions} className="flex items-center gap-1">
                  Voir tout
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="pt-4">
              {missionList.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-10 text-center">
                  <ClipboardList className="size-10 text-subtle-foreground/50 mb-2" />
                  <p className="text-sm font-medium">Aucun {jobSingular.toLowerCase()} enregistré</p>
                  <p className="text-xs text-subtle-foreground mt-1">
                    Créez votre première mission pour commencer le suivi d&apos;intervention.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link to={ROUTES.missionNew}>
                      <Plus className="size-3.5 mr-1" /> Créer un {jobSingular.toLowerCase()}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-border space-y-2.5 divide-y">
                  {missionList.map((m) => {
                    const progressPercent =
                      m.status === 'completed' ? 100 : m.status === 'in_progress' ? 65 : 25;

                    return (
                      <div
                        key={m.id}
                        className="group flex flex-wrap items-center justify-between gap-4 pt-2.5 pb-1.5 transition-colors hover:bg-surface-hover/50 rounded-lg px-2"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-2xs shrink-0">
                              {m.reference}
                            </Badge>
                            <Link
                              to={ROUTES.mission(m.id)}
                              className="text-foreground font-semibold text-sm truncate group-hover:text-primary transition-colors"
                            >
                              {m.title}
                            </Link>
                          </div>

                          {/* Subline Client & Localisation & Équipe */}
                          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs">
                            {m.customer !== null ? (
                              <span className="font-medium text-foreground/80">
                                {m.customer.name}
                              </span>
                            ) : null}

                            {m.site !== null ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3 shrink-0" aria-hidden="true" />
                                {m.site.name} {m.site.city ? `(${m.site.city})` : ''}
                              </span>
                            ) : null}

                            {m.assigned_team !== null ? (
                              <span className="flex items-center gap-1">
                                <span
                                  aria-hidden="true"
                                  className="size-2 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor:
                                      m.assigned_team.color ?? 'var(--color-border-strong)',
                                  }}
                                />
                                {m.assigned_team.name}
                              </span>
                            ) : null}
                          </div>

                          {/* Fine barre de progression visuelle d'avancement */}
                          <div className="w-full bg-surface-sunken rounded-full h-1.5 overflow-hidden mt-1">
                            <div
                              className={`h-full transition-all duration-300 ${
                                m.status === 'completed'
                                  ? 'bg-emerald-500'
                                  : m.status === 'in_progress'
                                    ? 'bg-primary'
                                    : 'bg-amber-500'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <MissionStatusBadge status={m.status} />
                          <Button
                            asChild
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Link to={ROUTES.mission(m.id)}>
                              <ArrowRight className="size-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colonne Droite (1/3) : Traçabilité & Fil d'activité Cliquable */}
        <div className="space-y-4">
          <Card className="h-auto">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Activity className="size-4.5 text-primary" />
                Traçabilité & Activités récentes
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-4">
              {recentLogs.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Activity className="size-7 text-subtle-foreground/50 mx-auto" />
                  <p className="text-xs font-medium text-muted-foreground">Aucune activité récente</p>
                  <p className="text-2xs text-subtle-foreground">
                    Les actions d&apos;équipe et modifications de statut apparaîtront ici.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-surface-hover/70"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 mt-0.5">
                        <Clock className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-foreground text-xs font-medium leading-snug">
                          {log.action}
                        </p>
                        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                          <span>
                            {new Date(log.created_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
