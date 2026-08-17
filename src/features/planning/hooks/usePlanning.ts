import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { LeaveStatus, TablesUpdate } from '@/types/database';

import {
  previewLeaveDays,
  createLeaveRequest,
  createRecurringTask,
  deleteRecurringTask,
  listLeaveBalances,
  listLeaveRequests,
  listRecurringTasks,
  setLeaveStatus,
  updateRecurringTask,
  upsertLeaveBalance,
  type LeaveBalanceInput,
  type LeaveFilters,
  type LeaveRequestInput,
  type RecurringTaskInput,
} from '../api/planning.api';

/**
 * Accès au planning depuis les composants.
 *
 * Toutes les mutations invalident la racine `planning`. Invalider la seule
 * liste courante laisserait les soldes périmés : un congé approuvé change à la
 * fois la demande ET le solde restant du membre, qui sont deux entrées de cache
 * distinctes. Un solde faux est exactement le genre de défaut qu'on ne voit
 * qu'au moment où quelqu'un pose un congé qu'il n'a plus.
 */

export function useLeaveRequests(organizationId: string | null, filters: LeaveFilters = {}) {
  return useQuery({
    queryKey: qk.planning.leaves(organizationId ?? 'none', filters),
    queryFn: () => (organizationId === null ? [] : listLeaveRequests(organizationId, filters)),
    enabled: organizationId !== null,
  });
}

/**
 * Aperçu du décompte d'une période, calculé par le serveur.
 *
 * Interrogé à chaque changement de dates. C'est un aller-retour réseau pour
 * afficher un nombre — assumé : l'alternative était un second moteur en
 * TypeScript, dont la dérive se serait payée en jours de congé.
 *
 * `staleTime` élevé : pour un couple de dates donné, la réponse ne change qu'au
 * changement de territoire de l'entreprise.
 */
export function useLeaveDaysPreview(params: {
  startDate: string;
  endDate: string;
  territory: string;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  enabled?: boolean;
}) {
  const { enabled = true, ...args } = params;

  return useQuery({
    queryKey: [
      ...qk.planning.all,
      'preview',
      args.startDate,
      args.endDate,
      args.territory,
      args.halfDayStart,
      args.halfDayEnd,
    ],
    queryFn: () => previewLeaveDays(args),
    enabled: enabled && args.startDate !== '' && args.endDate !== '',
    staleTime: 5 * 60_000,
  });
}

export function useLeaveBalances(organizationId: string | null, year: number) {
  return useQuery({
    queryKey: qk.planning.balances(organizationId ?? 'none', year),
    queryFn: () => (organizationId === null ? [] : listLeaveBalances(organizationId, year)),
    enabled: organizationId !== null,
  });
}

export function useCreateLeaveRequest(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<LeaveRequestInput, 'organizationId'>) =>
      createLeaveRequest({ ...input, organizationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.planning.all });
    },
  });
}

/**
 * Statuer sur une demande.
 *
 * Le refus vient du serveur, pas d'ici : un chef d'équipe qui tenterait
 * d'approuver, ou un responsable qui viserait ses propres congés, reçoit une
 * erreur du trigger. L'interface masque le bouton, elle ne garantit rien.
 */
export function useSetLeaveStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      leaveId,
      status,
      reviewNote,
    }: {
      leaveId: string;
      status: Exclude<LeaveStatus, 'pending'>;
      reviewNote?: string;
    }) => setLeaveStatus(leaveId, status, reviewNote),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.planning.all });
    },
  });
}

export function useUpsertLeaveBalance(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<LeaveBalanceInput, 'organizationId'>) =>
      upsertLeaveBalance({ ...input, organizationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.planning.all });
    },
  });
}

export function useRecurringTasks(organizationId: string | null) {
  return useQuery({
    queryKey: qk.planning.recurringTasks(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listRecurringTasks(organizationId)),
    enabled: organizationId !== null,
  });
}

export function useCreateRecurringTask(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<RecurringTaskInput, 'organizationId'>) =>
      createRecurringTask({ ...input, organizationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.planning.all });
    },
  });
}

export function useUpdateRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TablesUpdate<'recurring_tasks'> }) =>
      updateRecurringTask(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.planning.all });
    },
  });
}

export function useDeleteRecurringTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => deleteRecurringTask(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.planning.all });
    },
  });
}
