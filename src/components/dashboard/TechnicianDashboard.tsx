import { ArrowRight, Briefcase, Calendar, ClipboardList, FileText, MapPin, User, Wrench } from 'lucide-react';
import { Link } from 'react-router';

import { displayNameOf } from '@/components/layout/user-display';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { useCurrentIndustry, useLabel } from '@/features/industries';
import { MissionStatusBadge, useMissions } from '@/features/missions';
import { useCurrentOrganization } from '@/features/organizations';

export function TechnicianDashboard() {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { label: industryLabel, isResolved } = useCurrentIndustry();

  const jobPlural = useLabel('job', true);
  const jobSingular = useLabel('job');
  const workerSingular = useLabel('worker');

  const missions = useMissions(organizationId, { limit: 5 });
  const myMissions = missions.data ?? [];
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
          Bonjour, {nameToDisplay} 👋
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

      {/* 1. Mes Missions du Jour */}
      <Card className="border-border bg-surface">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            Mes {jobPlural} & Interventions confiées
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to={ROUTES.missions}>
              Voir toutes mes {jobPlural.toLowerCase()}
              <ArrowRight className="size-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {myMissions.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Calendar className="size-8 text-subtle-foreground/60 mx-auto" />
              <p className="text-xs text-muted-foreground font-medium">Aucun {jobSingular.toLowerCase()} planifié pour le moment.</p>
              <p className="text-2xs text-subtle-foreground">Vos prochaines interventions attribuées par votre responsable apparaîtront ici.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {myMissions.map((mission) => (
                <li key={mission.id} className="py-3 first:pt-0">
                  <Link to={ROUTES.mission(mission.id)} className="block group">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="font-mono text-2xs shrink-0">{mission.reference}</Badge>
                        <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {mission.title}
                        </span>
                      </div>
                      <MissionStatusBadge status={mission.status} />
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {mission.customer?.name ? <span>Client: <strong className="text-foreground/80">{mission.customer.name}</strong></span> : null}
                      {mission.site?.city ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3 text-primary" />
                          {mission.site.city}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
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

          <Link
            to={ROUTES.notes}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-surface text-center hover:border-amber-500/50 hover:bg-surface-hover transition-all group"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-2 group-hover:scale-105 transition-transform">
              <FileText className="size-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">Bloc-notes Terrain</span>
            <span className="text-2xs text-muted-foreground mt-0.5">Digicodes & mémos</span>
          </Link>

          <Link
            to={ROUTES.missions}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-surface text-center hover:border-emerald-500/50 hover:bg-surface-hover transition-all group"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2 group-hover:scale-105 transition-transform">
              <ClipboardList className="size-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">{jobPlural}</span>
            <span className="text-2xs text-muted-foreground mt-0.5">Historique & rapports</span>
          </Link>

          <Link
            to={ROUTES.profile}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-surface text-center hover:border-sky-500/50 hover:bg-surface-hover transition-all group"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 mb-2 group-hover:scale-105 transition-transform">
              <User className="size-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">Mon Profil</span>
            <span className="text-2xs text-muted-foreground mt-0.5">Identifiants & compte</span>
          </Link>
        </div>
      </div>

      {/* 3. Bloc-notes & Aide-mémoire Terrain */}
      <Card className="border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground flex items-center gap-2">
                Mon Bloc-notes & Aide-mémoire Terrain
              </p>
              <p className="text-2xs text-muted-foreground">
                Consignez vos digicodes, mémos de chantier et notes d&apos;intervention.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link to={ROUTES.notes}>
              Ouvrir mon Bloc-notes
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
