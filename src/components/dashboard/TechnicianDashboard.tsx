import { ArrowRight, Briefcase, Calendar, ClipboardList, FileText, MapPin, User, Wrench } from 'lucide-react';
import { Link } from 'react-router';

import { displayNameOf } from '@/components/layout/user-display';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { formatNoneNoun, useCurrentIndustry, useLabel } from '@/features/industries';
import { ACTIVE_STATUSES, MissionStatusBadge, useMissions } from '@/features/missions';
import { useCurrentOrganization } from '@/features/organizations';

export function TechnicianDashboard() {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { label: industryLabel, isResolved } = useCurrentIndustry();

  const jobPlural = useLabel('job', true);
  const jobSingular = useLabel('job');
  const workerSingular = useLabel('worker');

  const missions = useMissions(organizationId, { status: ACTIVE_STATUSES, limit: 5 });
  const myMissions = missions.data ?? [];
  const [nextMission, ...followingMissions] = myMissions;
  const nameToDisplay = displayNameOf(user);

  return (
    <div className="space-y-8 pb-12">
      {/* Header Technicien */}
      <div className="border-b border-border pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
            Espace {workerSingular} Terrain
          </span>
          {isResolved && industryLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-2xs font-medium text-muted-foreground">
              <Briefcase className="size-3 text-primary" />
              {industryLabel}
            </span>
          ) : null}
          {organization ? <span className="text-xs text-muted-foreground">• {organization.name}</span> : null}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Bonjour, {nameToDisplay}
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Retrouvez vos {jobPlural.toLowerCase()} confiées et accédez directement à vos outils de terrain.
        </p>

        {/* Raccourcis Terrain Rapides */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link to={ROUTES.planning}>
              <Calendar className="size-3.5 mr-1.5 text-primary" />
              Mon Planning
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link to={ROUTES.map}>
              <MapPin className="size-3.5 mr-1.5 text-primary" />
              Carte des chantiers
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link to={ROUTES.missions}>
              <ClipboardList className="size-3.5 mr-1.5 text-primary" />
              Mes {jobPlural.toLowerCase()}
            </Link>
          </Button>
        </div>
      </div>

      {/* 1. La prochaine action terrain, puis seulement le reste de la file. */}
      <Card className="border-border bg-surface overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            À traiter en priorité
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to={ROUTES.missions}>
              Voir toutes mes {jobPlural.toLowerCase()}
              <ArrowRight className="size-3.5 ml-1" />
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
          ) : nextMission === undefined ? (
            <div className="py-8 text-center space-y-2">
              <Calendar className="size-8 text-subtle-foreground/60 mx-auto" />
              <p className="text-xs text-muted-foreground font-medium">{formatNoneNoun(jobSingular, 'planifié')} pour le moment.</p>
              <p className="text-2xs text-subtle-foreground">Vos prochaines interventions attribuées par votre responsable apparaîtront ici.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Link
                to={ROUTES.mission(nextMission.id)}
                className="border-primary/25 bg-primary-subtle/35 hover:border-primary/45 group block rounded-xl border p-4 transition-[background-color,border-color,box-shadow] hover:shadow-raised sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className="bg-surface shrink-0 font-mono text-2xs">
                    {nextMission.reference}
                  </Badge>
                  <MissionStatusBadge status={nextMission.status} />
                </div>

                <h2 className="text-foreground group-hover:text-primary mt-3 text-lg font-bold tracking-tight transition-colors sm:text-xl">
                  {nextMission.title}
                </h2>

                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {nextMission.scheduled_start !== null ? (
                    <span className="text-foreground font-semibold capitalize">
                      {new Date(nextMission.scheduled_start).toLocaleString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  ) : (
                    <span>Date à confirmer</span>
                  )}
                  {nextMission.customer?.name ? <span>{nextMission.customer.name}</span> : null}
                  {nextMission.site?.city ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="text-primary size-3.5" aria-hidden="true" />
                      {nextMission.site.city}
                    </span>
                  ) : null}
                </div>

                <span className="text-primary mt-4 inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold sm:min-h-0">
                  Ouvrir la mission
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>

              {followingMissions.length > 0 ? (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                    Ensuite
                  </p>
                  <ul className="divide-border divide-y">
                    {followingMissions.map((mission) => (
                      <li key={mission.id}>
                        <Link
                          to={ROUTES.mission(mission.id)}
                          className="hover:bg-surface-hover group flex min-h-touch items-center gap-3 rounded-lg py-2.5 transition-colors sm:min-h-0"
                        >
                          <Badge variant="outline" className="shrink-0 font-mono text-2xs">
                            {mission.reference}
                          </Badge>
                          <span className="text-foreground group-hover:text-primary min-w-0 flex-1 truncate text-sm font-medium transition-colors">
                            {mission.title}
                          </span>
                          <MissionStatusBadge status={mission.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Accès Rapide aux Outils Métier */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Wrench className="size-4 text-primary" />
            Outils & Utilitaires Métier
          </h2>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to={ROUTES.tools} className="flex items-center gap-1">
              Catalogue complet
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Missions */}
          <Link
            to={ROUTES.missions}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-surface text-center hover:border-primary/40 hover:bg-surface-hover transition-all group"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-subtle text-primary mb-2 group-hover:scale-105 transition-transform">
              <ClipboardList className="size-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">{jobPlural}</span>
            <span className="text-2xs text-muted-foreground mt-0.5">Historique & rapports</span>
          </Link>

          {/* 2. Bloc-notes Terrain */}
          <Link
            to={ROUTES.notes}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-surface text-center hover:border-primary/40 hover:bg-surface-hover transition-all group"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-subtle text-primary mb-2 group-hover:scale-105 transition-transform">
              <FileText className="size-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">Bloc-notes Terrain</span>
            <span className="text-2xs text-muted-foreground mt-0.5">Digicodes & mémos</span>
          </Link>

          {/* 3. Calculateurs */}
          <Link
            to={ROUTES.tools}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-surface text-center hover:border-primary/50 hover:bg-surface-hover transition-all group"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2 group-hover:scale-105 transition-transform">
              <Wrench className="size-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">Calculateurs</span>
            <span className="text-2xs text-muted-foreground mt-0.5">Outils de dimensionnement</span>
          </Link>

          {/* 4. Mon Profil */}
          <Link
            to={ROUTES.profile}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-surface text-center hover:border-primary/40 hover:bg-surface-hover transition-all group"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-subtle text-primary mb-2 group-hover:scale-105 transition-transform">
              <User className="size-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">Mon Profil</span>
            <span className="text-2xs text-muted-foreground mt-0.5">Identifiants & compte</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
