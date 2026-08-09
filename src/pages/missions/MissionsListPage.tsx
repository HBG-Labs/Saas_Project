import { ClipboardList, MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  countActiveFilters,
  EMPTY_MISSION_FILTERS,
  MissionFiltersBar,
  MissionPriorityBadge,
  MissionStatusBadge,
  toMissionQuery,
  useMissions,
} from '@/features/missions';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function MissionsListPage() {
  useDocumentTitle('Missions');

  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;

  const [filters, setFilters] = useState(EMPTY_MISSION_FILTERS);
  const missions = useMissions(organizationId, toMissionQuery(filters));

  const canCreate = can(PERMISSIONS.missionCreate);
  const canViewAll = can(PERMISSIONS.missionViewAll);
  const activeFilters = countActiveFilters(filters);
  const list = missions.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Missions"
        description={
          canViewAll
            ? 'Les interventions de l’entreprise, de leur création à leur clôture.'
            : 'Les interventions qui vous sont confiées.'
        }
        actions={
          canCreate ? (
            <Button asChild variant="primary" size="sm">
              <Link to={ROUTES.missionNew}>
                <Plus className="size-4" />
                Nouvelle mission
              </Link>
            </Button>
          ) : null
        }
      />

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
        <EmptyState
          icon={ClipboardList}
          title={activeFilters === 0 ? 'Aucune mission en cours' : 'Aucun résultat'}
          action={
            activeFilters > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilters(EMPTY_MISSION_FILTERS);
                }}
              >
                Réinitialiser les filtres
              </Button>
            ) : null
          }
          description={
            activeFilters > 0
              ? 'Aucune mission ne correspond à ces critères.'
              : canCreate
                ? 'Créez une mission pour l’affecter à une équipe et suivre son avancement jusqu’à la clôture.'
                : /*
                     Un technicien ne voit que ses missions : une liste vide veut
                     dire qu'il n'a rien à faire, pas qu'il manque un droit.
                   */
                  'Aucune intervention ne vous est confiée pour le moment.'
          }
        />
      ) : (
        /*
          Empilée plutôt qu'en une seule ligne.

          Une ligne unique tenait sur un écran large et se repliait n'importe
          comment sur un téléphone : la référence, le statut et la date
          finissaient dispersées sur trois rangs, dans un ordre dicté par la
          largeur des mots. Empiler impose l'ordre — ce que c'est, puis pour
          qui, puis quand — et se lit pareil partout.
        */
        <ul className="divide-border divide-y">
          {list.map((mission) => (
            <li key={mission.id}>
              <Link
                to={ROUTES.mission(mission.id)}
                className="hover:bg-surface-hover -mx-2 block rounded-md px-2 py-3 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{mission.reference}</Badge>
                  <MissionPriorityBadge priority={mission.priority} />
                  <MissionStatusBadge status={mission.status} />

                  <span className="text-subtle-foreground ml-auto shrink-0 font-mono text-xs tabular-nums">
                    {mission.scheduled_start !== null
                      ? new Date(mission.scheduled_start).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>

                <p className="text-foreground mt-1.5 truncate text-sm font-medium">
                  {mission.title}
                </p>

                <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {mission.customer !== null ? <span>{mission.customer.name}</span> : null}

                  {mission.site !== null ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3 shrink-0" aria-hidden="true" />
                      {mission.site.name}
                    </span>
                  ) : null}

                  {mission.assigned_team !== null ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            mission.assigned_team.color ?? 'var(--color-border-strong)',
                        }}
                      />
                      {mission.assigned_team.name}
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
