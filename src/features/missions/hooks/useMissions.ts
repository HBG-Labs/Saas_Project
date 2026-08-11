import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { MissionStatus, TablesUpdate } from '@/types/database';

import {
  assignMission,
  changeMissionStatus,
  createMission,
  deleteMission,
  getMission,
  listMissionAssignments,
  listMissionHistory,
  listMissions,
  updateMission,
  type MissionFilters,
} from '../api/missions.api';

export function useMissions(organizationId: string | null, filters: MissionFilters = {}) {
  return useQuery({
    queryKey: qk.missions.list(organizationId ?? 'none', filters),
    queryFn: () => (organizationId === null ? [] : listMissions(organizationId, filters)),
    enabled: organizationId !== null,
  });
}

export function useMission(missionId: string | undefined) {
  return useQuery({
    queryKey: qk.missions.detail(missionId ?? 'none'),
    queryFn: () => (missionId === undefined ? null : getMission(missionId)),
    enabled: missionId !== undefined,
  });
}

/**
 * Journal des changements d'état.
 *
 * Écrit par le trigger `enforce_mission_transition`, jamais par le client. C'est
 * ce qui rend l'historique digne de foi : il n'existe aucun chemin applicatif
 * pour y insérer une ligne complaisante.
 */
export function useMissionHistory(missionId: string | undefined) {
  return useQuery({
    queryKey: qk.missions.history(missionId ?? 'none'),
    queryFn: () => (missionId === undefined ? [] : listMissionHistory(missionId)),
    enabled: missionId !== undefined,
  });
}

/**
 * Historique des affectations successives.
 *
 * Distinct de `useMissionHistory`, qui suit les changements d'ÉTAT. Celui-ci
 * répond à « qui a eu ce dossier en main, et depuis quand » : une mission
 * réaffectée trois fois ne garde que la dernière équipe sur sa fiche, et la
 * question du refus — quand, et pour quel motif — n'a plus de réponse ailleurs.
 */
export function useMissionAssignments(missionId: string | undefined) {
  return useQuery({
    queryKey: qk.missions.assignments(missionId ?? 'none'),
    queryFn: () => (missionId === undefined ? [] : listMissionAssignments(missionId)),
    enabled: missionId !== undefined,
  });
}

export function useCreateMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMission,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.missions.all });
    },
  });
}

export function useUpdateMission(missionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: TablesUpdate<'missions'>) => updateMission(missionId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.missions.all });
    },
  });
}

export function useAssignMission(missionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { teamId?: string | null; memberId?: string | null; assignedBy: string }) =>
      assignMission({ missionId, ...input }),
    onSuccess: async () => {
      // L'affectation change AUSSI le statut (`draft` → `assigned`) et écrit une
      // ligne d'historique : les trois vues du domaine sont concernées.
      await queryClient.invalidateQueries({ queryKey: qk.missions.all });
    },
  });
}

/**
 * Change le statut d'une mission.
 *
 * Aucune vérification ici : le trigger refuse toute transition absente de
 * `mission_status_transitions`, tentée sans la permission requise, ou par
 * quelqu'un qui n'est pas l'assigné quand la règle l'exige. Reproduire cet
 * arbitrage côté client le ferait diverger — c'est la copie qu'on oublie de
 * mettre à jour.
 *
 * L'interface ne propose que les transitions possibles ; le refus, lui, reste
 * l'affaire du serveur.
 */
export function useChangeMissionStatus(missionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: MissionStatus) => changeMissionStatus(missionId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.missions.all });
    },
  });
}

export function useDeleteMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (missionId: string) => deleteMission(missionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.missions.all });
    },
  });
}
