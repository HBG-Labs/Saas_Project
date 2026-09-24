import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import {
  Axe,
  Cable,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Download,
  Filter,
  FlaskConical,
  Hammer,
  List,
  LocateFixed,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Power,
  RotateCcw,
  Scissors,
  Search,
  Server,
  ShieldCheck,
  Sprout,
  Upload,
  UserRound,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { ROUTES } from '@/config/routes';
import { openNavigationApp, type NavigationDestination } from '@/features/geo';
import {
  MISSION_PRIORITY_LABELS,
  MISSION_STATUS_LABELS,
  TERMINAL_STATUSES,
} from '@/features/missions';
import { memberDisplayName } from '@/features/organizations';
import { cn } from '@/lib/cn';
import { selectionFeedback } from '@/lib/mobile-feedback';
import type { MissionPriority, MissionStatus } from '@/types/database';
import type { MemberWithProfile } from '@/types/domain';

import {
  addDaysToDateKey,
  dateKeyToUtcDate,
  monthBounds,
  organizationDateKey,
  startOfIsoWeek,
} from '../date-utils';
import type { LeaveRequest, PlanningCalendarEvent, PublicHoliday } from '../types';

type MobileViewMode = 'day' | 'week' | 'month' | 'list';
type PeriodPreset = 'today' | 'week' | 'month';

interface PlanningFilters {
  period: PeriodPreset;
  technicianIds: string[];
  interventionTypeIds: string[];
  statuses: MissionStatus[];
  priorities: MissionPriority[];
  query: string;
  mineOnly: boolean;
  withAddress: boolean;
}

export interface MobilePlanningViewProps {
  events: PlanningCalendarEvent[];
  leaves: LeaveRequest[];
  holidays: PublicHoliday[];
  members: readonly MemberWithProfile[];
  teamMembersByTeam?: ReadonlyMap<string, readonly MemberWithProfile[]> | undefined;
  ownMemberId?: string | null | undefined;
  ownTeamIds?: readonly string[] | undefined;
  canCreateMission?: boolean | undefined;
  isLoading?: boolean | undefined;
  isError?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  onNewMissionAtDate?: ((dateStr: string) => void) | undefined;
  onVisibleRangeChange?: ((range: { from: string; to: string }) => void) | undefined;
  onOpenLeaves?: (() => void) | undefined;
  onOpenTasks?: (() => void) | undefined;
  onOpenHolidays?: (() => void) | undefined;
  onImportICS?: (() => void) | undefined;
  onExportICS?: (() => void) | undefined;
  canImportICS?: boolean | undefined;
  timeZone?: string | undefined;
}

const VIEW_MODES: readonly { id: MobileViewMode; label: string }[] = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'list', label: 'Liste' },
];

const PRIORITIES: readonly MissionPriority[] = ['low', 'normal', 'high', 'urgent'];
const STATUS_ORDER: readonly MissionStatus[] = [
  'draft',
  'assigned',
  'accepted',
  'in_progress',
  'completed',
  'submitted',
  'approved',
  'rejected',
  'cancelled',
  'closed',
];

const ICONS: Record<string, LucideIcon> = {
  axe: Axe,
  cable: Cable,
  activity: CircleAlert,
  'flask-conical': FlaskConical,
  hammer: Hammer,
  power: Power,
  scissors: Scissors,
  search: Search,
  server: Server,
  'shield-check': ShieldCheck,
  sprout: Sprout,
  wrench: Wrench,
};

const EMPTY_FILTERS: PlanningFilters = {
  period: 'today',
  technicianIds: [],
  interventionTypeIds: [],
  statuses: [],
  priorities: [],
  query: '',
  mineOnly: false,
  withAddress: false,
};

function cloneFilters(filters: PlanningFilters): PlanningFilters {
  return {
    ...filters,
    technicianIds: [...filters.technicianIds],
    interventionTypeIds: [...filters.interventionTypeIds],
    statuses: [...filters.statuses],
    priorities: [...filters.priorities],
  };
}

function formatDate(dateKey: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(
    dateKeyToUtcDate(dateKey),
  );
}

