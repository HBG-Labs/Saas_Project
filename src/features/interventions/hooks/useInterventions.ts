import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { TimeEntryKind } from '@/types/database';

import {
  completeIntervention,
  getIntervention,
  getWorkedSeconds,
  listInterventions,
  listTimeEntries,
  startIntervention,
  stopTimeTracking,
  switchTimeEntry,
  updateIntervention,
} from '../api/interventions.api';

export function useMissionInterventions(missionId: string | undefined) {
  return useQuery({
    queryKey: qk.interventions.ofMission(missionId ?? 'none'),
    queryFn: () => (missionId === undefined ? [] : listInterventions(missionId)),
    enabled: missionId !== undefined,
  });
}

export function useIntervention(interventionId: string | undefined) {
  return useQuery({
    queryKey: qk.interventions.detail(interventionId ?? 'none'),
    queryFn: () => (interventionId === undefined ? null : getIntervention(interventionId)),
    enabled: interventionId !== undefined,
  });
}

/**
 * Segments de temps de l'intervention.
 *
 * `staleTime` nul et `refetchOnWindowFocus` : le technicien passe de
 * l'application à l'appareil de mesure, puis revient. S'il a démarré depuis un
 * autre appareil entre-temps, l'écran doit s'en apercevoir plutôt que d'afficher
 * un chronomètre à l'arrêt sur une intervention en cours.
 */
export function useTimeEntries(interventionId: string | undefined) {
  return useQuery({
    queryKey: qk.interventions.timeEntries(interventionId ?? 'none'),
    queryFn: () => (interventionId === undefined ? [] : listTimeEntries(interventionId)),
    enabled: interventionId !== undefined,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Temps net calculé par PostgreSQL — le même que celui qui servira à facturer. */
export function useWorkedSeconds(interventionId: string | undefined) {
  return useQuery({
    queryKey: [...qk.interventions.timeEntries(interventionId ?? 'none'), 'worked'],
    queryFn: () => (interventionId === undefined ? 0 : getWorkedSeconds(interventionId)),
    enabled: interventionId !== undefined,
    staleTime: 0,
  });
}

/**
 * Notes de terrain.
 *
 * `completeIntervention` acceptait déjà des notes, mais une seule fois, au
 * moment de terminer — c'est-à-dire au pire moment : celui où l'on range le
 * matériel. Ce qui se note pendant l'intervention (un câble sectionné, un
 * client absent) restait dans une poche.
 *
 * Le trigger `enforce_intervention_scope` laisse ce champ libre : il ne
 * verrouille que les horodatages, la mission d'attache et le technicien.
 */
export function useUpdateInterventionNotes(interventionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notes: string | null) => updateIntervention(interventionId, { notes }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.interventions.all });
    },
  });
}

export function useStartIntervention(missionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startIntervention,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.interventions.ofMission(missionId) }),
        // La mission passe en `in_progress` par la machine à états.
        queryClient.invalidateQueries({ queryKey: qk.missions.all }),
      ]);
    },
  });
}

/**
 * Démarrage, pause, reprise — une seule mutation.
 *
 * Les trois actions sont la même opération : fermer le segment courant, en
 * ouvrir un de l'autre nature. Trois hooks distincts feraient croire à trois
 * mécanismes, et l'un des trois finirait par oublier une invalidation.
 */
export function useSwitchTimeEntry(interventionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      openEntryId: string | null;
      to: TimeEntryKind;
      reason?: string;
    }) => switchTimeEntry({ interventionId, ...input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.interventions.timeEntries(interventionId),
      });
    },
  });
}

/**
 * Termine l'intervention.
 *
 * Ferme d'abord le segment de temps ouvert, sinon le relevé garderait un
 * segment sans fin — et le temps net, qui ne compte que les segments clos,
 * omettrait la dernière période travaillée.
 */
export function useCompleteIntervention(interventionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { openEntryId: string | null; notes?: string }) => {
      if (input.openEntryId !== null) {
        await stopTimeTracking(input.openEntryId);
      }
      return completeIntervention(interventionId, input.notes);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.interventions.all }),
        queryClient.invalidateQueries({ queryKey: qk.missions.all }),
      ]);
    },
  });
}
