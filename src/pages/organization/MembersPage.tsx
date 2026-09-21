import { Send, X } from 'lucide-react';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
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
import { useTeamMembershipsByMember, TeamsNavTabs } from '@/features/teams';
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
        className="sm:flex-col xl:flex-row"
        title={`Équipe & ${workerLabelPlural}`}
        description={`Gestion des ${workerLabelPlural.toLowerCase()}, des rôles et des accès aux interventions de l’entreprise.`}
        actions={
          canInvite && organizationId !== null ? (
            <div className="grid w-full grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:w-auto">
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

      <TeamsNavTabs memberCount={activeMembers.length} />

      {includedSeats !== null ? (
        <Card className="border-primary/20 bg-primary-subtle overflow-hidden">
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

      <Card className="overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 flex-row items-center justify-between gap-3 border-b">
          <div>
            <CardTitle>Équipe</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              {activeMembers.length} membre{activeMembers.length > 1 ? 's' : ''} actif
              {activeMembers.length > 1 ? 's' : ''}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
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
              illustration={<AtelierIllustration subject="teams" className="w-48" />}
              title="Aucun membre"
              description="Invitez vos collègues pour leur confier des missions et suivre leurs interventions."
            />
          ) : (
            <ul className="divide-border divide-y">
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
        <Card className="overflow-hidden">
          <CardHeader className="border-border bg-surface-sunken/35 flex-row items-center justify-between gap-3 border-b">
            <div>
              <CardTitle>Invitations en attente</CardTitle>
              <p className="text-muted-foreground mt-1 text-xs">Accès non encore activés</p>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
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
                illustration={<AtelierIllustration subject="invitations" className="w-44" />}
                size="sm"
                title="Aucune invitation en attente"
                description="Les invitations créées apparaissent ici jusqu’à leur acceptation ou leur expiration."
              />
            ) : (
              <ul className="space-y-3">
                {(invitations.data ?? []).map((invitation) => (
                  <li
                    key={invitation.id}
                    className="hover:bg-surface-hover focus-within:bg-surface-hover space-y-3 px-1 py-4 transition-colors sm:px-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm font-medium">
                          {invitation.email}
                        </p>
                        <p className="text-subtle-foreground mt-1 text-xs">
                          Expire le{' '}
                          {new Date(invitation.expires_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <RoleBadge role={invitation.role} />
                    </div>

                    <InvitationLink token={invitation.token} />

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          resendInvitation.mutate(invitation.id);
                        }}
                        disabled={resendInvitation.isPending}
                        isLoading={
                          resendInvitation.isPending && resendInvitation.variables === invitation.id
                        }
                        loadingLabel={`Renvoi du courriel à ${invitation.email}`}
                        className="w-full gap-1.5 text-xs sm:w-auto"
                        aria-label={`Renvoyer le courriel à ${invitation.email}`}
                        leadingIcon={<Send className="size-3.5" aria-hidden />}
                      >
                        {resendInvitation.isPending && resendInvitation.variables === invitation.id
                          ? 'Envoi…'
                          : 'Renvoyer'}
                      </Button>
                      <Button
                        variant="danger-outline"
                        size="sm"
                        onClick={() => {
                          revokeInvitation.mutate(invitation.id);
                        }}
                        disabled={revokeInvitation.isPending}
                        isLoading={
                          revokeInvitation.isPending && revokeInvitation.variables === invitation.id
                        }
                        loadingLabel={`Révocation de l’invitation de ${invitation.email}`}
                        className="w-full sm:w-auto"
                        aria-label={`Révoquer l’invitation de ${invitation.email}`}
                        leadingIcon={<X className="size-3.5" aria-hidden />}
                      >
                        Révoquer
                      </Button>
                    </div>

                    {resendInvitation.isError && resendInvitation.variables === invitation.id && (
                      <FormError error={resendInvitation.error} />
                    )}

                    {resendInvitation.isSuccess && resendInvitation.variables === invitation.id && (
                      <p className="text-2xs text-success font-medium">
                        Courriel renvoyé à {invitation.email}.
                      </p>
                    )}
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
