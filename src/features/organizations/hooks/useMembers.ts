import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { syncSubscriptionSeats } from '@/features/billing';
import { qk } from '@/lib/query-keys';
import type { OrgRole } from '@/types/database';
import type { MemberWithProfile } from '@/types/domain';

import {
  createMemberAccount,
  listMembers,
  removeMember,
  updateMemberDetails,
  updateMemberRole,
} from '../api/organizations.api';

/**
 * Répercute l'effectif sur la facturation, après coup et sans bloquer.
 *
 * Un siège au-delà de ceux compris dans la formule coûte 5 € par mois. Si
 * personne ne prévient Stripe, l'organisation grandit sans que la facture
 * suive — le genre de dérive qu'on ne découvre qu'au moment du prélèvement,
 * quand un client la signale.
 *
 * L'appel est délibérément « au mieux » : son échec n'annule pas l'ajout du
 * membre. Voir `syncSubscriptionSeats` pour le raisonnement.
 */
async function repercuterSurLaFacturation(organizationId: string): Promise<void> {
  await syncSubscriptionSeats(organizationId);
}

export function useMembers(organizationId: string | null) {
  return useQuery({
    queryKey: qk.organizations.members(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listMembers(organizationId)),
    enabled: organizationId !== null,
  });
}

/**
 * Crée le compte d'un collaborateur et le rattache à l'organisation.
 *
 * Le mot de passe renvoyé n'est PAS mis en cache : il n'est lisible qu'une fois,
 * dans la réponse de la mutation. Le stocker dans le cache de requêtes le
 * laisserait en mémoire du navigateur bien après la fermeture de la boîte de
 * dialogue.
 */
export function useCreateMemberAccount(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      email: string;
      role: OrgRole;
      displayName?: string;
      jobTitle?: string;
      password?: string;
    }) => createMemberAccount({ ...input, organizationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.organizations.members(organizationId),
      });
      await queryClient.invalidateQueries({ queryKey: qk.billing.all });
      await repercuterSurLaFacturation(organizationId);
    },
  });
}

export function useUpdateMemberDetails(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      displayName,
      jobTitle,
    }: {
      memberId: string;
      displayName?: string;
      jobTitle?: string;
    }) => {
      const updated = await updateMemberDetails(memberId, { displayName, jobTitle });

      queryClient.setQueryData<MemberWithProfile[]>(
        qk.organizations.members(organizationId),
        (old) => {
          if (!old) return old;
          return old.map((m) => {
            if (m.id !== memberId) return m;
            return {
              ...m,
              job_title: jobTitle !== undefined ? jobTitle : m.job_title,
              profile: {
                id: m.profile?.id ?? `prof-${memberId}`,
                display_name: displayName !== undefined ? displayName : (m.profile?.display_name ?? ''),
                avatar_url: m.profile?.avatar_url ?? null,
              },
            };
          });
        },
      );

      return updated;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.organizations.members(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: qk.teams.all,
        }),
      ]);
    },
  });
}

export function useUpdateMemberRole(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: OrgRole }) => {
      const updated = await updateMemberRole(memberId, role);

      queryClient.setQueryData<MemberWithProfile[]>(
        qk.organizations.members(organizationId),
        (old) => {
          if (!old) return old;
          return old.map((m) => (m.id === memberId ? { ...m, role } : m));
        },
      );

      return updated;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.organizations.members(organizationId),
        }),
        queryClient.invalidateQueries({
          queryKey: qk.teams.all,
        }),
      ]);
    },
  });
}

/**
 * Retire un membre — statut `removed`, sans suppression de ligne.
 */
export function useRemoveMember(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.organizations.members(organizationId),
      });
      await queryClient.invalidateQueries({ queryKey: qk.billing.all });
      await repercuterSurLaFacturation(organizationId);
    },
  });
}

/**
 * Nom à afficher pour un membre.
 */
export function memberDisplayName(member: MemberWithProfile): string {
  const rawName = member.profile?.display_name?.trim();
  if (rawName !== undefined && rawName !== '') {
    return rawName.replace(/\s*\((Entrepreneur|Technicien|Responsable|Membre|Admin)\)/gi, '');
  }

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
