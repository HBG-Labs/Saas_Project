import { supabase, unwrap } from '@/services/supabase';
import type { LeaveStatus, LeaveType, TablesInsert, TablesUpdate } from '@/types/database';
import type {
  ConsolidatedLeaveBalance,
  LeaveBalanceRow,
  LeaveRequestWithMember,
  MemberWithProfile,
  RecurringTaskRow,
  RecurringTaskWithRefs,
} from '@/types/domain';

/**
 * Accès au planning : congés, soldes et tâches récurrentes.
 *
 * Seul endroit de la feature autorisé à parler à Supabase.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE NE DÉCIDE PAS
 *
 * Il ne décide pas qui peut approuver un congé, ni si une demande est encore
 * modifiable, ni qui l'a validée. Tout cela est appliqué par le trigger
 * `app.enforce_leave_decision`, qui écrase au besoin ce que le client envoie.
 *
 * Les fonctions ci-dessous n'envoient donc jamais `reviewed_by` ni
 * `reviewed_at` : les poser ici donnerait l'illusion de les contrôler, et
 * masquerait que le serveur les réécrit. Le client demande un changement de
 * statut ; le serveur signe.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MEMBER_SELECT = `
  member:organization_members(
    *, profile:profiles(id, display_name, avatar_url)
  )
` as const;

// ---------------------------------------------------------------------- congés

export interface LeaveFilters {
  status?: LeaveStatus;
  /** Bornes incluses, au format `YYYY-MM-DD`. */
  from?: string;
  to?: string;
  memberId?: string;
}

export async function listLeaveRequests(
  organizationId: string,
  filters: LeaveFilters = {},
): Promise<LeaveRequestWithMember[]> {
  let query = supabase
    .from('leave_requests')
    .select(`*, ${MEMBER_SELECT}`)
    .eq('organization_id', organizationId);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.memberId) query = query.eq('member_id', filters.memberId);
  // Un congé chevauche la fenêtre s'il commence avant sa fin et finit après son
  // début. Filtrer sur `start_date` seul masquerait une absence en cours.
  if (filters.to) query = query.lte('start_date', filters.to);
  if (filters.from) query = query.gte('end_date', filters.from);

  return unwrap(
    query.order('start_date', { ascending: false }).returns<LeaveRequestWithMember[]>(),
  );
}

export interface LeaveRequestInput {
  organizationId: string;
  memberId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string;
}

export async function createLeaveRequest(
  input: LeaveRequestInput,
): Promise<LeaveRequestWithMember> {
  const payload: TablesInsert<'leave_requests'> = {
    organization_id: input.organizationId,
    member_id: input.memberId,
    type: input.type,
    start_date: input.startDate,
    end_date: input.endDate,
    days_count: input.daysCount,
    ...(input.reason !== undefined && input.reason !== '' ? { reason: input.reason } : {}),
  };

  return unwrap(
    supabase
      .from('leave_requests')
      .insert(payload)
      .select(`*, ${MEMBER_SELECT}`)
      .single()
      .returns<LeaveRequestWithMember>(),
  );
}

/**
 * Demander un changement de statut.
 *
 * `approved` et `rejected` échoueront si l'appelant n'a pas `leave.approve`, ou
 * s'il s'agit de ses propres congés — la séparation des pouvoirs est appliquée
 * par le trigger, comme pour les comptes rendus d'intervention.
 */
export async function setLeaveStatus(
  leaveId: string,
  status: Exclude<LeaveStatus, 'pending'>,
  reviewNote?: string,
): Promise<LeaveRequestWithMember> {
  const patch: TablesUpdate<'leave_requests'> = {
    status,
    ...(reviewNote !== undefined && reviewNote !== '' ? { review_note: reviewNote } : {}),
  };

  return unwrap(
    supabase
      .from('leave_requests')
      .update(patch)
      .eq('id', leaveId)
      .select(`*, ${MEMBER_SELECT}`)
      .single()
      .returns<LeaveRequestWithMember>(),
  );
}

// ---------------------------------------------------------------------- soldes

/**
 * Le solde de chacun, consolidé.
 *
 * Deux requêtes plutôt qu'une jointure : l'acquis vit dans `leave_balances`, le
 * consommé se somme dans `leave_requests`. PostgREST sait faire l'agrégat, mais
 * pas conditionné au statut ET au type dans le même appel — et un embed mal
 * formé renvoie un ensemble vide en silence, ce que ce projet a déjà payé une
 * fois.
 *
 * Seuls les congés APPROUVÉS décomptent. Une demande en attente n'a rien
 * consommé : l'afficher comme telle ferait croire à un solde plus bas qu'il
 * n'est, et découragerait une demande légitime.
 */
