import {
  Calendar,
  Building2,
  ClipboardList,
  Download,
  FileText,
  Map as MapIcon,
  MapPin,
  Navigation,
  Phone,
  Plus,
  User,
  Eye,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatNoneNoun, useLabel } from '@/features/industries';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { openNavigationApp } from '@/features/geo';
import {
  countActiveFilters,
  EMPTY_MISSION_FILTERS,
  exportMissionsToCsv,
  MissionFiltersBar,
  MissionsNavTabs,
  MissionPriorityBadge,
  MissionStatusBadge,
  MISSION_STATUS_LABELS,
  toMissionQuery,
  useMissionStatusCounts,
  useMissions,
} from '@/features/missions';
import { useOrganizationEntitlements } from '@/features/billing';
import {
  PERMISSIONS,
  useCurrentOrganization,
  usePermission,
  memberDisplayName,
} from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { MissionStatus } from '@/types/database';

export default function MissionsListPage() {
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;
  const { has: hasFeature } = useOrganizationEntitlements(organizationId);

  const [filters, setFilters] = useState(EMPTY_MISSION_FILTERS);

  const missions = useMissions(organizationId, toMissionQuery(filters));
  const statusCounts = useMissionStatusCounts(organizationId);
  // « Missions » chez un fibreur, « Chantiers » chez un paysagiste.
  const jobPlural = useLabel('job', true);
  const jobSingular = useLabel('job');

  useDocumentTitle(jobPlural);

  const canCreate = can(PERMISSIONS.missionCreate);
  const canViewAll = can(PERMISSIONS.missionViewAll);
  const canViewPlanning = hasFeature('planning') && can(PERMISSIONS.planningView);
  const activeFilters = countActiveFilters(filters);
  const list = missions.data ?? [];

  /**
   * États réellement peuplés, hors celui déjà sélectionné.
   */
  const counts: Record<string, number> = statusCounts.data ?? {};
  const elsewhere = (Object.keys(MISSION_STATUS_LABELS) as MissionStatus[])
    .filter((status) => (counts[status] ?? 0) > 0 && status !== filters.status)
    .map((status) => [status, counts[status] ?? 0] as const);

  return (
    <div className="space-y-6">
      <PageHeader
        className="sm:flex-col xl:flex-row"
        title={jobPlural}
        description={
          canViewAll
            ? `Gestion, qualification et suivi opérationnel de tous les ${jobPlural.toLowerCase()} de l’entreprise.`
            : `Vos ${jobPlural.toLowerCase()} confiés et à traiter sur le terrain.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                exportMissionsToCsv(list, `missions-${new Date().toISOString().slice(0, 10)}.csv`)
              }
              className="text-xs"
              disabled={list.length === 0}
              title="Exporter les missions affichées en fichier CSV"
            >
              <Download className="mr-1 size-3.5" />
              CSV
            </Button>

            {canViewPlanning && (
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link to={ROUTES.planning}>
                  <Calendar className="text-primary mr-1 size-3.5" />
                  Planning
                </Link>
              </Button>
            )}

            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link to={ROUTES.map}>
                <MapIcon className="text-primary mr-1 size-3.5" />
                Carte
              </Link>
            </Button>

            {canCreate ? (
              <Button asChild variant="primary" size="sm" className="text-xs">
                <Link to={ROUTES.missionNew}>
                  <Plus className="mr-1 size-4" />
                  Nouvelle mission
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <MissionsNavTabs />

      {/* Bannière de guidage pour les comptes-rendus terrain */}
      <div className="border-border text-muted-foreground flex items-center gap-3 border-b pb-4 text-sm">
        <div className="flex items-center gap-2.5">
          <FileText className="text-primary size-4 shrink-0" />
          <span>
            <strong>Interventions terrain :</strong> Ouvrez une mission pour démarrer
            l’intervention, enregistrer vos temps et compléter le compte-rendu.
          </span>
        </div>
      </div>

      <MissionFiltersBar
        organizationId={organizationId}
        value={filters}
        onChange={setFilters}
        showAdvanced={canViewAll}
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
        <div className="space-y-4">
          <EmptyState
            {...(activeFilters > 0
              ? { icon: ClipboardList }
              : { illustration: <AtelierIllustration subject="missions" /> })}
            title={activeFilters > 0 ? 'Aucun résultat' : formatNoneNoun(jobSingular, 'en cours')}
            description={
              activeFilters > 0
                ? 'Aucune intervention ne correspond aux filtres appliqués.'
                : 'Les nouvelles demandes d’intervention apparaîtront ici dès leur création.'
            }
            action={
              activeFilters > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(EMPTY_MISSION_FILTERS)}
                >
                  Réinitialiser les filtres
                </Button>
              ) : canCreate ? (
                <Button asChild variant="primary" size="sm">
                  <Link to={ROUTES.missionNew}>
                    <Plus className="mr-1 size-4" />
                    Créer une première mission
                  </Link>
                </Button>
              ) : undefined
            }
          />

          {elsewhere.length > 0 ? (
            <div className="space-y-2 pt-2 text-center">
              <p className="text-muted-foreground text-xs">Vos autres missions se trouvent ici :</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {elsewhere.map(([status, count]) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setFilters({ ...EMPTY_MISSION_FILTERS, status });
                    }}
                    className="border-border bg-surface hover:border-primary/50 hover:text-foreground text-muted-foreground text-2xs cursor-pointer rounded-full border px-2.5 py-1 font-medium transition-colors"
                  >
                    {MISSION_STATUS_LABELS[status]} · {count}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        /* Liste opérationnelle : l'information utile avant les actions. */
        <div
          aria-label="Liste des missions"
          className="border-border bg-surface divide-border divide-y overflow-hidden rounded-lg border"
        >
          {list.map((mission) => {
            const hasLocation =
              (mission.latitude !== null && mission.longitude !== null) ||
              Boolean(mission.address_line1 || mission.city);
            const addressText =
              mission.address_line1 ?? mission.location_label ?? mission.city ?? null;

            return (
              <div
                key={mission.id}
                className="hover:bg-surface-hover group grid min-w-0 gap-3 p-4 transition-colors xl:grid-cols-[minmax(0,1fr)_13rem_9rem] xl:items-center xl:gap-5 xl:py-3"
              >
                {/* Ligne 1 : Badges, Réf, Date & Statut */}
                <div className="flex flex-wrap items-center justify-between gap-2 xl:order-2 xl:flex-col xl:items-start">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-2xs font-mono font-bold">
                      {mission.reference}
                    </Badge>
                    <MissionPriorityBadge priority={mission.priority} />
                    <MissionStatusBadge status={mission.status} />

                    {mission.assigned_team !== null && (
                      <span className="bg-surface-subtle text-3xs text-muted-foreground border-border inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold">
                        <span
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor:
                              mission.assigned_team.color ?? 'var(--color-border-strong)',
                          }}
                        />
                        {mission.assigned_team.name}
                      </span>
                    )}
                  </div>

                  <span className="text-muted-foreground text-xs font-semibold tabular-nums">
                    {mission.scheduled_start !== null
                      ? new Date(mission.scheduled_start).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Non planifiée'}
                  </span>
                </div>

                {/* Ligne 2 : Titre & Client */}
                <div className="min-w-0 xl:order-1">
                  <Link
                    to={ROUTES.mission(mission.id)}
                    className="text-foreground group-hover:text-primary block text-sm font-bold transition-colors sm:text-base"
                  >
                    {mission.title}
                  </Link>

                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    {mission.customer !== null && (
                      <span className="text-foreground/90 font-semibold">
                        <Building2
                          className="text-primary mr-1 inline size-3.5 align-[-0.125em]"
                          aria-hidden="true"
                        />
                        {mission.customer.name}
                      </span>
                    )}

                    {mission.site !== null && (
                      <span className="flex items-center gap-1">
                        <MapPin className="text-primary size-3 shrink-0" />
                        {mission.site.name} {mission.site.city ? `(${mission.site.city})` : ''}
                      </span>
                    )}

                    {mission.assigned_member !== null && (
                      <span className="text-primary flex items-center gap-1 font-medium">
                        <User className="size-3" />
                        {memberDisplayName(mission.assigned_member)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ligne 3 : Actions rapides */}
                <div className="border-border flex flex-wrap items-center gap-2 border-t pt-2 xl:order-3 xl:border-t-0 xl:pt-0">
                  {hasLocation && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        if (mission.latitude !== null && mission.longitude !== null) {
                          openNavigationApp({
                            latitude: mission.latitude,
                            longitude: mission.longitude,
                            ...(addressText ? { address: addressText } : {}),
                          });
                        } else if (addressText) {
                          openNavigationApp({
                            address: addressText,
                          });
                        }
                      }}
                      className="gap-1.5 px-3 xl:w-9 xl:px-0"
                      title="Lancer l'itinéraire GPS"
                    >
                      <Navigation className="size-3.5" aria-hidden="true" />
                      <span className="xl:sr-only">Itinéraire</span>
                    </Button>
                  )}

                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="gap-1.5 px-3 xl:w-9 xl:px-0"
                  >
                    <Link to={ROUTES.mission(mission.id)} title="Voir la fiche">
                      <Eye className="text-primary size-3" />
                      <span className="xl:sr-only">Voir la fiche</span>
                    </Link>
                  </Button>

                  {mission.customer_phone && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground px-3 xl:w-9 xl:px-0"
                    >
                      <a href={`tel:${mission.customer_phone}`} title="Appeler le client">
                        <Phone className="text-success mr-1 size-3" />
                        <span className="xl:sr-only">Appeler</span>
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
