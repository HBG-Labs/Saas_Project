import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { Database, Tables, WorkTimeKind } from '@/types/database';

/**
 * Accès à la feuille d'heures — 20261002090000_feuille_heures.sql.
 *
 * Seul endroit de la feature autorisé à parler à Supabase.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE NE DÉCIDE PAS
 *
 * Il ne calcule rien : journées, semaines, dépassement, jours de congé,
 * instantané de clôture sont produits par la base (vues `timesheet_days`,
 * `timesheet_weeks`, fonction `timesheet_month`). Il ne pose pas d'heure
 * non plus : pour soi-même, le serveur horodate (`start_work_time`,
 * `stop_work_time`) et ignore tout horodatage envoyé. Seul qui porte
 * `timesheet.manage` déclare des horaires explicites — `declareWorkTime`.
 *
 * Il ne valorise pas la paie : le dépassement est une durée, jamais un taux.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type WorkTimeEntry = Tables<'work_time_entries'>;
export type TimesheetDay = Database['public']['Views']['timesheet_days']['Row'];
export type TimesheetWeek = Database['public']['Views']['timesheet_weeks']['Row'];
export type TimesheetClosure = Tables<'timesheet_closures'>;
export type TimesheetMonthRow =
  Database['public']['Functions']['timesheet_month']['Returns'][number];

export const WORK_TIME_KIND_LABELS: Record<WorkTimeKind, string> = {
  travel: 'Trajet',
  workshop: 'Atelier',
  training: 'Formation',
  other: 'Autre',
};

// ─── Le chronomètre hors intervention ────────────────────────────────────────

/**
 * Ouvre un temps hors intervention pour le compte connecté. Ferme d'abord tout
 * chronomètre en cours — intervention comprise : un trajet qui commence, c'est
 * une intervention qui s'arrête.
 */
export async function startWorkTime(
  organizationId: string,
  kind: WorkTimeKind,
  note?: string,
): Promise<WorkTimeEntry> {
  return unwrap(
    supabase.rpc('start_work_time', {
      p_organization_id: organizationId,
      p_kind: kind,
      ...(note !== undefined ? { p_note: note } : {}),
    }),
  );
}

/** Ferme le temps hors intervention en cours. `null` s'il n'y en avait pas. */
export async function stopWorkTime(): Promise<WorkTimeEntry | null> {
  return unwrapMaybe(supabase.rpc('stop_work_time'));
}

/** Le temps hors intervention encore ouvert d'un membre, s'il y en a un. */
export async function getOpenWorkTime(memberId: string): Promise<WorkTimeEntry | null> {
  return unwrapMaybe(
    supabase
      .from('work_time_entries')
      .select('*')
      .eq('member_id', memberId)
      .is('ended_at', null)
      .maybeSingle(),
  );
}

export interface WorkTimeFilters {
  memberId?: string;
  /** Bornes ISO sur `started_at`. */
  from?: string;
  to?: string;
}

export async function listWorkTimeEntries(
  organizationId: string,
  filters: WorkTimeFilters = {},
): Promise<WorkTimeEntry[]> {
  let query = supabase
    .from('work_time_entries')
    .select('*')
    .eq('organization_id', organizationId)
    .order('started_at', { ascending: false });
  if (filters.memberId) query = query.eq('member_id', filters.memberId);
  if (filters.from) query = query.gte('started_at', filters.from);
  if (filters.to) query = query.lt('started_at', filters.to);
  return unwrap(query);
}

// ─── La correction, par qui gère la feuille ──────────────────────────────────

export interface DeclareWorkTimeInput {
  memberId: string;
  kind: WorkTimeKind;
  /** ISO. Retenu seulement avec `timesheet.manage` ; sinon le serveur horodate. */
  startedAt: string;
  endedAt: string;
  note?: string;
}

/**
 * Déclare un segment avec des horaires explicites — l'oubli réparé. La base
 * exige `timesheet.manage` pour retenir les horaires, refuse le futur, le
 * chevauchement, et un mois clos ; et journalise la déclaration.
 */