function sentenceCase(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

function fullDate(dateKey: string): string {
  return sentenceCase(
    formatDate(dateKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  );
}

function shortDate(dateKey: string): string {
  return sentenceCase(formatDate(dateKey, { weekday: 'short', day: 'numeric', month: 'short' }));
}

function isMissionStatus(status: PlanningCalendarEvent['status']): status is MissionStatus {
  return typeof status === 'string' && status in MISSION_STATUS_LABELS;
}

function statusDotClass(status: MissionStatus | undefined): string {
  if (status === 'in_progress') return 'bg-primary';
  if (status === 'completed' || status === 'approved' || status === 'closed') return 'bg-success';
  if (status === 'submitted') return 'bg-warning';
  if (status === 'rejected' || status === 'cancelled') return 'bg-error';
  if (status === 'assigned' || status === 'accepted') return 'bg-info';
  return 'bg-muted-foreground';
}

function statusPillClass(status: MissionStatus | undefined): string {
  if (status === 'in_progress') return 'bg-primary-subtle text-primary-700 dark:text-primary-300';
  if (status === 'completed' || status === 'approved' || status === 'closed') {
    return 'bg-success-subtle text-success';
  }
  if (status === 'submitted') return 'bg-warning-subtle text-warning';
  if (status === 'rejected' || status === 'cancelled') return 'bg-error-subtle text-error';
  return 'bg-surface-subtle text-muted-foreground';
}

function validAccent(value: string | null | undefined): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : 'var(--color-primary)';
}

function canNavigate(event: PlanningCalendarEvent): boolean {
  return (event.latitude != null && event.longitude != null) || Boolean(event.address?.trim());
}

function navigationDestination(event: PlanningCalendarEvent): NavigationDestination {
  return {
    ...(event.latitude != null ? { latitude: event.latitude } : {}),
    ...(event.longitude != null ? { longitude: event.longitude } : {}),
    ...(event.address ? { address: event.address } : {}),
    ...(event.siteName ? { label: event.siteName } : {}),
  };
}

function dialHref(phone: string | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized.replace(/\D/g, '').length >= 6 ? `tel:${normalized}` : null;
}

function toggleValue<T extends string>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function rangeForView(view: MobileViewMode, selectedDate: string): { from: string; to: string } {
  if (view === 'day' || view === 'week') {
    const from = startOfIsoWeek(selectedDate);
    return { from, to: addDaysToDateKey(from, 6) };
  }
  const month = monthBounds(selectedDate);
  if (view === 'list') return { from: month.from, to: addDaysToDateKey(month.to, 62) };
  return { from: addDaysToDateKey(month.from, -7), to: addDaysToDateKey(month.to, 7) };
}

function isSameFilter(a: PlanningFilters, b: PlanningFilters): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function MobileMissionCard({
  event,
  teamMembers,
  returnTo,
}: {
  event: PlanningCalendarEvent;
  teamMembers: readonly MemberWithProfile[];
  returnTo: string;
}) {
  const status = isMissionStatus(event.status) ? event.status : undefined;
  const accent = validAccent(event.teamColor);
  const TypeIcon = ICONS[event.interventionTypeIcon ?? ''] ?? Wrench;
  const phoneHref = dialHref(event.phone);
  const destination = navigationDestination(event);
  const assignedTechnicianNames = [
    ...(event.technicianName ? [event.technicianName] : []),
    ...teamMembers
      .filter((member) => member.id !== event.technicianId)
      .map((member) => memberDisplayName(member)),
  ];

  return (
    <article
      className="border-border/70 bg-surface-raised animate-in fade-in slide-in-from-bottom-1 relative overflow-hidden rounded-2xl border shadow-xs duration-200 motion-reduce:animate-none"
      style={{ borderLeftColor: accent, borderLeftWidth: 4 }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045]"
        style={{ backgroundColor: accent }}
        aria-hidden="true"
      />
      <div className="relative grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2.5 p-3">
        <div className="text-foreground border-border/60 border-r pr-2 text-xs font-extrabold tabular-nums">
          <span className="block">{event.startTime ?? '—'}</span>
          {event.endTime ? (
            <span className="text-muted-foreground text-2xs mt-0.5 block font-medium">
              {event.endTime}
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <Link
            to={event.missionId ? ROUTES.mission(event.missionId) : ROUTES.missions}
            state={{ from: returnTo }}
            className="focus-visible:ring-ring -m-1 block rounded-xl p-1 focus-visible:ring-2 focus-visible:outline-none"
            aria-label={`Ouvrir ${event.title}`}
          >
            <div className="flex min-w-0 items-start gap-2">
              <TypeIcon className="mt-0.5 size-4 shrink-0" style={{ color: accent }} aria-hidden />
              <div className="min-w-0 flex-1">
                {event.interventionTypeLabel ? (
                  <p className="text-muted-foreground text-3xs mb-0.5 truncate font-bold tracking-wide uppercase">
                    {event.interventionTypeLabel}
                  </p>
                ) : null}
                <h3 className="text-foreground line-clamp-2 text-sm leading-tight font-extrabold">
                  {event.title || 'Intervention sans intitulé'}
                </h3>
              </div>
              <ChevronRight className="text-muted-foreground mt-1 size-4 shrink-0" aria-hidden />
            </div>

            <div className="text-muted-foreground mt-2 space-y-1 pl-6 text-xs">
              {event.clientName ? (
                <p className="text-foreground truncate font-semibold">{event.clientName}</p>
              ) : null}
              {event.siteName || event.address ? (
                <p className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{event.siteName ?? event.address}</span>
                </p>
              ) : null}
            </div>
          </Link>

          <div className="mt-2 flex min-w-0 items-center gap-2 pl-1">
            <span
              className={cn(
                'text-2xs inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 font-bold',
                statusPillClass(status),
              )}
            >
              <span className={cn('size-1.5 rounded-full', statusDotClass(status))} aria-hidden />
              {status ? MISSION_STATUS_LABELS[status] : 'Statut non renseigné'}
            </span>

            {event.priority && event.priority !== 'normal' ? (
              <span className="text-muted-foreground text-2xs truncate font-semibold">
                {MISSION_PRIORITY_LABELS[event.priority]}
              </span>
            ) : null}

            <span
              className="ml-auto flex shrink-0 -space-x-1.5"
              role="img"
              aria-label={
                assignedTechnicianNames.length > 0
                  ? `Techniciens affectés : ${assignedTechnicianNames.join(', ')}`
                  : 'Aucun technicien affecté'
              }
            >
              {event.technicianName ? (
                <UserAvatar
                  avatarId={event.technicianAvatarId ?? null}
                  name={event.technicianName}
                  size="sm"
                  className="ring-surface-raised ring-2"
                />
              ) : null}
              {teamMembers
                .filter((member) => member.id !== event.technicianId)
                .slice(0, event.technicianName ? 2 : 3)
                .map((member) => (
                  <UserAvatar
                    key={member.id}
                    avatarId={member.profile?.avatar_id ?? null}
                    name={memberDisplayName(member)}
                    size="sm"
                    className="ring-surface-raised ring-2"
                  />
                ))}
              {!event.technicianName && teamMembers.length === 0 ? (
                <span className="bg-surface-subtle text-muted-foreground flex size-6 items-center justify-center rounded-full">
                  <UserRound className="size-3" aria-hidden />
                </span>
              ) : null}
            </span>

            {phoneHref ? (
              <a
                href={phoneHref}
                className="border-border bg-surface hover:bg-surface-hover focus-visible:ring-ring flex size-9 items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`Appeler ${event.clientName ?? 'le client'}`}
              >
                <Phone className="size-3.5" aria-hidden />
              </a>
            ) : null}

            {canNavigate(event) ? (
              <button
                type="button"
                onClick={() => openNavigationApp(destination)}
                className="border-border bg-surface hover:bg-surface-hover focus-visible:ring-ring flex size-9 cursor-pointer items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`Itinéraire vers ${event.siteName ?? event.address ?? event.title}`}
              >
                <Navigation className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function LoadingDay() {
  return (
    <div className="space-y-2" role="status" aria-label="Chargement du planning">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="bg-surface-raised border-border animate-pulse rounded-2xl border p-3 motion-reduce:animate-none"
        >
          <div className="flex gap-3">
            <div className="bg-surface-subtle h-8 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="bg-surface-subtle h-3 w-2/3 rounded" />
              <div className="bg-surface-subtle h-3 w-1/2 rounded" />
              <div className="bg-surface-subtle h-6 w-24 rounded-full" />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

export function MobilePlanningView({
  events,
  leaves,
  holidays,
  members,
  teamMembersByTeam = new Map(),
  ownMemberId = null,
  ownTeamIds = [],
  canCreateMission = true,
  isLoading = false,
  isError = false,
  onRetry,
  onNewMissionAtDate,
  onVisibleRangeChange,
  onOpenLeaves,
  onOpenTasks,
  onOpenHolidays,
  onImportICS,
  onExportICS,
  canImportICS = false,
  timeZone = 'Europe/Paris',
}: MobilePlanningViewProps) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const requestedDate = searchParams.get('date');
  const today = organizationDateKey(new Date(), timeZone);
  const [viewMode, setViewModeState] = useState<MobileViewMode>(
    requestedView === 'week' || requestedView === 'month' || requestedView === 'list'
      ? requestedView
      : 'day',
  );
  const [selectedDate, setSelectedDateState] = useState(
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today,
  );
  const [filters, setFilters] = useState<PlanningFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<PlanningFilters>(EMPTY_FILTERS);
  const [draftPeriodChanged, setDraftPeriodChanged] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listLimit, setListLimit] = useState(50);

  const setUrlState = (date: string, view: MobileViewMode) => {
    const next = new URLSearchParams(searchParams);
    next.set('section', 'agenda');
    next.set('view', view);
    next.set('date', date);
    setSearchParams(next, { replace: true });
  };

  const selectDate = (date: string, forceDay = false) => {
    const nextView = forceDay ? 'day' : viewMode;
    setSelectedDateState(date);
    if (forceDay) setViewModeState('day');
    setUrlState(date, nextView);
    selectionFeedback();
  };

  const setViewMode = (view: MobileViewMode) => {
    setViewModeState(view);
    setUrlState(selectedDate, view);
    selectionFeedback();
  };

  useEffect(() => {
    onVisibleRangeChange?.(rangeForView(viewMode, selectedDate));
  }, [onVisibleRangeChange, selectedDate, viewMode]);

  const missionEvents = useMemo(
    () => events.filter((event) => event.type === 'intervention'),
    [events],
  );

  const typeOptions = useMemo(() => {
    const values = new Map<string, string>();
    for (const event of missionEvents) {
      if (event.interventionTypeId && event.interventionTypeLabel) {
        values.set(event.interventionTypeId, event.interventionTypeLabel);
      }
    }
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  }, [missionEvents]);

  const filteredEvents = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase('fr');
    const ownTeams = new Set(ownTeamIds);
    return missionEvents.filter((event) => {
      if (filters.technicianIds.length > 0) {
        const assignedTeamMembers = event.teamId ? (teamMembersByTeam.get(event.teamId) ?? []) : [];
        const matchesTechnician =
          (event.technicianId !== undefined &&
            filters.technicianIds.includes(event.technicianId)) ||
          assignedTeamMembers.some((member) => filters.technicianIds.includes(member.id));
        if (!matchesTechnician) return false;
      }
      if (
        filters.interventionTypeIds.length > 0 &&
        (!event.interventionTypeId ||
          !filters.interventionTypeIds.includes(event.interventionTypeId))
      ) {
        return false;
      }
      if (
        filters.statuses.length > 0 &&
        (!isMissionStatus(event.status) || !filters.statuses.includes(event.status))
      ) {
        return false;
      }
      if (
        filters.priorities.length > 0 &&
        (!event.priority || !filters.priorities.includes(event.priority))
      ) {
        return false;
      }
      if (
        filters.mineOnly &&
        event.technicianId !== ownMemberId &&
        (!event.teamId || !ownTeams.has(event.teamId))
      ) {
        return false;
      }
      if (filters.withAddress && !event.address?.trim()) return false;
      if (query !== '') {
        const haystack = [
          event.title,
          event.reference,
          event.clientName,
          event.siteName,
          event.address,
          event.technicianName,
          event.interventionTypeLabel,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('fr');
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [filters, missionEvents, ownMemberId, ownTeamIds, teamMembersByTeam]);

  const byDate = useMemo(() => {
    const grouped = new Map<string, PlanningCalendarEvent[]>();
    for (const event of filteredEvents) {
      const existing = grouped.get(event.date);
      if (existing) existing.push(event);
      else grouped.set(event.date, [event]);
    }
    for (const values of grouped.values()) {
      values.sort((a, b) => (a.scheduledStart ?? '').localeCompare(b.scheduledStart ?? ''));
    }
    return grouped;
  }, [filteredEvents]);

  const selectedDayEvents = byDate.get(selectedDate) ?? [];
  const selectedDayLeaves = leaves.filter(
    (leave) =>
      leave.status === 'approved' &&
      selectedDate >= leave.startDate &&
      selectedDate <= leave.endDate,
  );
  const selectedDayHolidays = holidays.filter((holiday) => holiday.date === selectedDate);
  const weekStart = startOfIsoWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDaysToDateKey(weekStart, index));

  const month = monthBounds(selectedDate);
  const firstDayOffset = (dateKeyToUtcDate(month.from).getUTCDay() + 6) % 7;
  const monthGridStart = addDaysToDateKey(month.from, -firstDayOffset);
  const monthDays = Array.from({ length: 42 }, (_, index) =>
    addDaysToDateKey(monthGridStart, index),
  );

  const listEvents = filteredEvents
    .filter((event) => event.date >= selectedDate)
    .slice(0, listLimit);

  const activeFilterCount =
    filters.technicianIds.length +
    filters.interventionTypeIds.length +
    filters.statuses.length +
    filters.priorities.length +
    (filters.query ? 1 : 0) +
    (filters.mineOnly ? 1 : 0) +
    (filters.withAddress ? 1 : 0);

  const openFilters = () => {
    setDraftFilters(cloneFilters(filters));
    setDraftPeriodChanged(false);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setFilters(cloneFilters(draftFilters));
    if (draftPeriodChanged) {
      if (draftFilters.period === 'today') {
        selectDate(today, true);
      } else if (draftFilters.period === 'week') {
        setViewMode('week');
      } else {
        setViewMode('month');
      }
    }
    setFiltersOpen(false);
  };

  const resetFilters = () => {
    setDraftFilters(cloneFilters(EMPTY_FILTERS));
    setFilters(cloneFilters(EMPTY_FILTERS));
    setDraftPeriodChanged(false);
  };

  const nextNavigable = selectedDayEvents.find(
    (event) =>
      canNavigate(event) &&
      (!isMissionStatus(event.status) || !TERMINAL_STATUSES.includes(event.status)),
  );
  const returnTo = `${location.pathname}${location.search}`;

  const renderCard = (event: PlanningCalendarEvent) => (
    <MobileMissionCard
      key={event.id}
      event={event}
      teamMembers={event.teamId ? (teamMembersByTeam.get(event.teamId) ?? []) : []}
      returnTo={returnTo}
    />
  );

  return (
    <div className="gestion-calendar space-y-3 md:hidden">
      <div
        className="no-scrollbar -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1"
        aria-label="Choisir un jour"
      >
        {weekDays.map((date) => {
          const active = date === selectedDate;
          const hasEvents = (byDate.get(date)?.length ?? 0) > 0;
          return (
            <button
              key={date}
              type="button"
              onClick={() => selectDate(date)}
              aria-pressed={active}
              aria-label={fullDate(date)}
              className={cn(
                'focus-visible:ring-ring relative flex min-h-14 min-w-11 flex-1 cursor-pointer snap-start flex-col items-center justify-center rounded-xl px-2 text-xs transition-[background-color,color,transform,box-shadow] duration-200 focus-visible:ring-2 focus-visible:outline-none active:scale-95 motion-reduce:transition-none',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-surface-hover',
              )}
            >
              <span className="text-3xs font-bold uppercase">
                {formatDate(date, { weekday: 'short' }).replace('.', '')}
              </span>
              <span className="mt-0.5 text-sm font-extrabold tabular-nums">
                {dateKeyToUtcDate(date).getUTCDate()}
              </span>
              {hasEvents ? (
                <span
                  className={cn(
                    'absolute bottom-1 size-1 rounded-full',
                    active ? 'bg-primary-foreground' : 'bg-primary',
                  )}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <div className="bg-surface-subtle grid min-w-0 flex-1 grid-cols-4 rounded-xl p-1">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setViewMode(mode.id)}
              aria-pressed={viewMode === mode.id}
              className={cn(
                'focus-visible:ring-ring text-2xs min-h-9 cursor-pointer rounded-lg px-1.5 font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none',
                viewMode === mode.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={openFilters}
          className={cn(
            'border-border focus-visible:ring-ring size-touch relative flex shrink-0 cursor-pointer items-center justify-center rounded-xl border focus-visible:ring-2 focus-visible:outline-none',
            activeFilterCount > 0 ? 'bg-primary-subtle text-primary' : 'bg-surface text-foreground',
          )}
          aria-label={
            activeFilterCount ? `Filtres, ${activeFilterCount} actifs` : 'Ouvrir les filtres'
          }
        >
          <Filter className="size-4" aria-hidden />
          {activeFilterCount > 0 ? (
            <span className="bg-primary text-primary-foreground text-3xs absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full font-extrabold">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {isLoading ? <LoadingDay /> : null}
      {isError && !isLoading ? (
        <div className="border-error-border bg-error-subtle rounded-2xl border p-4 text-center">
          <CircleAlert className="text-error mx-auto size-5" aria-hidden />
          <p className="text-foreground mt-2 text-sm font-bold">
            Le planning n’a pas pu être chargé.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Vérifiez votre connexion puis réessayez.
          </p>
          {onRetry ? (
            <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>
              Réessayer
            </Button>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !isError && viewMode === 'day' ? (
        <section aria-labelledby="mobile-day-title" className="space-y-2.5">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2
              id="mobile-day-title"
              className="text-foreground text-base font-extrabold tracking-tight"
            >
              {fullDate(selectedDate)}
            </h2>
            {selectedDate !== today ? (
              <button
                type="button"
                onClick={() => selectDate(today)}
                className="text-primary min-h-8 shrink-0 cursor-pointer text-xs font-bold"
              >
                Aujourd’hui
              </button>
            ) : null}
          </div>

          {selectedDayHolidays.map((holiday) => (
            <div
              key={`${holiday.date}-${holiday.name}`}
              className="bg-warning-subtle text-warning rounded-xl px-3 py-2 text-xs font-semibold"
            >
              {holiday.name}
            </div>
          ))}
          {selectedDayLeaves.length > 0 ? (
            <div className="bg-surface-subtle text-muted-foreground flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
              <UsersRound className="size-4" aria-hidden />
              {selectedDayLeaves.length} absence{selectedDayLeaves.length > 1 ? 's' : ''} d’équipe
            </div>
          ) : null}

          {selectedDayEvents.length > 0 ? (
            <div className="space-y-2">{selectedDayEvents.map(renderCard)}</div>
          ) : (
            <div className="border-border bg-surface-raised rounded-2xl border px-5 py-8 text-center shadow-xs">
              <CalendarDays className="text-primary mx-auto size-7" aria-hidden />
              <h3 className="text-foreground mt-3 text-sm font-extrabold">
                {activeFilterCount > 0
                  ? 'Aucun résultat avec ces filtres'
                  : 'Aucune intervention aujourd’hui'}
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                {activeFilterCount > 0
                  ? 'Modifiez ou réinitialisez les filtres.'
                  : 'Votre journée est libre.'}
              </p>
              {activeFilterCount > 0 ? (
                <Button size="sm" variant="outline" className="mt-4" onClick={resetFilters}>
                  Réinitialiser
                </Button>
              ) : canCreateMission ? (
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => onNewMissionAtDate?.(selectedDate)}
                >
                  <Plus className="size-4" aria-hidden /> Planifier une intervention
                </Button>
              ) : null}
            </div>
          )}

          <div className="grid grid-cols-4 gap-1.5 pt-1" aria-label="Actions rapides">
            {canCreateMission ? (
              <button
                type="button"
                onClick={() => onNewMissionAtDate?.(selectedDate)}
                className="border-border bg-surface-raised focus-visible:ring-ring text-2xs flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border font-bold focus-visible:ring-2 focus-visible:outline-none"
              >
                <Plus className="text-primary size-4" aria-hidden /> Ajouter
              </button>
            ) : null}
            <button
              type="button"
              disabled={!nextNavigable}
              onClick={() =>
                nextNavigable && openNavigationApp(navigationDestination(nextNavigable))
              }
              className="border-border bg-surface-raised focus-visible:ring-ring text-2xs flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border font-bold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Navigation className="text-primary size-4" aria-hidden /> Itinéraire
            </button>
            <Link
              to={`${ROUTES.map}?locate=1`}
              className="border-border bg-surface-raised focus-visible:ring-ring text-2xs flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border font-bold focus-visible:ring-2 focus-visible:outline-none"
            >
              <LocateFixed className="text-primary size-4" aria-hidden /> Ma position
            </Link>
            <button
              type="button"
              onClick={openFilters}
              className="border-border bg-surface-raised focus-visible:ring-ring text-2xs flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border font-bold focus-visible:ring-2 focus-visible:outline-none"
            >
              <Filter className="text-primary size-4" aria-hidden /> Filtrer
            </button>
          </div>

          <div className="border-border bg-surface-raised rounded-2xl border p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-foreground text-sm font-extrabold">Interventions du jour</h3>
                <p className="text-muted-foreground text-xs">
                  {selectedDayEvents.length} intervention{selectedDayEvents.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div
                className="border-primary/20 text-primary flex size-12 items-center justify-center rounded-full border-[5px] text-base font-extrabold"
                aria-hidden
              >
                {selectedDayEvents.length}
              </div>
            </div>
            {selectedDayEvents.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {STATUS_ORDER.map((status) => {
                  const count = selectedDayEvents.filter((event) => event.status === status).length;
                  if (count === 0) return null;
                  return (
                    <p
                      key={status}
                      className="text-muted-foreground text-2xs flex items-center gap-1.5"
                    >
                      <span
                        className={cn('size-1.5 rounded-full', statusDotClass(status))}
                        aria-hidden
                      />
                      <span className="font-bold tabular-nums">{count}</span>{' '}
                      {MISSION_STATUS_LABELS[status]}
                    </p>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {!isLoading && !isError && viewMode === 'week' ? (
        <section className="space-y-2" aria-labelledby="mobile-week-title">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => selectDate(addDaysToDateKey(selectedDate, -7))}
              className="border-border size-touch flex cursor-pointer items-center justify-center rounded-xl border"
              aria-label="Semaine précédente"
            >
              <ChevronLeft className="size-4" />
            </button>
            <h2 id="mobile-week-title" className="text-sm font-extrabold">
              {formatDate(weekDays[0] ?? selectedDate, { day: 'numeric', month: 'short' })} –{' '}
              {formatDate(weekDays[6] ?? selectedDate, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </h2>
            <button
              type="button"
              onClick={() => selectDate(addDaysToDateKey(selectedDate, 7))}
              className="border-border size-touch flex cursor-pointer items-center justify-center rounded-xl border"
              aria-label="Semaine suivante"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          {weekDays.map((date) => {
            const items = byDate.get(date) ?? [];
            return (
              <button
                key={date}
                type="button"
                onClick={() => selectDate(date, true)}
                className={cn(
                  'border-border bg-surface-raised focus-visible:ring-ring grid min-h-16 w-full cursor-pointer grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border px-3 py-2 text-left focus-visible:ring-2 focus-visible:outline-none',
                  date === today && 'border-primary/40',
                )}
              >
                <span className="text-foreground text-xs font-extrabold">{shortDate(date)}</span>
                <span className="min-w-0 space-y-1">
                  {items.length === 0 ? (
                    <span className="text-muted-foreground text-xs">Journée libre</span>
                  ) : (
                    items.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className="text-foreground flex min-w-0 items-center gap-1.5 text-xs"
                      >
                        <span
                          className={cn(
                            'size-1.5 shrink-0 rounded-full',
                            statusDotClass(
                              isMissionStatus(event.status) ? event.status : undefined,
                            ),
                          )}
                        />
                        <span className="truncate">
                          {event.startTime} · {event.title}
                        </span>
                      </span>
                    ))
                  )}
                  {items.length > 2 ? (
                    <span className="text-muted-foreground text-2xs block">
                      + {items.length - 2} autre{items.length - 2 > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </span>
                <span className="bg-primary-subtle text-primary flex size-7 items-center justify-center rounded-full text-xs font-extrabold">
                  {items.length}
                </span>
              </button>
            );
          })}
        </section>
      ) : null}

      {!isLoading && !isError && viewMode === 'month' ? (
        <section className="space-y-3" aria-labelledby="mobile-month-title">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => selectDate(addDaysToDateKey(month.from, -1))}
              className="border-border size-touch flex cursor-pointer items-center justify-center rounded-xl border"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="size-4" />
            </button>
            <h2 id="mobile-month-title" className="text-sm font-extrabold">
              {sentenceCase(formatDate(selectedDate, { month: 'long', year: 'numeric' }))}
            </h2>
            <button
              type="button"
              onClick={() => selectDate(addDaysToDateKey(month.to, 1))}
              className="border-border size-touch flex cursor-pointer items-center justify-center rounded-xl border"
              aria-label="Mois suivant"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="border-border bg-surface-raised overflow-hidden rounded-2xl border p-2 shadow-xs">
            <div className="grid grid-cols-7 text-center">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, index) => (
                <span
                  key={`${label}-${index}`}
                  className="text-muted-foreground text-3xs py-1 font-bold"
                  aria-hidden
                >
                  {label}
                </span>
              ))}
              {monthDays.map((date) => {
                const count = byDate.get(date)?.length ?? 0;
                const inMonth = date >= month.from && date <= month.to;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => selectDate(date, true)}
                    aria-label={`${fullDate(date)}, ${count} intervention${count !== 1 ? 's' : ''}`}
                    className={cn(
                      'focus-visible:ring-ring relative flex aspect-square min-h-10 cursor-pointer flex-col items-center justify-center rounded-xl text-xs font-bold focus-visible:ring-2 focus-visible:outline-none',
                      !inMonth && 'text-muted-foreground/45',
                      date === today && 'ring-primary/30 ring-1',
                      date === selectedDate && 'bg-primary text-primary-foreground',
                    )}
                  >
                    {dateKeyToUtcDate(date).getUTCDate()}
                    {count > 0 ? (
                      <span
                        className={cn(
                          'mt-0.5 size-1 rounded-full',
                          date === selectedDate ? 'bg-primary-foreground' : 'bg-primary',
                        )}
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {!isLoading && !isError && viewMode === 'list' ? (
        <section className="space-y-2.5" aria-labelledby="mobile-list-title">
          <div className="flex items-center justify-between px-1">
            <h2 id="mobile-list-title" className="text-base font-extrabold">
              Prochaines interventions
            </h2>
            <span className="text-muted-foreground text-xs">
              {filteredEvents.filter((event) => event.date >= selectedDate).length}
            </span>
          </div>
          {listEvents.length > 0 ? (
            <div className="space-y-3">
              {listEvents.map((event, index) => (
                <div key={event.id}>
                  {index === 0 || listEvents[index - 1]?.date !== event.date ? (
                    <p className="text-muted-foreground mb-1.5 px-1 text-xs font-bold">
                      {fullDate(event.date)}
                    </p>
                  ) : null}
                  {renderCard(event)}
                </div>
              ))}
              {listLimit < filteredEvents.filter((event) => event.date >= selectedDate).length ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setListLimit((value) => value + 50)}
                >
                  Afficher 50 de plus
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="border-border bg-surface-raised rounded-2xl border p-8 text-center">
              <List className="text-primary mx-auto size-6" />
              <p className="mt-2 text-sm font-bold">Aucune intervention à venir</p>
            </div>
          )}
        </section>
      ) : null}

      <section
        className="border-border bg-surface-raised overflow-hidden rounded-2xl border shadow-xs"
        aria-labelledby="mobile-plannings-title"
      >
        <div className="flex items-center justify-between px-3.5 py-3">
          <h2 id="mobile-plannings-title" className="text-sm font-extrabold">
            Mes plannings
          </h2>
          <ChevronDown className="text-muted-foreground size-4" aria-hidden />
        </div>
        <div className="border-border divide-border divide-y border-t">
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className="hover:bg-surface-hover min-h-touch flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left"
          >
            <CalendarDays className="text-primary size-4" />
            <span className="flex-1">
              <span className="text-foreground block text-xs font-bold">Agenda</span>
              <span className="text-muted-foreground text-2xs block">Interventions</span>
            </span>
            <Check className="text-primary size-4" />
          </button>
          <button
            type="button"
            onClick={onOpenLeaves}
            className="hover:bg-surface-hover min-h-touch flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left"
          >
            <UsersRound className="text-warning size-4" />
            <span className="flex-1">
              <span className="text-foreground block text-xs font-bold">Congés</span>
              <span className="text-muted-foreground text-2xs block">Absences d’équipe</span>
            </span>
            <ChevronRight className="text-muted-foreground size-4" />
          </button>
          <button
            type="button"
            onClick={onOpenTasks}
            className="hover:bg-surface-hover min-h-touch flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left"
          >
            <RotateCcw className="text-info size-4" />
            <span className="flex-1">
              <span className="text-foreground block text-xs font-bold">Tâches</span>
              <span className="text-muted-foreground text-2xs block">Tâches récurrentes</span>
            </span>
            <ChevronRight className="text-muted-foreground size-4" />
          </button>
          <button
            type="button"
            onClick={onOpenHolidays}
            className="hover:bg-surface-hover min-h-touch flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left"
          >
            <ClipboardList className="text-success size-4" />
            <span className="flex-1">
              <span className="text-foreground block text-xs font-bold">Jours fériés</span>
              <span className="text-muted-foreground text-2xs block">Calendrier officiel</span>
            </span>
            <ChevronRight className="text-muted-foreground size-4" />
          </button>
          <div className="grid grid-cols-2">
            {canImportICS ? (
              <button
                type="button"
                onClick={onImportICS}
                className="hover:bg-surface-hover min-h-touch flex cursor-pointer items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold"
              >
                <Upload className="size-4" /> Importer .ics
              </button>
            ) : null}
            <button
              type="button"
              onClick={onExportICS}
              className="hover:bg-surface-hover min-h-touch flex cursor-pointer items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold"
            >
              <Download className="size-4" /> Exporter .ics
            </button>
          </div>
        </div>
      </section>

      <Modal
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filtres"
        description="Affinez le planning sans perdre votre journée sélectionnée."
        footer={
          <>
            <Button variant="outline" onClick={resetFilters}>
              Réinitialiser
            </Button>
            <Button
              onClick={applyFilters}
              disabled={!draftPeriodChanged && isSameFilter(filters, draftFilters)}
            >
              Appliquer
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <fieldset>
            <legend className="text-foreground mb-2 text-xs font-extrabold">Période</legend>
            <div className="bg-surface-subtle grid grid-cols-3 rounded-xl p-1">
              {(
                [
                  ['today', 'Aujourd’hui'],
                  ['week', 'Cette semaine'],
                  ['month', 'Ce mois'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setDraftFilters((current) => ({ ...current, period: value }));
                    setDraftPeriodChanged(true);
                  }}
                  aria-pressed={draftFilters.period === value}
                  className={cn(
                    'text-2xs min-h-10 cursor-pointer rounded-lg px-2 font-bold',
                    draftFilters.period === value
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-foreground mb-2 block text-xs font-extrabold">
              Client / site / intervention
            </span>
            <span className="border-border bg-surface min-h-touch flex items-center gap-2 rounded-xl border px-3">
              <Search className="text-muted-foreground size-4" aria-hidden />
              <input
                value={draftFilters.query}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, query: event.target.value }))
                }
                placeholder="Rechercher…"
                className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </span>
          </label>

          <fieldset>
            <legend className="text-foreground mb-2 text-xs font-extrabold">Techniciens</legend>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setDraftFilters((current) => ({ ...current, technicianIds: [] }))}
                aria-pressed={draftFilters.technicianIds.length === 0}
                className={cn(
                  'border-border min-h-touch flex shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold',
                  draftFilters.technicianIds.length === 0 &&
                    'border-primary bg-primary-subtle text-primary',
                )}
              >
                <UsersRound className="size-4" aria-hidden /> Tous
              </button>
              {members.map((member) => {
                const selected = draftFilters.technicianIds.includes(member.id);
                const name = memberDisplayName(member);
                return (
                  <button
                    key={member.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setDraftFilters((current) => ({
                        ...current,
                        technicianIds: toggleValue(current.technicianIds, member.id),
                      }))
                    }
                    className={cn(
                      'border-border min-h-touch flex shrink-0 items-center gap-2 rounded-full border px-2.5 text-xs font-bold',
                      selected && 'border-primary bg-primary-subtle text-primary',
                    )}
                  >
                    <span aria-hidden>
                      <UserAvatar
                        avatarId={member.profile?.avatar_id ?? null}
                        name={name}
                        size="sm"
                      />
                    </span>
                    {name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {typeOptions.length > 0 ? (
            <fieldset>
              <legend className="text-foreground mb-2 text-xs font-extrabold">
                Type d’intervention
              </legend>
              <div className="grid gap-1.5">
                {typeOptions.map(([id, label]) => (
                  <label
                    key={id}
                    className="hover:bg-surface-hover min-h-touch flex cursor-pointer items-center gap-3 rounded-xl px-2"
                  >
                    <input
                      type="checkbox"
                      checked={draftFilters.interventionTypeIds.includes(id)}
                      onChange={() =>
                        setDraftFilters((current) => ({
                          ...current,
                          interventionTypeIds: toggleValue(current.interventionTypeIds, id),
                        }))
                      }
                      className="accent-primary size-4"
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset>
            <legend className="text-foreground mb-2 text-xs font-extrabold">Statuts</legend>
            <div className="grid grid-cols-2 gap-1">
              {STATUS_ORDER.map((status) => (
                <label
                  key={status}
                  className="hover:bg-surface-hover min-h-touch flex cursor-pointer items-center gap-2 rounded-xl px-2"
                >
                  <input
                    type="checkbox"
                    checked={draftFilters.statuses.includes(status)}
                    onChange={() =>
                      setDraftFilters((current) => ({
                        ...current,
                        statuses: toggleValue(current.statuses, status),
                      }))
                    }
                    className="accent-primary size-4"
                  />
                  <span className={cn('size-1.5 rounded-full', statusDotClass(status))} />
                  <span className="text-xs font-medium">{MISSION_STATUS_LABELS[status]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-foreground mb-2 text-xs font-extrabold">Priorité</legend>
            <div className="grid grid-cols-2 gap-1">
              {PRIORITIES.map((priority) => (
                <label
                  key={priority}
                  className="hover:bg-surface-hover min-h-touch flex cursor-pointer items-center gap-2 rounded-xl px-2"
                >
                  <input
                    type="checkbox"
                    checked={draftFilters.priorities.includes(priority)}
                    onChange={() =>
                      setDraftFilters((current) => ({
                        ...current,
                        priorities: toggleValue(current.priorities, priority),
                      }))
                    }
                    className="accent-primary size-4"
                  />
                  <span className="text-xs font-medium">{MISSION_PRIORITY_LABELS[priority]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-foreground mb-2 text-xs font-extrabold">Autres</legend>
            <div className="space-y-1">
              {ownMemberId ? (
                <label className="hover:bg-surface-hover min-h-touch flex cursor-pointer items-center justify-between rounded-xl px-2">
                  <span className="text-sm font-medium">Mes interventions uniquement</span>
                  <input
                    type="checkbox"
                    checked={draftFilters.mineOnly}
                    onChange={(event) =>
                      setDraftFilters((current) => ({ ...current, mineOnly: event.target.checked }))
                    }
                    className="accent-primary size-4"
                  />
                </label>
              ) : null}
              <label className="hover:bg-surface-hover min-h-touch flex cursor-pointer items-center justify-between rounded-xl px-2">
                <span className="text-sm font-medium">Avec adresse</span>
                <input
                  type="checkbox"
                  checked={draftFilters.withAddress}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      withAddress: event.target.checked,
                    }))
                  }
                  className="accent-primary size-4"
                />
              </label>
            </div>
          </fieldset>
        </div>
      </Modal>
    </div>
  );
}
