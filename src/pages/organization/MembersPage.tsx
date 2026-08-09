import { Mail, Users, X } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth';
import { FEATURES, useOrganizationEntitlements } from '@/features/billing';
import {
  InvitationLink,
  InviteMemberDialog,
  MemberQuotaBar,
  MemberRow,
  PERMISSIONS,
  RoleBadge,
  useCurrentOrganization,
  useInvitations,
  useMembers,
  usePermission,
  useRemoveMember,
  useRevokeInvitation,
  useUpdateMemberRole,
} from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function MembersPage() {
  useDocumentTitle('Membres');

  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const { can, role } = usePermission();
  const organizationId = organization?.id ?? null;

  const members = useMembers(organizationId);
  const invitations = useInvitations(organizationId);
  const { limit } = useOrganizationEntitlements(organizationId);

  const updateRole = useUpdateMemberRole(organizationId ?? '');
  const removeMember = useRemoveMember(organizationId ?? '');
  const revokeInvitation = useRevokeInvitation(organizationId ?? '');

  const canUpdateRole = can(PERMISSIONS.memberUpdateRole);
  const canRemove = can(PERMISSIONS.memberRemove);
  const canInvite = can(PERMISSIONS.memberInvite);
  const viewerIsOwner = role === 'owner';

  const activeMembers = (members.data ?? []).filter((member) => member.status !== 'removed');

  /**
   * Un seul propriétaire actif signifie que sa ligne est verrouillée : le
   * trigger `protect_last_owner` refuserait de le retirer ou de le rétrograder.
   * Le compte se fait sur les membres ACTIFS — une invitation en attente au rôle
   * de propriétaire ne protège personne tant qu'elle n'est pas acceptée.
   */
  const activeOwnerCount = activeMembers.filter(
    (member) => member.role === 'owner' && member.status === 'active',
  ).length;

  const memberLimit = limit(FEATURES.members);
  const quotaReached = memberLimit !== null && activeMembers.length >= memberLimit;

  const busy = updateRole.isPending || removeMember.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membres"
        description="Qui appartient à l’entreprise, et avec quels droits."
        actions={
          canInvite && organizationId !== null ? (
            <InviteMemberDialog
              organizationId={organizationId}
              viewerIsOwner={viewerIsOwner}
              quotaReached={quotaReached}
            />
          ) : null
        }
      />

      {memberLimit !== null ? (
        <Card>
          <CardContent className="pt-6">
            <MemberQuotaBar current={activeMembers.length} max={memberLimit} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Équipe</CardTitle>
        </CardHeader>
        <CardContent>
          {members.isPending ? (
            <ListSkeleton />
          ) : members.isError ? (
            <ErrorState
              error={members.error}
              onRetry={() => {
                void members.refetch();
              }}
            />
          ) : activeMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun membre"
              description="Invitez vos collègues pour leur confier des missions et suivre leurs interventions."
            />
          ) : (
            <ul>
              {activeMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isSelf={member.user_id === user?.id}
                  isLastOwner={member.role === 'owner' && activeOwnerCount <= 1}
                  canUpdateRole={canUpdateRole}
                  canRemove={canRemove}
                  viewerIsOwner={viewerIsOwner}
                  busy={busy}
                  onRoleChange={(nextRole) => {
                    updateRole.mutate({ memberId: member.id, role: nextRole });
                  }}
                  onRemove={() => {
                    removeMember.mutate(member.id);
                  }}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle>Invitations en attente</CardTitle>
          </CardHeader>
          <CardContent>
            {invitations.isPending ? (
              <ListSkeleton />
            ) : invitations.isError ? (
              <ErrorState
                error={invitations.error}
                onRetry={() => {
                  void invitations.refetch();
                }}
              />
            ) : (invitations.data ?? []).length === 0 ? (
              <EmptyState
                icon={Mail}
                size="sm"
                title="Aucune invitation en attente"
                description="Les invitations créées apparaissent ici jusqu’à leur acceptation ou leur expiration."
              />
            ) : (
              <ul className="space-y-4">
                {(invitations.data ?? []).map((invitation) => (
                  <li key={invitation.id} className="border-border space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground flex-1 truncate text-sm font-medium">
                        {invitation.email}
                      </span>
                      <RoleBadge role={invitation.role} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          revokeInvitation.mutate(invitation.id);
                        }}
                        disabled={revokeInvitation.isPending}
                        className="text-muted-foreground hover:text-error"
                        aria-label={`Révoquer l’invitation de ${invitation.email}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>

                    <InvitationLink token={invitation.token} />

                    <p className="text-subtle-foreground text-2xs">
                      Expire le{' '}
                      {new Date(invitation.expires_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
