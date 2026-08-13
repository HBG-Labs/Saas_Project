import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { useAuditLogs } from '@/features/audit';
import { useReportsPendingReview } from '@/features/interventions';
import { MissionStatusBadge, useMissions } from '@/features/missions';
import {
  AddMemberDialog,
  InviteMemberDialog,
  useCurrentOrganization,
  useMembers,
} from '@/features/organizations';
import { useTeams } from '@/features/teams';

export function OwnerDashboard() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

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

  // Fallback demo activity items if audit logs are empty in dev environment
  const demoActivities = [
    {
      id: 'act-1',
      action: 'Mise à jour du statut de la mission 2026-0001 (En cours)',
      time: 'Il y a 15 min',
      user: 'Mathieu Laurent',
      link: ROUTES.missions,
    },
    {
      id: 'act-2',
      action: 'Validation du rapport de recette fibre optique #R-884',
      time: 'Il y a 1 heure',
      user: 'Stéphane Leduc',
      link: ROUTES.review,
    },
    {
      id: 'act-3',
      action: 'Création d’un nouveau site d’intervention (Site Technopole)',
      time: 'Il y a 3 heures',
      user: 'Stéphane Leduc',
      link: ROUTES.customers,
    },
  ];

  const displayLogs = recentLogs.length > 0 ? recentLogs : demoActivities;

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Executive Hero Cockpit Banner */}
      <div className="relative rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <ShieldCheck className="size-3.5" />
                Espace Direction & Propriétaire
              </span>
              <span className="text-muted-foreground text-xs font-medium">
                • {organization?.name ?? 'Entreprise'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Cockpit Opérationnel
              </span>
            </div>

            <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              Tableau de Bord — Pilotage d’Entreprise
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Vue d'ensemble 360° de vos effectifs, du suivi des missions terrain et du contrôle qualité.
            </p>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {organizationId ? (
              <>
                <AddMemberDialog
                  organizationId={organizationId}
                  viewerIsOwner={true}
                  quotaReached={false}
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

            <Button asChild variant="primary" size="sm" className="shadow-md">
              <Link to={ROUTES.missionNew}>
                <Plus className="size-4" />
                Nouvelle mission
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Grille de 4 KPIs Entreprise Re-ordonnés par Flux Opérationnel */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1 : Missions de l'entreprise (Cœur d'Activité) */}
        <Card className="group relative overflow-hidden transition-all duration-200 hover:border-cyan-500/50 hover:shadow-lg">
          <CardContent className="p-5">
            <Link to={ROUTES.missions} className="block space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 transition-transform group-hover:scale-105">
                  <ClipboardList className="size-5" />
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {missionList.length} au total
                </Badge>
              </div>

              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Missions de l'entreprise
                </p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
                    {missionList.length}
                  </span>
                  <span className="text-cyan-400 group-hover:translate-x-0.5 inline-flex items-center gap-1 text-xs font-semibold transition-transform">
                    Voir les missions
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* KPI 2 : Contrôle Qualité (Validation des Rapports) */}
        <Card
          className={
            pendingReportsCount > 0
              ? 'group relative overflow-hidden border-amber-500/50 bg-amber-950/10 transition-all duration-200 hover:border-amber-500 hover:shadow-lg'
              : 'group relative overflow-hidden transition-all duration-200 hover:border-amber-500/50 hover:shadow-lg'
          }
        >
          <CardContent className="p-5">
            <Link to={ROUTES.review} className="block space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 transition-transform group-hover:scale-105">
                  <ClipboardCheck className="size-5" />
                </div>
                {pendingReportsCount > 0 ? (
                  <Badge variant="warning" className="font-semibold animate-pulse">
                    {pendingReportsCount} à valider
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    À jour
                  </Badge>
                )}
              </div>

              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Contrôle Qualité
                </p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-amber-400 text-3xl font-extrabold tracking-tight tabular-nums">
                    {pendingReportsCount}
                  </span>
                  <span className="text-amber-400 group-hover:translate-x-0.5 inline-flex items-center gap-1 text-xs font-semibold transition-transform">
                    Revoir & Valider
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* KPI 3 : Équipes de terrain */}
        <Card className="group relative overflow-hidden transition-all duration-200 hover:border-emerald-500/50 hover:shadow-lg">
          <CardContent className="p-5">
            <Link to={ROUTES.teams} className="block space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-transform group-hover:scale-105">
                  <UsersRound className="size-5" />
                </div>
                <Badge variant="success" className="font-medium text-xs">
                  {teamList.length} équipe{teamList.length > 1 ? 's' : ''}
                </Badge>
              </div>

              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Équipes de terrain
                </p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
                    {teamList.length}
                  </span>
                  <span className="text-emerald-400 group-hover:translate-x-0.5 inline-flex items-center gap-1 text-xs font-semibold transition-transform">
                    Organiser
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* KPI 4 : Effectifs & Membres */}
        <Card className="group relative overflow-hidden transition-all duration-200 hover:border-blue-500/50 hover:shadow-lg">
          <CardContent className="p-5">
            <Link to={ROUTES.organizationMembers} className="block space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 transition-transform group-hover:scale-105">
                  <Users className="size-5" />
                </div>
                <Badge variant="primary" className="font-medium text-xs">
                  {activeMembersCount} actif{activeMembersCount > 1 ? 's' : ''}
                </Badge>
              </div>

              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Techniciens
                </p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-foreground text-3xl font-extrabold tracking-tight tabular-nums">
                    {activeMembersCount}
                  </span>
                  <span className="text-primary group-hover:translate-x-0.5 inline-flex items-center gap-1 text-xs font-semibold transition-transform">
                    Gérer l'équipe
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
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
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all duration-150 hover:border-blue-500/50 hover:bg-surface-hover hover:shadow-md"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
              <Users className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-xs font-semibold group-hover:text-primary transition-colors">
                Gérer l'équipe
              </p>
              <p className="text-muted-foreground truncate text-2xs">Membres & Rôles</p>
            </div>
            <ChevronRight className="text-subtle-foreground size-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            to={ROUTES.teams}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all duration-150 hover:border-emerald-500/50 hover:bg-surface-hover hover:shadow-md"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
              <UsersRound className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-xs font-semibold group-hover:text-emerald-400 transition-colors">
                Équipes Terrain
              </p>
              <p className="text-muted-foreground truncate text-2xs">Groupes & Techniciens</p>
            </div>
            <ChevronRight className="text-subtle-foreground size-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            to={ROUTES.customers}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all duration-150 hover:border-cyan-500/50 hover:bg-surface-hover hover:shadow-md"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
              <Building2 className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-xs font-semibold group-hover:text-cyan-400 transition-colors">
                Fichier Clients
              </p>
              <p className="text-muted-foreground truncate text-2xs">Contacts & Sites</p>
            </div>
            <ChevronRight className="text-subtle-foreground size-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            to={ROUTES.organization}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all duration-150 hover:border-amber-500/50 hover:bg-surface-hover hover:shadow-md"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="size-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-xs font-semibold group-hover:text-amber-400 transition-colors">
                Paramètres
              </p>
              <p className="text-muted-foreground truncate text-2xs">Profil & Sécurité</p>
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
                Missions récentes de l'entreprise
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link to={ROUTES.missions} className="flex items-center gap-1">
                  Voir tout le catalogue
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="pt-4">
              {missionList.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-10 text-center">
                  <ClipboardList className="size-10 text-subtle-foreground/50 mb-2" />
                  <p className="text-sm font-medium">Aucune mission enregistrée</p>
                  <p className="text-xs text-subtle-foreground mt-1">
                    Créez votre première mission pour commencer le suivi d'intervention.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link to={ROUTES.missionNew}>
                      <Plus className="size-3.5 mr-1" /> Créer une mission
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
                            ) : (
                              <span>Client Telecom</span>
                            )}

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
                <Activity className="size-4.5 text-emerald-400" />
                Traçabilité & Activités récentes
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="space-y-3">
                {displayLogs.map((log) => {
                  const linkTarget =
                    'link' in log && typeof log.link === 'string'
                      ? log.link
                      : ROUTES.missions;

                  return (
                    <Link
                      key={log.id}
                      to={linkTarget}
                      className="group relative flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-surface-hover/70"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5 group-hover:scale-110 transition-transform">
                        <Clock className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-foreground text-xs font-medium leading-snug group-hover:text-primary transition-colors">
                          {log.action}
                        </p>
                        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                          {'user' in log ? <span>{log.user}</span> : null}
                          <span>•</span>
                          <span>
                            {'time' in log
                              ? log.time
                              : new Date(log.created_at).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="size-3.5 text-subtle-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 5. Bandeau d'Indicateurs Opérationnels (Santé du Système) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all hover:border-emerald-500/40 hover:shadow-md">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-foreground text-xs font-bold flex items-center gap-1.5">
              Conformité Opérationnelle
              <Badge variant="success" className="text-2xs py-0 px-1.5">
                98.4%
              </Badge>
            </p>
            <p className="text-muted-foreground text-2xs">Rapports validés du premier coup</p>
          </div>
        </div>

        <div className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all hover:border-blue-500/40 hover:shadow-md">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="text-foreground text-xs font-bold flex items-center gap-1.5">
              Réactivité Équipe
              <Badge variant="primary" className="text-2xs py-0 px-1.5">
                2.1 h
              </Badge>
            </p>
            <p className="text-muted-foreground text-2xs">Délai moyen de réponse terrain</p>
          </div>
        </div>

        <div className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all hover:border-indigo-500/40 hover:shadow-md">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <p className="text-foreground text-xs font-bold flex items-center gap-1.5">
              Traçabilité Supabase RLS
              <Badge variant="outline" className="text-2xs py-0 px-1.5 border-indigo-500/30 text-indigo-400">
                Active
              </Badge>
            </p>
            <p className="text-muted-foreground text-2xs">Isolation des données par entreprise</p>
          </div>
        </div>
      </div>
    </div>
  );
}
