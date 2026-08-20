import { memberDisplayName, ROLE_LABELS } from '@/features/organizations';
import type { MemberWithProfile } from '@/types/domain';
import type {
  ConsolidatedLeaveBalance,
  LeaveRequestWithMember,
  MissionWithRelations,
  RecurringTaskWithRefs,
} from '@/types/domain';

import type {
  LeaveRequest,
  PlanningCalendarEvent,
  PublicHoliday,
  RecurringTask,
  StaffLeaveBalance,
} from './types';

/**
 * Passage des lignes de la base aux formes attendues par les écrans.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE COUCHE EXISTE
 *
 * Les composants du planning ont été écrits avant que les tables n'existent, sur
 * des formes plates et déjà mises en français : `technicianName`,
 * `technicianInitials`, `daysCount`. Ce n'est pas une dette — c'est un MODÈLE DE
 * VUE, et il a une valeur propre : un calendrier n'a pas à savoir qu'un nom
 * d'intervenant vient d'une jointure sur `profiles`.
 *
 * Traduire ici plutôt que de réécrire deux mille lignes de composants garde une
 * frontière nette : la base décide de la vérité, l'écran décide de sa
 * présentation, et le jour où l'une bouge, l'autre ne suit pas mécaniquement.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Deux initiales au plus : au-delà, le cercle d'avatar devient illisible. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function describeMember(member: MemberWithProfile | null): {
  id: string;
  name: string;
  role: string;
  initials: string;
} {
  if (member === null) {
    // Le membre a quitté l'entreprise, ou la jointure ne l'a pas ramené. La
    // demande de congé reste une trace sociale valide : elle ne doit pas
    // disparaître de l'écran faute de nom.
    return { id: '', name: 'Membre retiré', role: '—', initials: '—' };
  }

  const name = memberDisplayName(member);
  return { id: member.id, name, role: ROLE_LABELS[member.role], initials: initialsOf(name) };
}

export function toLeaveRequest(row: LeaveRequestWithMember): LeaveRequest {
  const member = describeMember(row.member);

  return {
    id: row.id,
    technicianId: member.id,
    ...(row.member?.user_id ? { userId: row.member.user_id } : {}),
    technicianName: member.name,
    technicianRole: member.role,
    technicianInitials: member.initials,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    daysCount: Number(row.days_count),
    reason: row.reason ?? '',
    // `cancelled` n'existe pas dans le modèle de vue, et lui inventer une
    // couleur serait un choix d'interface pris ici, au mauvais endroit. Une
    // demande retirée se lit comme refusée : dans les deux cas, elle ne
    // consomme rien.
    status: row.status === 'cancelled' ? 'rejected' : row.status,
    requestedAt: row.requested_at,
    ...(row.reviewed_by !== null ? { approvedBy: row.reviewed_by } : {}),
    ...(row.reviewed_at !== null ? { approvedAt: row.reviewed_at } : {}),
  };
}

export function toStaffLeaveBalance(balance: ConsolidatedLeaveBalance): StaffLeaveBalance {
  const member = describeMember(balance.member);

  return {
    technicianId: member.id,
    technicianName: member.name,
    technicianRole: member.role,
    technicianInitials: member.initials,
    paidLeaveRemaining: balance.paidLeaveRemaining,
    paidLeaveAcquired: balance.paidLeaveAcquired,
    rttRemaining: balance.rttRemaining,
    recoveryHours: balance.recoveryHours,
  };
}

const FREQUENCY_LABELS: Record<RecurringTaskWithRefs['frequency'], RecurringTask['frequency']> = {
  weekly: 'weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  bi_annual: 'bi_annual',
  yearly: 'yearly',
};

/** « 90 » minutes devient « 1h30 » : l'écran lit une durée, pas un entier. */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${String(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${String(hours)}h` : `${String(hours)}h${String(rest).padStart(2, '0')}`;
}

export function toRecurringTask(row: RecurringTaskWithRefs): RecurringTask {
  const site = row.site;
  const address = [site?.address_line1, site?.city].filter((part) => part != null).join(', ');

  return {
    id: row.id,
    title: row.title,
    frequency: FREQUENCY_LABELS[row.frequency],
    nextDate: row.next_date,
    clientName: row.customer?.name ?? 'Client non renseigné',
    clientAddress: address !== '' ? address : (site?.name ?? '—'),
    technicianName:
      row.assigned_member === null ? 'Non affecté' : memberDisplayName(row.assigned_member),
    category: row.notes ?? '',
    estimatedDuration: formatDuration(row.estimated_minutes),
  };
}

const PRIORITY_MAP: Record<string, PlanningCalendarEvent['priority']> = {
  low: 'low',
  normal: 'medium',
  high: 'high',
  urgent: 'urgent',
};

/**
 * Le calendrier n'a pas de table : il compose trois sources.
 *
 * Missions planifiées, congés approuvés ou en attente, jours fériés. Créer une
 * table `calendar_events` aurait dupliqué des lignes qui existent déjà — et deux
 * copies d'une même vérité finissent toujours par diverger, celle qu'on
 * n'affiche pas restant fausse le plus longtemps.
 */
export function buildCalendarEvents(params: {
  missions: readonly MissionWithRelations[];
  leaves: readonly LeaveRequestWithMember[];
  holidays: readonly PublicHoliday[];
}): PlanningCalendarEvent[] {
  const events: PlanningCalendarEvent[] = [];

  for (const mission of params.missions) {
    if (mission.scheduled_start === null) continue;

    const member = mission.assigned_member;
    const name = member === null ? undefined : memberDisplayName(member);

    const startTime = new Date(mission.scheduled_start).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const endTime = mission.scheduled_end
      ? new Date(mission.scheduled_end).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : undefined;

    const address =
      [mission.address_line1, mission.postal_code, mission.city]
        .filter((part) => part != null && part !== '')
        .join(' ') ||
      (mission.location_label ?? undefined);

    events.push({
      id: `mission-${mission.id}`,
      missionId: mission.id,
      reference: mission.reference,
      title: mission.title,
      date: mission.scheduled_start.slice(0, 10),
      type: 'intervention',
      status: mission.status,
      priority: PRIORITY_MAP[mission.priority] ?? 'medium',
      clientName: mission.customer?.name ?? mission.customer_name ?? undefined,
      address,
      phone: mission.customer_phone ?? undefined,
      latitude: mission.latitude,
      longitude: mission.longitude,
      startTime,
      endTime,
      time: endTime ? `${startTime} - ${endTime}` : startTime,
      details: mission.customer?.name ?? mission.customer_name ?? undefined,
      ...(mission.scheduled_end !== null ? { endDate: mission.scheduled_end.slice(0, 10) } : {}),
      ...(member !== null ? { technicianId: member.id } : {}),
      ...(name !== undefined ? { technicianName: name, technicianInitials: initialsOf(name) } : {}),
    });
  }

  for (const leave of params.leaves) {
    if (leave.status === 'rejected' || leave.status === 'cancelled') continue;

    const member = describeMember(leave.member);

    events.push({
      id: `leave-${leave.id}`,
      title: `${member.name} — congé`,
      date: leave.start_date,
      endDate: leave.end_date,
      type: 'leave',
      status: leave.status,
      technicianId: member.id,
      technicianName: member.name,
      technicianInitials: member.initials,
      details: `${String(Number(leave.days_count))} jour(s)`,
    });
  }

  for (const entry of params.holidays) {
    events.push({
      id: `holiday-${entry.date}-${entry.name}`,
      title: entry.name,
      date: entry.date,
      type: 'holiday',
      ...(entry.territoryLabel !== undefined ? { details: entry.territoryLabel } : {}),
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
