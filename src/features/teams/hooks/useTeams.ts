import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { qk } from '@/lib/query-keys';
import { supabase } from '@/services/supabase';
import type { TablesUpdate } from '@/types/database';
import type { Team } from '@/types/domain';

import {
  archiveTeam,
  createTeam,
  deleteTeam,
  getTeamWithMembers,
  listOrganizationTeamMemberships,
  listTeams,
  updateTeam,
} from '../api/teams.api';

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
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId) return;

    const channelId = `realtime_teams_${organizationId}_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: qk.teams.list(organizationId),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

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

/**
 * Équipes de chaque membre, indexées par identifiant de membre.
 *
 * Une seule requête pour toute la page : `listTeamsOfMember` appelée par ligne
 * produirait autant d'allers-retours que de membres.
 */
export function useTeamMembershipsByMember(organizationId: string | null) {
  return useQuery({
    queryKey: qk.teams.memberships(organizationId ?? 'none'),
    queryFn: async () => {
      if (organizationId === null) return new Map<string, Team[]>();

      const rows = await listOrganizationTeamMemberships(organizationId);
      const byMember = new Map<string, Team[]>();

      for (const row of rows) {
        const existing = byMember.get(row.memberId);
        if (existing === undefined) byMember.set(row.memberId, [row.team]);
        else existing.push(row.team);
      }

      return byMember;
    },
    enabled: organizationId !== null,
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

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => deleteTeam(teamId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.teams.all });
    },
  });
}
