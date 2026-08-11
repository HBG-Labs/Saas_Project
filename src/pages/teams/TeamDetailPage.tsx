import { Archive, ArrowLeft, Pencil, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  PERMISSIONS,
  useCurrentOrganization,
  useMembers,
  usePermission,
} from '@/features/organizations';
import {
  TeamFormDialog,
  TeamMembersPanel,
  useArchiveTeam,
  useDeleteTeam,
  useTeam,
} from '@/features/teams';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { organization, membership } = useCurrentOrganization();
  const { can } = usePermission();

  const team = useTeam(teamId);
  const members = useMembers(organization?.id ?? null);
  const archiveTeam = useArchiveTeam();
  const deleteTeam = useDeleteTeam();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  const myMemberId = membership?.id ?? null;

  const isTeamLead = data.members.some(
    (entry) => entry.role === 'lead' && entry.member_id === myMemberId,
  );
  const isTeamManager = data.manager_id !== null && data.manager_id === myMemberId;
  const leadsThisTeam = myMemberId !== null && (isTeamLead || isTeamManager);

  const canEdit = can(PERMISSIONS.teamUpdate) || leadsThisTeam;
  const canAssign = can(PERMISSIONS.teamAssignMember) || leadsThisTeam;
  const canArchive = can(PERMISSIONS.teamDelete);
  const canDelete = can(PERMISSIONS.teamDelete);

  const handleDelete = async () => {
    if (!teamId) return;
    await deleteTeam.mutateAsync(teamId);
    setIsDeleteModalOpen(false);
    void navigate(ROUTES.teams);
  };

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
                variant="outline"
                size="sm"
                onClick={() => {
                  archiveTeam.mutate(data.id);
                }}
                disabled={archiveTeam.isPending}
              >
                <Archive className="size-4" />
                Archiver
              </Button>
            ) : null}

            {canDelete ? (
              <>
                <div className="h-4 w-px bg-border mx-1" aria-hidden="true" />
                <Button
                  variant="danger-outline"
                  size="sm"
                  onClick={() => {
                    setIsDeleteModalOpen(true);
                  }}
                  disabled={deleteTeam.isPending}
                >
                  <Trash2 className="size-4" />
                  Supprimer
                </Button>

                <Modal
                  open={isDeleteModalOpen}
                  onOpenChange={setIsDeleteModalOpen}
                  title="Supprimer l'équipe"
                  description={`Êtes-vous sûr de vouloir supprimer définitivement l'équipe "${data.name}" ?`}
                  footer={
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsDeleteModalOpen(false);
                        }}
                        disabled={deleteTeam.isPending}
                      >
                        Annuler
                      </Button>
                      <Button
                        variant="danger-outline"
                        size="sm"
                        onClick={() => {
                          void handleDelete();
                        }}
                        disabled={deleteTeam.isPending}
                      >
                        {deleteTeam.isPending ? 'Suppression…' : 'Supprimer l’équipe'}
                      </Button>
                    </div>
                  }
                >
                  <p className="text-muted-foreground text-sm">
                    Cette action est définitive. L'équipe sera retirée de l'organisation et ne sera plus proposée lors de l'affectation des missions.
                  </p>
                </Modal>
              </>
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
