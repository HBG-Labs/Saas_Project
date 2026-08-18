import { Mail, Send, Users, X } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { FormError } from '@/components/feedback/FormError';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth';
import { useOrganizationEntitlements, useSeatBilling } from '@/features/billing';
import {
  AddMemberDialog,
  InvitationLink,
  InviteMemberDialog,
  MemberQuotaBar,
  MemberRow,
  PERMISSIONS,
  RoleBadge,
  sortMembersByRole,
  useCurrentOrganization,
  useInvitations,
  useMembers,
  usePermission,
  useRemoveMember,
  useResendInvitationEmail,
  useRevokeInvitation,
  useUpdateMemberDetails,
  useUpdateMemberRole,
} from '@/features/organizations';
import { useTeamMembershipsByMember } from '@/features/teams';
import { useLabel } from '@/features/industries';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function MembersPage() {
  const workerLabelPlural = useLabel('worker', true);
  useDocumentTitle(`Équipe & ${workerLabelPlural}`);

  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const { can, role } = usePermission();
  const organizationId = organization?.id ?? null;

  const members = useMembers(organizationId);
  const invitations = useInvitations(organizationId);

  /*
    Le rôle dit ce qu'une personne a le droit de faire ; l'équipe dit avec qui
    elle le fait — et c'est par elle que les missions lui parviennent. Un
    « technicien » sans équipe ne recevra jamais rien, ce que cette page ne
    laissait pas voir.

    Conditionné à `team.view` : sans ce droit, la requête ne remonterait rien de
    toute façon, autant ne pas la lancer.
  */
  const teamMemberships = useTeamMembershipsByMember(
    can(PERMISSIONS.teamView) ? organizationId : null,
  );
  const { planCode } = useOrganizationEntitlements(organizationId);

  const updateRole = useUpdateMemberRole(organizationId ?? '');
  const updateDetails = useUpdateMemberDetails(organizationId ?? '');
  const removeMember = useRemoveMember(organizationId ?? '');
  const revokeInvitation = useRevokeInvitation(organizationId ?? '');
  const resendInvitation = useResendInvitationEmail();

  const canUpdateRole = can(PERMISSIONS.memberUpdateRole);
  const canRemove = can(PERMISSIONS.memberRemove);
  const canInvite = can(PERMISSIONS.memberInvite);
  const viewerIsOwner = role === 'owner';

  const activeMembers = sortMembersByRole(
    (members.data ?? []).filter((member) => member.status !== 'removed'),
  );

  /**
   * Un seul propriétaire actif signifie que sa ligne est verrouillée : le
   * trigger `protect_last_owner` refuserait de le retirer ou de le rétrograder.
   * Le compte se fait sur les membres ACTIFS — une invitation en attente au rôle
   * de propriétaire ne protège personne tant qu'elle n'est pas acceptée.
   */
  const activeOwnerCount = activeMembers.filter(
    (member) => member.role === 'owner' && member.status === 'active',
  ).length;

  // La règle vient du SERVEUR, via la fonction qui calcule le montant. La
  // version précédente comptait les lignes non retirées — invitations
  // comprises — contre une limite lue dans le paquet JavaScript, et annonçait
  // donc un supplément pour des comptes qui n'étaient pas encore facturables.
  const { quotaBlocked, isExtraSeat, activeSeats, includedSeats, isBilled } =
    useSeatBilling(organizationId);

  const busy = updateRole.isPending || updateDetails.isPending || removeMember.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Équipe & ${workerLabelPlural}`}
        description={`Gestion des ${workerLabelPlural.toLowerCase()}, des rôles et des accès aux interventions de l’entreprise.`}
        actions={
          canInvite && organizationId !== null ? (
            <div className="flex items-center gap-2">
              <AddMemberDialog
                organizationId={organizationId}
                viewerIsOwner={viewerIsOwner}
                quotaReached={quotaBlocked}
                isExtraSeat={isExtraSeat}
                onMemberAdded={() => {
                  void members.refetch();
                }}
              />
              <InviteMemberDialog
                organizationId={organizationId}
                viewerIsOwner={viewerIsOwner}
                quotaReached={quotaBlocked}
                isExtraSeat={isExtraSeat}
              />
            </div>
          ) : null
        }
      />

      {includedSeats !== null ? (
        <Card>
          <CardContent className="pt-6">
            {/* Les mêmes chiffres que la facture : les comptes FACTURABLES, et
                les sièges que la formule comprend. La barre montrait auparavant
                les lignes non retirées contre une limite lue côté client. */}
            <MemberQuotaBar
              current={activeSeats}
              max={includedSeats}
              planCode={planCode}
              isBilled={isBilled}
            />
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
                  teams={teamMemberships.data?.get(member.id) ?? []}
                  isLastOwner={member.role === 'owner' && activeOwnerCount <= 1}
                  canUpdateRole={canUpdateRole}
                  canRemove={canRemove}
                  viewerIsOwner={viewerIsOwner}
                  busy={busy}
                  onRoleChange={(nextRole) => {
                    updateRole.mutate({ memberId: member.id, role: nextRole });
                  }}
                  onUpdateDetails={(displayName, jobTitle) => {
                    updateDetails.mutate({ memberId: member.id, displayName, jobTitle });
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
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          resendInvitation.mutate(invitation.id);
                        }}
                        disabled={resendInvitation.isPending}
                        className="gap-1.5 text-2xs"
                        aria-label={`Renvoyer le courriel à ${invitation.email}`}
                      >
                        <Send className="size-3" />
                        {resendInvitation.isPending &&
                        resendInvitation.variables === invitation.id
                          ? 'Envoi…'
                          : 'Renvoyer'}
                      </Button>
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

                    {resendInvitation.isError &&
                      resendInvitation.variables === invitation.id && (
                        <FormError error={resendInvitation.error} />
                      )}

                    {resendInvitation.isSuccess &&
                      resendInvitation.variables === invitation.id && (
                        <p className="text-2xs font-medium text-emerald-600 dark:text-emerald-400">
                          Courriel renvoyé à {invitation.email}.
                        </p>
                      )}

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
