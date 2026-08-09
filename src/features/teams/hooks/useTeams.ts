import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { TablesUpdate } from '@/types/database';

import { archiveTeam, createTeam, getTeamWithMembers, listTeams, updateTeam } from '../api/teams.api';

/**
 * Équipes actives de l'organisation.
 *
 * Une liste vide n'est pas une erreur. Elle peut signifier trois choses très
 * différentes, que l'écran doit distinguer : aucune équipe n'existe encore,
 * l'abonnement ne débloque pas la fonctionnalité, ou le rôle ne permet pas de
 * les consulter. Les deux dernières sont interceptées par les gardes de route
 * avant d'atteindre cette requête.
 */
export function useTeams(organizationId: string | null) {
  return useQuery({
    queryKey: qk.teams.list(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listTeams(organizationId)),
    enabled: organizationId !== null,
  });
}

/** Équipe avec ses membres et leurs profils. */
export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: qk.teams.detail(teamId ?? 'none'),
    queryFn: () => (teamId === undefined ? null : getTeamWithMembers(teamId)),
    enabled: teamId !== undefined,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTeam,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.teams.all });
    },
  });
}

export function useUpdateTeam(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: TablesUpdate<'teams'>) => updateTeam(teamId, patch),
    onSuccess: async () => {
      // Le nom et la couleur figurent dans la liste comme dans la fiche : les
      // deux clés doivent tomber, sans quoi la liste garderait l'ancien nom.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.teams.detail(teamId) }),
        queryClient.invalidateQueries({ queryKey: qk.teams.all }),
      ]);
    },
  });
}

export function useArchiveTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveTeam,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.teams.all });
    },
  });
}
