import {
  Calendar,
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

  const [filters, setFilters] = useState(EMPTY_MISSION_FILTERS);

  const missions = useMissions(organizationId, toMissionQuery(filters));
  const statusCounts = useMissionStatusCounts(organizationId);
  // « Missions » chez un fibreur, « Chantiers » chez un paysagiste.
  const jobPlural = useLabel('job', true);
  const jobSingular = useLabel('job');

  useDocumentTitle(jobPlural);

  const canCreate = can(PERMISSIONS.missionCreate);
  const canViewAll = can(PERMISSIONS.missionViewAll);
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
        title={jobPlural}
        description={
          canViewAll
            ? `Gestion, qualification et suivi opérationnel de tous les ${jobPlural.toLowerCase()} de l’entreprise.`
            : `Vos ${jobPlural.toLowerCase()} confiés et à traiter sur le terrain.`
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                exportMissionsToCsv(
                  list,
                  `missions-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              className="text-xs"
              disabled={list.length === 0}
              title="Exporter les missions affichées en fichier CSV"
            >
              <Download className="size-3.5 mr-1" />
              CSV
            </Button>

            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link to={ROUTES.planning}>
                <Calendar className="size-3.5 mr-1 text-primary" />
                Planning
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link to={ROUTES.map}>
                <MapIcon className="size-3.5 mr-1 text-primary" />
                Carte
              </Link>
            </Button>

            {canCreate ? (
              <Button asChild variant="primary" size="sm" className="text-xs">
                <Link to={ROUTES.missionNew}>
                  <Plus className="size-4 mr-1" />
                  Nouvelle mission
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <MissionsNavTabs />

      {/* Bannière de guidage pour les comptes-rendus terrain */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center justify-between gap-3 text-xs text-foreground">
        <div className="flex items-center gap-2.5">
          <FileText className="size-4 shrink-0 text-primary" />
          <span>
            <strong>Interventions terrain :</strong> Ouvrez une mission pour démarrer l’intervention, enregistrer vos temps et compléter le compte-rendu.
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
            icon={ClipboardList}
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
                    <Plus className="size-4 mr-1" />
                    Créer une première mission
                  </Link>
                </Button>
              ) : undefined
            }
          />

          {elsewhere.length > 0 ? (
            <div className="space-y-2 text-center pt-2">
              <p className="text-muted-foreground text-xs">Vos autres missions se trouvent ici :</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {elsewhere.map(([status, count]) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setFilters({ ...EMPTY_MISSION_FILTERS, status });
                    }}
                    className="border-border bg-surface hover:border-primary/50 hover:text-foreground text-muted-foreground cursor-pointer rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors"
                  >
                    {MISSION_STATUS_LABELS[status]} · {count}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        /* 📋 LISTE MODERNE DES MISSIONS */
        <div className="space-y-3">
          {list.map((mission) => {
            const hasLocation =
              (mission.latitude !== null && mission.longitude !== null) ||
              Boolean(mission.address_line1 || mission.city);
            const addressText =
              mission.address_line1 ??
              mission.location_label ??
              mission.city ??
              null;

            return (
              <div
                key={mission.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-surface border border-border hover:border-primary/40 shadow-2xs hover:shadow-xs transition-all space-y-3 group"
              >
                {/* Ligne 1 : Badges, Réf, Date & Statut */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-2xs font-bold">
                      {mission.reference}
                    </Badge>
                    <MissionPriorityBadge priority={mission.priority} />
                    <MissionStatusBadge status={mission.status} />

                    {mission.assigned_team !== null && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-subtle text-3xs font-semibold text-muted-foreground border border-border">
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

                  <span className="text-muted-foreground font-mono text-xs tabular-nums font-semibold">
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
                <div>
                  <Link
                    to={ROUTES.mission(mission.id)}
                    className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors block"
                  >
                    {mission.title}
                  </Link>

                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {mission.customer !== null && (
                      <span className="font-semibold text-foreground/90">
                        🏢 {mission.customer.name}
                      </span>
                    )}

                    {mission.site !== null && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3 text-primary shrink-0" />
                        {mission.site.name} {mission.site.city ? `(${mission.site.city})` : ''}
                      </span>
                    )}

                    {mission.assigned_member !== null && (
                      <span className="flex items-center gap-1 text-primary font-medium">
                        <User className="size-3" />
                        {memberDisplayName(mission.assigned_member)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ligne 3 : Actions rapides */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/50 flex-wrap">
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
                      className="text-3xs h-7 px-2.5 gap-1.5 cursor-pointer"
                      title="Lancer l'itinéraire GPS"
                    >
                      <Navigation className="size-2.5" />
                      <span>🧭 GPS</span>
                    </Button>
                  )}

                  <Button asChild variant="outline" size="sm" className="text-3xs h-7 px-3 gap-1.5">
                    <Link to={ROUTES.mission(mission.id)}>
                      <Eye className="size-3 text-primary" />
                      <span>Voir la fiche</span>
                    </Link>
                  </Button>

                  {mission.customer_phone && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="text-3xs h-7 px-2.5 text-muted-foreground hover:text-foreground ml-auto"
                    >
                      <a href={`tel:${mission.customer_phone}`}>
                        <Phone className="size-3 text-emerald-500 mr-1" />
                        Appeler
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
