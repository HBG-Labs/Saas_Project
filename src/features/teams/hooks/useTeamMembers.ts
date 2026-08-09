import { useMutation, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { TeamMemberRole } from '@/types/database';
import type { TeamWithMembers } from '@/types/domain';

import { addTeamMember, removeTeamMember, updateTeamMemberRole } from '../api/teams.api';

/**
 * Mutations sur la composition d'une équipe.
 *
 * Toutes invalident `qk.teams.detail(teamId)` ET `qk.teams.all` : la liste
 * affiche l'effectif et le responsable, qui changent avec la composition. Ne
 * rafraîchir que la fiche laisserait la liste annoncer « 3 membres » sur une
 * équipe qui vient d'en perdre un — sans qu'aucune erreur ne le signale.
 */
function useTeamMemberMutation<TVariables, TData>(
  teamId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.teams.detail(teamId) }),
        queryClient.invalidateQueries({ queryKey: qk.teams.all }),
      ]);
    },
  });
}

export function useAddTeamMember(teamId: string) {
  return useTeamMemberMutation(teamId, (input: { memberId: string; role?: TeamMemberRole }) =>
    addTeamMember({
      teamId,
      memberId: input.memberId,
      ...(input.role !== undefined ? { role: input.role } : {}),
    }),
  );
}

export function useRemoveTeamMember(teamId: string) {
  return useTeamMemberMutation(teamId, (teamMemberId: string) => removeTeamMember(teamMemberId));
}

/**
 * Change le rôle d'un membre DANS L'ÉQUIPE — `lead` ou `member`.
 *
 * À ne pas confondre avec `useUpdateMemberRole` du module Organisations, qui
 * touche au rôle dans l'ENTREPRISE. Promouvoir quelqu'un `lead` ne lui accorde
 * aucune permission RBAC : cela élargit son périmètre via
 * `app.my_led_team_ids()`, rien de plus. Un technicien `lead` pilote son équipe
 * sans gagner le droit de contrôler un compte rendu.
 */
export function useSetTeamMemberRole(teamId: string) {
  return useTeamMemberMutation(
    teamId,
    (input: { teamMemberId: string; role: TeamMemberRole }) =>
      updateTeamMemberRole(input.teamMemberId, input.role),
  );
}

/**
 * Membres de l'organisation qui ne sont PAS encore dans l'équipe.
 *
 * Calculé côté client à partir de deux listes déjà chargées : proposer
 * quelqu'un qui y figure déjà produirait une violation de l'index unique
 * `(team_id, member_id)`, c'est-à-dire une erreur technique là où l'absence de
 * l'option suffit à l'éviter.
 */
export function selectableMembers<T extends { id: string; status: string }>(
  organizationMembers: readonly T[],
  team: TeamWithMembers | null,
): readonly T[] {
  const alreadyIn = new Set((team?.members ?? []).map((entry) => entry.member_id));

  return organizationMembers.filter(
    (member) => member.status === 'active' && !alreadyIn.has(member.id),
  );
}
