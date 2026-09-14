import { Plus, Users, UsersRound } from 'lucide-react';
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
import { TeamFormDialog, TeamsNavTabs, useTeams } from '@/features/teams';
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

      <TeamsNavTabs />

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
            <Link
              key={team.id}
              to={ROUTES.team(team.id)}
              className="group focus-visible:ring-primary block min-w-0 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <Card className="border-border/80 group-hover:border-primary/30 group-hover:shadow-raised h-full cursor-pointer shadow-xs transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="bg-primary-subtle text-primary relative flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100">
                        <UsersRound className="size-4.5" aria-hidden="true" />
                        <span
                          aria-hidden="true"
                          className="border-surface absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2"
                          style={{
                            backgroundColor: team.color ?? 'var(--color-border-strong)',
                          }}
                        />
                      </span>
                      <span className="text-foreground group-hover:text-primary truncate text-sm font-bold transition-colors">
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
                    <p className="text-muted-foreground border-border/60 line-clamp-2 min-h-12 border-t pt-3 text-sm leading-relaxed">
                      {team.description}
                    </p>
                  ) : (
                    <p className="text-subtle-foreground border-border/60 min-h-12 border-t pt-3 text-sm italic">
                      Aucune description
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
