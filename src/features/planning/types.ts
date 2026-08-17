export type LeaveType =
  | 'paid_leave'
  | 'rtt'
  | 'sick_leave'
  | 'unpaid'
  | 'family'
  | 'recovery';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  technicianId: string;
  technicianName: string;
  technicianRole: string;
  technicianInitials: string;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  reason: string;
  status: LeaveStatus;
  requestedAt: string;
  approvedBy?: string | undefined;
  approvedAt?: string | undefined;
}

export interface StaffLeaveBalance {
  technicianId: string;
  technicianName: string;
  technicianRole: string;
  technicianInitials: string;
  paidLeaveRemaining: number; // in days
  paidLeaveAcquired: number;
  rttRemaining: number;
  recoveryHours: number;
}

export type CalendarEventType = 'intervention' | 'leave' | 'holiday' | 'recurring_task';

export interface PlanningCalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string | undefined;
  type: CalendarEventType;
  technicianId?: string | undefined;
  technicianName?: string | undefined;
  technicianInitials?: string | undefined;
  tradeLabel?: string | undefined;
  trade?: string | undefined;
  time?: string | undefined;
  startTime?: string | undefined;
  endTime?: string | undefined;
  details?: string | undefined;
  status?: string | undefined;
  priority?: ('low' | 'medium' | 'high' | 'urgent') | undefined;
  missionId?: string | undefined;
  reference?: string | undefined;
  clientName?: string | undefined;
  address?: string | undefined;
  phone?: string | undefined;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
}

export interface RecurringTask {
  id: string;
  title: string;
  /** Aligné sur l'enum `recurrence_frequency` : `bi_annual`, pas `bi-annual`. */
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'bi_annual' | 'yearly';
  nextDate: string;
  clientName: string;
  clientAddress: string;
  technicianName: string;
  category: string;
  estimatedDuration: string;
}

export type HolidayTerritory =
  | 'metropole'
  | 'martinique'
  | 'guadeloupe'
  | 'guyane'
  | 'reunion'
  | 'mayotte'
  | 'alsace_moselle';

export interface PublicHoliday {
  date: string;
  name: string;
  isCustom?: boolean | undefined;
  territory?: HolidayTerritory | 'national' | undefined;
  territoryLabel?: string | undefined;
}
