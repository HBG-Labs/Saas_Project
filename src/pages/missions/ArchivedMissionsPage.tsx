import { Archive, Download, MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { exportMissionsToCsv, MissionStatusBadge, useMissions } from '@/features/missions';
import { useCurrentOrganization } from '@/features/organizations';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { MissionStatus } from '@/types/database';

/**
 * Répertoire des dossiers terminés.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN ÉCRAN À PART
 *
 * La liste des missions exclut les états terminaux par construction : elle sert
 * à savoir quoi faire ENSUITE, et y laisser les dossiers clos la ferait grossir
 * indéfiniment jusqu'à noyer l'utile.
 *
 * Ces dossiers ne disparaissent pas pour autant. On les rouvre pour facturer,
 * pour répondre à une réclamation, pour retrouver ce qui a été fait chez un
 * client l'an dernier. Ils appelaient donc leur propre entrée, plutôt qu'un
 * filtre à connaître dans un menu déroulant.
 *
 * CLOS N'EST PAS ANNULÉ
 *
 * `closed` désigne un dossier mené à terme et facturable ; `cancelled`, un
 * travail interrompu. Les mélanger dans un même total fausserait toute lecture
 * de l'activité — d'où la séparation par onglets, et non une liste unique.
 * ─────────────────────────────────────────────────────────────────────────────
 */

type Scope = Extract<MissionStatus, 'closed' | 'cancelled'>;

const SCOPES: { value: Scope; label: string; empty: string }[] = [
  {
    value: 'closed',
    label: 'Clôturés',
    empty:
      'Aucun dossier clôturé. Une mission y arrive après validation de son compte rendu, puis clôture — l’étape qui la rend facturable.',
  },
  {
    value: 'cancelled',
    label: 'Annulés',
    empty: 'Aucune mission annulée. Celles qui sont interrompues avant terme apparaissent ici.',
  },
];

export default function ArchivedMissionsPage() {
  useDocumentTitle('Dossiers clôturés');

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const [scope, setScope] = useState<Scope>('closed');
  const [search, setSearch] = useState('');

  const missions = useMissions(organizationId, {
    status: [scope],
    ...(search.trim() !== '' ? { search: search.trim() } : {}),
    limit: 200,
  });

  const list = missions.data ?? [];
  const active = SCOPES.find((item) => item.value === scope);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dossiers clôturés"
        description="Les missions menées à terme, conservées pour la facturation et l’historique client."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                exportMissionsToCsv(
                  list,
                  `missions-${scope}-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              className="text-xs"
              disabled={list.length === 0}
              title="Exporter les dossiers en fichier CSV"
            >
              <Download className="size-3.5 mr-1" />
              Exporter CSV
            </Button>

            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link to={ROUTES.missions}>← Missions actives</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="bg-surface-sunken flex gap-1 rounded-lg p-1">
          {SCOPES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setScope(item.value)}
              className={cn(
                'min-h-touch cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1.5',
                scope === item.value
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            label="Rechercher un dossier"
            hideLabel
            placeholder="Intitulé, référence ou client…"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
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
          icon={Archive}
          title={search.trim() === '' ? 'Aucun dossier' : 'Aucun résultat'}
          description={
            search.trim() === ''
              ? (active?.empty ?? '')
              : 'Aucun dossier ne correspond à cette recherche. Elle porte sur l’intitulé, la référence et le nom du client.'
          }
        />
      ) : (
        <>
          <p className="text-muted-foreground text-xs">
            {list.length} dossier{list.length > 1 ? 's' : ''} {active?.label.toLowerCase()}
          </p>

          <ul className="space-y-2">
            {list.map((mission) => {
              // `actual_end` est la fin réelle des travaux, posée au passage en
              // `completed`. Une mission annulée n'en a pas — on retombe alors
              // sur la dernière modification, qui EST l'annulation puisque plus
              // rien ne bouge après un état terminal.
              const endedAt = mission.actual_end ?? mission.updated_at;

              return (
                <li key={mission.id}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5">
                      <Badge variant="outline" className="font-mono text-2xs">
                        {mission.reference}
                      </Badge>

                      <Link
                        to={ROUTES.mission(mission.id)}
                        className="text-foreground hover:text-primary min-w-0 flex-1 truncate text-sm font-medium"
                      >
                        {mission.title}
                      </Link>

                      <MissionStatusBadge status={mission.status} />

                      <div className="text-muted-foreground flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:w-auto">
                        {mission.customer !== null || mission.customer_name !== null ? (
                          <span className="truncate">
                            {mission.customer?.name ?? mission.customer_name}
                          </span>
                        ) : null}

                        {mission.city !== null && mission.city !== '' ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" aria-hidden="true" />
                            {mission.city}
                          </span>
                        ) : null}

                        <span className="font-mono tabular-nums">
                          {endedAt !== null
                            ? new Date(endedAt).toLocaleDateString('fr-FR')
                            : '—'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
