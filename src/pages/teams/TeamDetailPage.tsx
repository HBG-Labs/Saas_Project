import { Archive, ArrowLeft, Pencil, Users } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  PERMISSIONS,
  useCurrentOrganization,
  useMembers,
  usePermission,
} from '@/features/organizations';
import { TeamFormDialog, TeamMembersPanel, useArchiveTeam, useTeam } from '@/features/teams';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { organization, membership } = useCurrentOrganization();
  const { can } = usePermission();

  const team = useTeam(teamId);
  const members = useMembers(organization?.id ?? null);
  const archiveTeam = useArchiveTeam();

  useDocumentTitle(team.data?.name ?? 'Équipe');

  if (team.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (team.isError) {
    return (
      <ErrorState
        error={team.error}
        onRetry={() => {
          void team.refetch();
        }}
      />
    );
  }

  if (team.data === null || teamId === undefined) {
    return (
      <EmptyState
        icon={Users}
        title="Équipe introuvable"
        description="Cette équipe n’existe pas, ou ne fait pas partie de votre entreprise."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.teams}>Retour aux équipes</Link>
          </Button>
        }
      />
    );
  }

  const data = team.data;
  const organizationId = organization?.id ?? null;

  /**
   * Deux origines au droit de gérer cette équipe, et il faut les additionner.
   *
   * La permission d'entreprise (`team.update` / `team.assign_member`) vaut pour
   * TOUTES les équipes. Être responsable de CELLE-CI n'en donne aucune, mais
   * élargit le périmètre côté serveur via `app.my_led_team_ids()`. Un technicien
   * responsable d'équipe passe donc par la seconde voie — ne considérer que la
   * première lui masquerait des actions que le serveur lui accorde.
   */
  // `membership` vient du contexte : c'est l'appartenance de l'UTILISATEUR
  // COURANT à l'organisation courante, et son `id` est bien le `member_id`
  // auquel `team_members` et `teams.manager_id` font référence.
  const myMemberId = membership?.id ?? null;

  const isTeamLead = data.members.some(
    (entry) => entry.role === 'lead' && entry.member_id === myMemberId,
  );
  const isTeamManager = data.manager_id !== null && data.manager_id === myMemberId;
  const leadsThisTeam = myMemberId !== null && (isTeamLead || isTeamManager);

  const canEdit = can(PERMISSIONS.teamUpdate) || leadsThisTeam;
  const canAssign = can(PERMISSIONS.teamAssignMember) || leadsThisTeam;
  const canArchive = can(PERMISSIONS.teamDelete);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={ROUTES.teams}>
          <ArrowLeft className="size-4" />
          Équipes
        </Link>
      </Button>

      <PageHeader
        title={data.name}
        description={data.description ?? 'Aucune description'}
        actions={
          <div className="flex items-center gap-2">
            {data.status === 'archived' ? <Badge variant="warning">Archivée</Badge> : null}

            {canEdit && organizationId !== null ? (
              <TeamFormDialog
                organizationId={organizationId}
                team={data}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="size-4" />
                    Modifier
                  </Button>
                }
              />
            ) : null}

            {canArchive && data.status !== 'archived' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  archiveTeam.mutate(data.id);
                }}
                disabled={archiveTeam.isPending}
                className="text-muted-foreground hover:text-foreground"
              >
                <Archive className="size-4" />
                Archiver
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            Membres
            <span className="text-muted-foreground ml-2 font-mono text-xs tabular-nums">
              {data.members.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TeamMembersPanel
            team={data}
            organizationMembers={members.data ?? []}
            canAssign={canAssign}
          />
        </CardContent>
      </Card>
    </div>
  );
}
