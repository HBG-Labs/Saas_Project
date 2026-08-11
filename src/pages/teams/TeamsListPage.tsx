import { Plus, Users } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { TeamFormDialog, useTeams } from '@/features/teams';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function TeamsListPage() {
  useDocumentTitle('Équipes');

  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;

  const teams = useTeams(organizationId);
  const canCreate = can(PERMISSIONS.teamCreate);
  const list = teams.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipes"
        description="Les groupes de terrain auxquels vous affectez vos missions."
        actions={
          canCreate && organizationId !== null ? (
            <TeamFormDialog
              organizationId={organizationId}
              trigger={
                <Button variant="primary" size="sm">
                  <Plus className="size-4" />
                  Nouvelle équipe
                </Button>
              }
            />
          ) : null
        }
      />

      {teams.isPending ? (
        <ListSkeleton />
      ) : teams.isError ? (
        <ErrorState
          error={teams.error}
          onRetry={() => {
            void teams.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucune équipe"
          description={
            canCreate
              ? 'Créez une équipe pour regrouper vos techniciens par domaine ou par secteur, et lui affecter des missions.'
              : 'Aucune équipe n’a encore été créée dans cette entreprise.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((team) => (
            <Card
              key={team.id}
              className="group transition-all duration-150 hover:border-primary/50 hover:shadow-md"
            >
              <CardContent className="p-5">
                <Link to={ROUTES.team(team.id)} className="block space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-background"
                        style={{
                          backgroundColor: team.color ?? 'var(--color-border-strong)',
                          boxShadow: `0 0 10px ${team.color ?? '#3b82f6'}60`,
                        }}
                      />
                      <span className="text-foreground truncate text-sm font-semibold group-hover:text-primary transition-colors">
                        {team.name}
                      </span>
                    </div>
                    {team.status === 'archived' ? (
                      <Badge variant="warning" className="shrink-0">
                        Archivée
                      </Badge>
                    ) : null}
                  </div>

                  {team.description !== null && team.description !== '' ? (
                    <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                      {team.description}
                    </p>
                  ) : (
                    <p className="text-subtle-foreground text-xs italic">Aucune description</p>
                  )}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
