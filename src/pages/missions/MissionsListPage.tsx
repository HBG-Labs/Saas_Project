import { ClipboardList, MapPin, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  MISSION_STATUS_LABELS,
  MissionPriorityBadge,
  MissionStatusBadge,
  useMissions,
} from '@/features/missions';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { MissionStatus } from '@/types/database';

/**
 * Les états terminaux sont exclus par défaut.
 *
 * Une liste de missions sert à savoir quoi faire ensuite. Y laisser les dossiers
 * clos la fait grossir indéfiniment sans jamais rien apporter : au bout d'un an,
 * l'utile se noie dans l'archive. Le filtre reste accessible pour aller les
 * chercher.
 */
const ACTIVE_STATUSES: readonly MissionStatus[] = [
  'draft',
  'assigned',
  'accepted',
  'in_progress',
  'completed',
  'submitted',
  'rejected',
  'approved',
];

export default function MissionsListPage() {
  useDocumentTitle('Missions');

  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const missions = useMissions(organizationId, {
    ...(search.trim() !== '' ? { search } : {}),
    status: status === '' ? ACTIVE_STATUSES : [status as MissionStatus],
  });

  const canCreate = can(PERMISSIONS.missionCreate);
  const canViewAll = can(PERMISSIONS.missionViewAll);
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

      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <Input
          label="Rechercher"
          hideLabel
          placeholder="Intitulé, référence ou client…"
          leadingIcon={<Search className="size-4" aria-hidden="true" />}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />

        <Select
          options={[
            { value: '', label: 'En cours (par défaut)' },
            ...Object.entries(MISSION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          value={status}
          onValueChange={setStatus}
          label="Statut"
          hideLabel
        />
      </div>

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
          title={search.trim() === '' && status === '' ? 'Aucune mission en cours' : 'Aucun résultat'}
          description={
            search.trim() !== '' || status !== ''
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
        <ul className="divide-border divide-y">
          {list.map((mission) => (
            <li key={mission.id}>
              <Link
                to={ROUTES.mission(mission.id)}
                className="hover:bg-surface-hover -mx-2 flex flex-wrap items-center gap-3 rounded-md px-2 py-3 transition-colors"
              >
                <Badge variant="outline">{mission.reference}</Badge>

                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">{mission.title}</p>
                  <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    {mission.customer !== null ? <span>{mission.customer.name}</span> : null}
                    {mission.site !== null ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden="true" />
                        {mission.site.name}
                      </span>
                    ) : null}
                  </p>
                </div>

                {mission.assigned_team !== null ? (
                  <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor:
                          mission.assigned_team.color ?? 'var(--color-border-strong)',
                      }}
                    />
                    {mission.assigned_team.name}
                  </span>
                ) : null}

                <span className="text-subtle-foreground font-mono text-xs tabular-nums">
                  {mission.scheduled_start !== null
                    ? new Date(mission.scheduled_start).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                      })
                    : '—'}
                </span>

                <MissionPriorityBadge priority={mission.priority} />
                <MissionStatusBadge status={mission.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