export async function declareWorkTime(input: DeclareWorkTimeInput): Promise<WorkTimeEntry> {
  return unwrap(
    supabase
      .from('work_time_entries')
      .insert({
        member_id: input.memberId,
        kind: input.kind,
        started_at: input.startedAt,
        ended_at: input.endedAt,
        ...(input.note !== undefined ? { note: input.note } : {}),
      })
      .select('*')
      .single(),
  );
}

export async function updateWorkTime(
  entryId: string,
  patch: Pick<Partial<DeclareWorkTimeInput>, 'kind' | 'startedAt' | 'endedAt' | 'note'>,
): Promise<WorkTimeEntry> {
  return unwrap(
    supabase
      .from('work_time_entries')
      .update({
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.startedAt !== undefined ? { started_at: patch.startedAt } : {}),
        ...(patch.endedAt !== undefined ? { ended_at: patch.endedAt } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
      })
      .eq('id', entryId)
      .select('*')
      .single(),
  );
}

export async function deleteWorkTime(entryId: string): Promise<void> {
  await unwrap(supabase.from('work_time_entries').delete().eq('id', entryId).select('id'));
}

// ─── Les journées, les semaines, le mois ─────────────────────────────────────

/** Les journées avec du temps, entre deux dates incluses (`YYYY-MM-DD`). */
export async function listTimesheetDays(
  organizationId: string,
  range: { from: string; to: string; memberId?: string },
): Promise<TimesheetDay[]> {
  let query = supabase
    .from('timesheet_days')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('day', range.from)
    .lte('day', range.to)
    .order('day', { ascending: true });
  if (range.memberId) query = query.eq('member_id', range.memberId);
  return unwrap(query);
}

/** Les semaines ISO dont le lundi tombe entre deux dates incluses. */
export async function listTimesheetWeeks(
  organizationId: string,
  range: { from: string; to: string; memberId?: string },
): Promise<TimesheetWeek[]> {
  let query = supabase
    .from('timesheet_weeks')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('week_start', range.from)
    .lte('week_start', range.to)
    .order('week_start', { ascending: true });
  if (range.memberId) query = query.eq('member_id', range.memberId);
  return unwrap(query);
}

/**
 * Le mois complet : une ligne par membre actif et par jour, travaillé ou non.
 * `month` au format `YYYY-MM-DD` (n'importe quel jour du mois).
 */
export async function getTimesheetMonth(
  organizationId: string,
  month: string,
): Promise<TimesheetMonthRow[]> {
  return unwrap(
    supabase.rpc('timesheet_month', { p_organization_id: organizationId, p_month: month }),
  );
}

// ─── La clôture ──────────────────────────────────────────────────────────────

export async function listTimesheetClosures(
  organizationId: string,
  filters: { month?: string; memberId?: string; activeOnly?: boolean } = {},
): Promise<TimesheetClosure[]> {
  let query = supabase
    .from('timesheet_closures')
    .select('*')
    .eq('organization_id', organizationId)
    .order('closed_at', { ascending: false });
  if (filters.month) query = query.eq('month', filters.month);
  if (filters.memberId) query = query.eq('member_id', filters.memberId);
  if (filters.activeOnly) query = query.is('reopened_at', null);
  return unwrap(query);
}

export interface CloseTimesheetMonthInput {
  organizationId: string;
  memberId: string;
  /** `YYYY-MM-DD`, n'importe quel jour du mois. */
  month: string;
  note?: string;
}

export async function closeTimesheetMonth(
  input: CloseTimesheetMonthInput,
): Promise<TimesheetClosure> {
  return unwrap(
    supabase.rpc('close_timesheet_month', {
      p_organization_id: input.organizationId,
      p_member_id: input.memberId,
      p_month: input.month,
      ...(input.note !== undefined ? { p_note: input.note } : {}),
    }),
  );
}

export async function reopenTimesheetMonth(
  closureId: string,
  note?: string,
): Promise<TimesheetClosure> {
  return unwrap(
    supabase.rpc('reopen_timesheet_month', {
      p_closure_id: closureId,
      ...(note !== undefined ? { p_note: note } : {}),
    }),
  );
}
