import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { WorkTimeKind } from '@/types/database';

import {
  closeTimesheetMonth,
  declareWorkTime,
  deleteWorkTime,
  getOpenWorkTime,
  getTimesheetMonth,
  listTimesheetClosures,
  listTimesheetDays,
  listTimesheetWeeks,
  listWorkTimeEntries,
  reopenTimesheetMonth,
  startWorkTime,
  stopWorkTime,
  updateWorkTime,
  type CloseTimesheetMonthInput,
  type DeclareWorkTimeInput,
  type WorkTimeFilters,
} from '../api/timesheet.api';

/**
 * Hooks de la feuille d'heures.
 *
 * Tout ce qui touche à un segment de temps invalide la racine `timesheet` :
 * un segment change une journée, la semaine qui la contient, le mois, et
 * l'instantané qu'une clôture calculerait. Le chronomètre hors intervention
 * invalide AUSSI les interventions : le démarrer ferme le chronomètre
 * d'intervention en cours, et l'inverse est vrai côté base.
 */

function useInvalidateTimesheet() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: qk.timesheet.all });
  };
}

// ─── Le chronomètre ──────────────────────────────────────────────────────────

export function useOpenWorkTime(memberId: string | null) {
  return useQuery({
    queryKey: qk.timesheet.openEntry(memberId ?? 'none'),
    queryFn: () => getOpenWorkTime(memberId ?? ''),
    enabled: memberId !== null,
    // Un chronomètre se lit souvent ; une seconde de retard sur son état ne
    // trompe personne, un appel par rendu si.
    staleTime: 15_000,
  });
}

export function useStartWorkTime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      kind,
      note,
    }: {
      organizationId: string;
      kind: WorkTimeKind;
      note?: string;
    }) => startWorkTime(organizationId, kind, note),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.timesheet.all }),
        queryClient.invalidateQueries({ queryKey: qk.interventions.all }),
      ]);
    },
  });
}

export function useStopWorkTime() {
  const invalidate = useInvalidateTimesheet();
  return useMutation({ mutationFn: () => stopWorkTime(), onSuccess: invalidate });
}

export function useWorkTimeEntries(organizationId: string | null, filters: WorkTimeFilters = {}) {
  return useQuery({
    queryKey: qk.timesheet.entries(organizationId ?? 'none', filters),
    queryFn: () => listWorkTimeEntries(organizationId ?? '', filters),
    enabled: organizationId !== null,
  });
}

// ─── La correction ───────────────────────────────────────────────────────────

export function useDeclareWorkTime() {
  const invalidate = useInvalidateTimesheet();
  return useMutation({
    mutationFn: (input: DeclareWorkTimeInput) => declareWorkTime(input),
    onSuccess: invalidate,
  });
}

export function useUpdateWorkTime() {
  const invalidate = useInvalidateTimesheet();
  return useMutation({
    mutationFn: ({
      entryId,
      patch,
    }: {
      entryId: string;
      patch: Parameters<typeof updateWorkTime>[1];
    }) => updateWorkTime(entryId, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteWorkTime() {
  const invalidate = useInvalidateTimesheet();
  return useMutation({
    mutationFn: (entryId: string) => deleteWorkTime(entryId),
    onSuccess: invalidate,
  });
}

// ─── Journées, semaines, mois ────────────────────────────────────────────────

export function useTimesheetDays(
  organizationId: string | null,
  range: { from: string; to: string; memberId?: string },
) {
  return useQuery({
    queryKey: qk.timesheet.days(organizationId ?? 'none', range),
    queryFn: () => listTimesheetDays(organizationId ?? '', range),
    enabled: organizationId !== null,
  });
}

export function useTimesheetWeeks(
  organizationId: string | null,
  range: { from: string; to: string; memberId?: string },
) {
  return useQuery({
    queryKey: qk.timesheet.weeks(organizationId ?? 'none', range),
    queryFn: () => listTimesheetWeeks(organizationId ?? '', range),
    enabled: organizationId !== null,
  });
}

/** `month` : `YYYY-MM-DD`, n'importe quel jour du mois. */
export function useTimesheetMonth(organizationId: string | null, month: string) {
  return useQuery({
    queryKey: qk.timesheet.month(organizationId ?? 'none', month),
    queryFn: () => getTimesheetMonth(organizationId ?? '', month),
    enabled: organizationId !== null,
  });
}

// ─── La clôture ──────────────────────────────────────────────────────────────

export function useTimesheetClosures(
  organizationId: string | null,
  filters: Parameters<typeof listTimesheetClosures>[1] = {},
) {
  return useQuery({
    queryKey: qk.timesheet.closures(organizationId ?? 'none', filters),
    queryFn: () => listTimesheetClosures(organizationId ?? '', filters),
    enabled: organizationId !== null,
  });
}

export function useCloseTimesheetMonth() {
  const invalidate = useInvalidateTimesheet();
  return useMutation({
    mutationFn: (input: CloseTimesheetMonthInput) => closeTimesheetMonth(input),
    onSuccess: invalidate,
  });
}

export function useReopenTimesheetMonth() {
  const invalidate = useInvalidateTimesheet();
  return useMutation({
    mutationFn: ({ closureId, note }: { closureId: string; note?: string }) =>
      reopenTimesheetMonth(closureId, note),
    onSuccess: invalidate,
  });
}
