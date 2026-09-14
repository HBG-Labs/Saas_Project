import {
  ArrowRight,
  Briefcase,
  Calendar,
  ClipboardList,
  FileText,
  MapPin,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
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

  const quickAccess: {
    to: string;
    title: string;
    description: string;
    icon: LucideIcon;
  }[] = [
    {
      to: ROUTES.missions,
      title: jobPlural,
      description: 'Historique et rapports',
      icon: ClipboardList,
    },
    {
      to: ROUTES.notes,
      title: 'Bloc-notes terrain',
      description: 'Digicodes et mémos',
      icon: FileText,
    },
    {
      to: ROUTES.tools,
      title: 'Calculateurs',
      description: 'Outils de dimensionnement',
      icon: Wrench,
    },
    {
      to: ROUTES.profile,
      title: 'Mon profil',
      description: 'Identifiants et compte',
      icon: User,
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header Technicien : un espace identifiable sans devenir une carte KPI. */}
      <div className="border-border/80 bg-surface before:bg-primary relative overflow-hidden rounded-2xl border p-4 shadow-xs before:absolute before:inset-y-0 before:left-0 before:w-1 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-primary-subtle text-primary border-primary/20 rounded-lg border px-2.5 py-1 text-xs font-semibold">
            Espace {workerSingular.toLowerCase()} terrain
          </span>
          {isResolved && industryLabel ? (
            <span className="border-border bg-surface-sunken text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
              <Briefcase className="text-primary size-3" aria-hidden="true" />
              {industryLabel}
            </span>
          ) : null}
          {organization ? (
            <span className="text-muted-foreground text-xs">• {organization.name}</span>
          ) : null}
        </div>
        <h1 className="text-foreground mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Bonjour, {nameToDisplay}
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Retrouvez vos {jobPlural.toLowerCase()} confiées et accédez directement à vos outils de
          terrain.
        </p>

        {/* Raccourcis Terrain Rapides */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.planning}>
              <Calendar className="text-primary size-3.5" aria-hidden="true" />
              Mon planning
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.map}>
              <MapPin className="text-primary size-3.5" aria-hidden="true" />
              Carte des chantiers
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.missions}>
              <ClipboardList className="text-primary size-3.5" aria-hidden="true" />
              Mes {jobPlural.toLowerCase()}
            </Link>
          </Button>
        </div>
      </div>

      {/* 1. La prochaine action terrain, puis seulement le reste de la file. */}
      <Card className="border-border bg-surface overflow-hidden">
        <CardHeader className="border-border flex flex-row items-center justify-between border-b">
          <CardTitle className="text-foreground flex items-center gap-2">
            <ClipboardList className="text-primary size-4.5" aria-hidden="true" />À traiter en
            priorité
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to={ROUTES.missions}>
              <span className="hidden sm:inline">Toutes mes {jobPlural.toLowerCase()}</span>
              <span className="sm:hidden">Voir tout</span>
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
          ) : nextMission === undefined ? (
            <div className="space-y-2 py-8 text-center">
              <Calendar className="text-subtle-foreground/60 mx-auto size-8" aria-hidden="true" />
              <p className="text-muted-foreground text-sm font-medium">
                {formatNoneNoun(jobSingular, 'planifié')} pour le moment.
              </p>
              <p className="text-subtle-foreground mx-auto max-w-md text-sm">
                Vos prochaines interventions attribuées par votre responsable apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Link
                to={ROUTES.mission(nextMission.id)}
                className="border-primary/25 bg-primary-subtle/35 hover:border-primary/45 group hover:shadow-raised block rounded-xl border p-4 transition-[background-color,border-color,box-shadow] sm:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className="bg-surface text-2xs shrink-0 font-mono">
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

                <span className="text-primary min-h-touch mt-4 inline-flex items-center gap-1.5 text-sm font-semibold sm:min-h-0">
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
                          className="hover:bg-surface-hover group min-h-touch flex items-center gap-3 rounded-lg py-2.5 transition-colors sm:min-h-0"
                        >
                          <Badge variant="outline" className="text-2xs shrink-0 font-mono">
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

      {/* 2. Accès rapide aux outils métier */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-foreground flex items-center gap-2 text-base font-bold">
            <Wrench className="text-primary size-4.5" aria-hidden="true" />
            Outils et utilitaires métier
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to={ROUTES.tools}>
              Catalogue complet
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div className="xs:grid-cols-2 grid grid-cols-1 gap-3 lg:grid-cols-4">
          {quickAccess.map(({ to, title, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group border-border/80 bg-surface hover:border-primary/30 hover:shadow-raised flex min-h-24 items-center gap-3 rounded-xl border p-4 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 lg:flex-col lg:items-start"
            >
              <span className="bg-primary-subtle text-primary flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="text-foreground group-hover:text-primary block text-sm font-semibold transition-colors">
                  {title}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-sm leading-snug">
                  {description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
