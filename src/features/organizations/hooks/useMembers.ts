import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { OrgRole } from '@/types/database';
import type { MemberWithProfile } from '@/types/domain';

import { listMembers, removeMember, updateMemberRole } from '../api/organizations.api';

export function useMembers(organizationId: string | null) {
  return useQuery({
    queryKey: qk.organizations.members(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listMembers(organizationId)),
    enabled: organizationId !== null,
  });
}

export function useUpdateMemberRole(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrgRole }) =>
      updateMemberRole(memberId, role),
    onSuccess: async () => {
      // Seule la liste est invalidée : `prevent_privilege_escalation` interdit
      // de modifier son propre rôle, l'appartenance de l'utilisateur courant ne
      // peut donc pas changer par cette action. Invalider tout le domaine
      // relancerait inutilement la résolution de l'organisation courante.
      await queryClient.invalidateQueries({
        queryKey: qk.organizations.members(organizationId),
      });
    },
  });
}

/**
 * Retire un membre — statut `removed`, sans suppression de ligne.
 *
 * Les missions et comptes rendus le référencent : effacer la ligne ferait
 * disparaître le nom de l'intervenant des historiques. `current_org_role` ne
 * retenant que les appartenances actives, l'accès est coupé sans altérer le
 * passé.
 */
export function useRemoveMember(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.organizations.members(organizationId),
      });
    },
  });
}

/**
 * Nom à afficher pour un membre.
 *
 * `profile` est nullable PAR CONCEPTION : la RLS de `profiles` restreint la
 * lecture au propriétaire de la ligne. Un membre voit donc rarement le profil de
 * ses collègues, et l'affichage doit se replier proprement.
 *
 * La tentation serait d'élargir la jointure pour « corriger » ces vides. Ce
 * serait une fuite : le nom et l'avatar de chaque utilisateur deviendraient
 * lisibles par toute personne partageant une organisation avec lui.
 */
export function memberDisplayName(member: MemberWithProfile): string {
  const profileName = member.profile?.display_name?.trim();
  if (profileName !== undefined && profileName !== '') return profileName;

  const jobTitle = member.job_title?.trim();
  if (jobTitle !== undefined && jobTitle !== '') return jobTitle;

  return 'Membre';
}

const ROLE_RANK: Record<OrgRole, number> = {
  owner: 1,
  admin: 2,
  manager: 3,
  team_leader: 4,
  technician: 5,
  employee: 6,
};

/**
 * Trie les membres par hiérarchie de rôle (Propriétaire en haut, puis Administrateur, etc.).
 */
export function sortMembersByRole(members: readonly MemberWithProfile[]): MemberWithProfile[] {
  return [...members].sort((a, b) => {
    const rankA = ROLE_RANK[a.role] ?? 99;
    const rankB = ROLE_RANK[b.role] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const nameA = memberDisplayName(a);
    const nameB = memberDisplayName(b);
    return nameA.localeCompare(nameB, 'fr');
  });
}