export async function listLeaveBalances(
  organizationId: string,
  year: number,
): Promise<ConsolidatedLeaveBalance[]> {
  const [balances, approved] = await Promise.all([
    unwrap(
      supabase
        .from('leave_balances')
        .select(`*, ${MEMBER_SELECT}`)
        .eq('organization_id', organizationId)
        .eq('year', year)
        .returns<(LeaveBalanceRow & { member: MemberWithProfile | null })[]>(),
    ),
    unwrap(
      supabase
        .from('leave_requests')
        .select('member_id, type, days_count')
        .eq('organization_id', organizationId)
        .eq('status', 'approved')
        .gte('start_date', `${String(year)}-01-01`)
        .lte('start_date', `${String(year)}-12-31`),
    ),
  ]);

  const takenPaid = new Map<string, number>();
  const takenRtt = new Map<string, number>();

  for (const row of approved) {
    const target = row.type === 'rtt' ? takenRtt : row.type === 'paid_leave' ? takenPaid : null;
    if (target === null) continue;
    target.set(row.member_id, (target.get(row.member_id) ?? 0) + Number(row.days_count));
  }

  return balances.map((balance) => {
    const paidTaken = takenPaid.get(balance.member_id) ?? 0;
    const rttTaken = takenRtt.get(balance.member_id) ?? 0;

    return {
      memberId: balance.member_id,
      year: balance.year,
      paidLeaveAcquired: Number(balance.paid_leave_acquired),
      paidLeaveTaken: paidTaken,
      paidLeaveRemaining: Number(balance.paid_leave_acquired) - paidTaken,
      rttAcquired: Number(balance.rtt_acquired),
      rttTaken,
      rttRemaining: Number(balance.rtt_acquired) - rttTaken,
      recoveryHours: Number(balance.recovery_hours),
      member: balance.member,
    };
  });
}

export interface LeaveBalanceInput {
  organizationId: string;
  memberId: string;
  year: number;
  paidLeaveAcquired?: number;
  rttAcquired?: number;
  recoveryHours?: number;
}

/**
 * Poser ou corriger l'acquis d'un membre pour une année.
 *
 * `upsert` sur `(member_id, year)` : l'écran n'a pas à savoir si la ligne
 * existait déjà, et deux gestionnaires qui saisissent en même temps ne créent
 * pas deux soldes concurrents.
 */
export async function upsertLeaveBalance(
  input: LeaveBalanceInput,
): Promise<ConsolidatedLeaveBalance[]> {
  const payload: TablesInsert<'leave_balances'> = {
    organization_id: input.organizationId,
    member_id: input.memberId,
    year: input.year,
    ...(input.paidLeaveAcquired !== undefined
      ? { paid_leave_acquired: input.paidLeaveAcquired }
      : {}),
    ...(input.rttAcquired !== undefined ? { rtt_acquired: input.rttAcquired } : {}),
    ...(input.recoveryHours !== undefined ? { recovery_hours: input.recoveryHours } : {}),
  };

  await unwrap(
    supabase
      .from('leave_balances')
      .upsert(payload, { onConflict: 'member_id,year' })
      .select('id'),
  );

  return listLeaveBalances(input.organizationId, input.year);
}

// ------------------------------------------------------------ tâches récurrentes

const RECURRING_SELECT = `
  *,
  customer:customers(id, name),
  site:sites(id, name, address_line1, city),
  assigned_member:organization_members(
    *, profile:profiles(id, display_name, avatar_url)
  )
` as const;

export async function listRecurringTasks(
  organizationId: string,
): Promise<RecurringTaskWithRefs[]> {
  return unwrap(
    supabase
      .from('recurring_tasks')
      .select(RECURRING_SELECT)
      .eq('organization_id', organizationId)
      .order('next_date', { ascending: true })
      .returns<RecurringTaskWithRefs[]>(),
  );
}

export interface RecurringTaskInput {
  organizationId: string;
  title: string;
  frequency: RecurringTaskRow['frequency'];
  nextDate: string;
  customerId?: string | null;
  siteId?: string | null;
  assignedMemberId?: string | null;
  interventionTypeId?: string | null;
  estimatedMinutes?: number | null;
  notes?: string;
}

export async function createRecurringTask(input: RecurringTaskInput): Promise<RecurringTaskRow> {
  const { data: userData } = await supabase.auth.getUser();

  const payload: TablesInsert<'recurring_tasks'> = {
    organization_id: input.organizationId,
    title: input.title,
    frequency: input.frequency,
    next_date: input.nextDate,
    ...(userData?.user ? { created_by: userData.user.id } : {}),
    ...(input.customerId ? { customer_id: input.customerId } : {}),
    ...(input.siteId ? { site_id: input.siteId } : {}),
    ...(input.assignedMemberId ? { assigned_member_id: input.assignedMemberId } : {}),
    ...(input.interventionTypeId ? { intervention_type_id: input.interventionTypeId } : {}),
    ...(input.estimatedMinutes != null ? { estimated_minutes: input.estimatedMinutes } : {}),
    ...(input.notes !== undefined && input.notes !== '' ? { notes: input.notes } : {}),
  };

  return unwrap(supabase.from('recurring_tasks').insert(payload).select('*').single());
}

export async function updateRecurringTask(
  taskId: string,
  patch: TablesUpdate<'recurring_tasks'>,
): Promise<RecurringTaskRow> {
  return unwrap(supabase.from('recurring_tasks').update(patch).eq('id', taskId).select('*').single());
}

export async function deleteRecurringTask(taskId: string): Promise<void> {
  await unwrap(supabase.from('recurring_tasks').delete().eq('id', taskId).select('id'));
}
