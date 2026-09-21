import { SelectField } from '@/components/ui/SelectField';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  Palmtree,
  Phone,
  Plus,
  Search,
  User,
  Wrench,
  CalendarDays,
  ListFilter,
  Eye,
  Flag,
  CalendarRange,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/config/routes';
import { openNavigationApp } from '@/features/geo';
import { memberDisplayName } from '@/features/organizations';
import { activateOnKey } from '@/lib/activate-on-key';
import { cn } from '@/lib/cn';
import type { MemberWithProfile } from '@/types/domain';
import type { LeaveRequest, PlanningCalendarEvent, PublicHoliday } from '../types';

export interface PlanningCalendarViewProps {
  events: PlanningCalendarEvent[];
  leaves: LeaveRequest[];
  holidays: PublicHoliday[];
  members?: readonly MemberWithProfile[];
  canCreateMission?: boolean;
  onNewMissionAtDate?: (dateStr: string) => void;
}

type CalendarViewMode = 'month' | 'week' | 'list';
type ActivityTypeFilter = 'all' | 'intervention' | 'leave' | 'holiday';

const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const DAYS_SHORT_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_FULL_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/** Formate une date YYYY-MM-DD en texte lisible (ex: "Lundi 17 Août 2026") */
function formatFullDateFR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  const dayIndex = (d.getDay() + 6) % 7;
  return `${DAYS_FULL_FR[dayIndex]} ${day} ${MONTHS_FR[month - 1]} ${year}`;
}

/**
 * Évite qu'un intitulé vide ou uniquement numérique soit confondu avec
 * le compteur d'activités affiché dans les cellules du calendrier.
 */
function getEventDisplayTitle(event: PlanningCalendarEvent): string {
  const title = event.title.trim();

  if (title && !/^\d+(?:[.,]\d+)?$/.test(title)) return title;

  return event.type === 'recurring_task' ? 'Tâche sans intitulé' : 'Intervention sans intitulé';
}

/** Calcule le numéro de semaine ISO */
function getWeekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export function PlanningCalendarView({
  events,
  leaves,
  holidays,
  members = [],
  canCreateMission = true,
  onNewMissionAtDate,
}: PlanningCalendarViewProps) {
  // Vue active (Mois par défaut)
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() =>
    window.matchMedia('(max-width: 639px)').matches ? 'list' : 'month',
  );

  // Date de référence (initialisée sur la date du jour réelle)
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // Filtres
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [activityTypeFilter, setActivityTypeFilter] = useState<ActivityTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Jour sélectionné pour la vue détaillée (Modal / Drawer)
  const [detailDay, setDetailDay] = useState<string | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonthIndex = currentDate.getMonth();

  // Navigation temporelle
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentYear, currentMonthIndex - 1, 1));
    } else if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() - 7);
      setCurrentDate(next);
    } else {
      setCurrentDate(new Date(currentYear, currentMonthIndex - 1, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentYear, currentMonthIndex + 1, 1));
    } else if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      setCurrentDate(next);
    } else {
      setCurrentDate(new Date(currentYear, currentMonthIndex + 1, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // 1. Filtrage global des événements
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // Filtre technicien
      if (selectedTechFilter !== 'all' && e.technicianId !== selectedTechFilter) {
        return false;
      }

      // Filtre type d'activité
      if (activityTypeFilter !== 'all' && e.type !== activityTypeFilter) {
        return false;
      }

      // Filtre recherche textuelle
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = e.title.toLowerCase().includes(q);
        const matchesClient = e.clientName?.toLowerCase().includes(q) ?? false;
        const matchesTech = e.technicianName?.toLowerCase().includes(q) ?? false;
        const matchesRef = e.reference?.toLowerCase().includes(q) ?? false;
        const matchesAddress = e.address?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesClient && !matchesTech && !matchesRef && !matchesAddress) {
          return false;
        }
      }

      return true;
    });
  }, [events, selectedTechFilter, activityTypeFilter, searchQuery]);

  // Filtrage des congés
  const filteredLeaves = useMemo(() => {
    if (activityTypeFilter === 'intervention' || activityTypeFilter === 'holiday') return [];
    return leaves.filter((l) => {
      if (l.status !== 'approved') return false;
      if (selectedTechFilter !== 'all' && l.technicianId !== selectedTechFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        return l.technicianName.toLowerCase().includes(q) || l.reason.toLowerCase().includes(q);
      }
      return true;
    });
  }, [leaves, selectedTechFilter, activityTypeFilter, searchQuery]);

  // Filtrage des jours fériés
  const filteredHolidays = useMemo(() => {
    if (activityTypeFilter === 'intervention' || activityTypeFilter === 'leave') return [];
    if (selectedTechFilter !== 'all') return [];
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      return holidays.filter((h) => h.name.toLowerCase().includes(q));
    }
    return holidays;
  }, [holidays, activityTypeFilter, selectedTechFilter, searchQuery]);

  // Helper pour récupérer toutes les activités d'un jour précis.
  //
  // `useCallback` et non une fonction nue : le `useMemo` du calendrier
  // l'appelle pour chaque jour affiché. Recréée à chaque rendu, elle ne pouvait
  // pas figurer dans ses dépendances sans invalider le calcul en permanence —
  // d'où l'avertissement, et un recalcul complet de la grille à chaque frappe
  // dans la recherche.
  const getActivitiesForDay = useCallback(
    (dateStr: string) => {
      const dayEvents = filteredEvents.filter(
        (e) => e.date === dateStr && e.type !== 'holiday' && e.type !== 'leave',
      );
      const dayHolidays = filteredHolidays.filter((h) => h.date === dateStr);
      const dayLeaves = filteredLeaves.filter(
        (l) => dateStr >= l.startDate && dateStr <= l.endDate,
      );

      return {
        events: dayEvents,
        holidays: dayHolidays,
        leaves: dayLeaves,
        totalCount: dayEvents.length + dayHolidays.length + dayLeaves.length,
      };
    },
    [filteredEvents, filteredHolidays, filteredLeaves],
  );

  // 2. Calcul des jours pour la vue Mois
  const monthDaysGrid = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonthIndex, 1);
    const lastDay = new Date(currentYear, currentMonthIndex + 1, 0);

    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Lundi = 0
    const totalMonthDays = lastDay.getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Jours du mois précédent
    const prevMonthLastDate = new Date(currentYear, currentMonthIndex, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDate - i;
      const prevM = currentMonthIndex === 0 ? 12 : currentMonthIndex;
      const prevY = currentMonthIndex === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: day, isCurrentMonth: false });
    }

    // Jours du mois courant
    for (let day = 1; day <= totalMonthDays; day++) {
      const dateStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(
        day,
      ).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: day, isCurrentMonth: true });
    }

    // Jours du mois suivant pour compléter la grille à un multiple de 7
    const remaining = (7 - (days.length % 7)) % 7;
    const targetLength = days.length + (remaining === 0 && days.length < 35 ? 7 : remaining);
    const missing = targetLength - days.length;

    for (let day = 1; day <= missing; day++) {
      const nextM = currentMonthIndex === 11 ? 1 : currentMonthIndex + 2;
      const nextY = currentMonthIndex === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: day, isCurrentMonth: false });
    }

    return days;
  }, [currentYear, currentMonthIndex]);

  // 3. Calcul des jours pour la vue Semaine
  const weekDays = useMemo(() => {
    const ref = new Date(currentDate);
    const dayOfWeek = (ref.getDay() + 6) % 7; // Lundi = 0
    const monday = new Date(ref);
    monday.setDate(ref.getDate() - dayOfWeek);

    const days: { dateStr: string; dayNum: number; dayName: string; date: Date }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      days.push({
        dateStr,
        dayNum: d.getDate(),
        dayName: DAYS_FULL_FR[i] ?? '',
        date: d,
      });
    }
    return days;
  }, [currentDate]);

  // 4. Calcul des jours avec activités pour la vue Agenda / Liste
  const agendaGroupedDays = useMemo(() => {
    const datesSet = new Set<string>();

    filteredEvents.forEach((e) => {
      if (e.date.startsWith(`${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`)) {
        datesSet.add(e.date);
      }
    });

    filteredHolidays.forEach((h) => {
      if (h.date.startsWith(`${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`)) {
        datesSet.add(h.date);
      }
    });

    filteredLeaves.forEach((l) => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        if (
          dateStr.startsWith(`${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`)
        ) {
          datesSet.add(dateStr);
        }
      }
    });

    const sortedDates = Array.from(datesSet).sort();

    return sortedDates.map((dateStr) => ({
      dateStr,
      ...getActivitiesForDay(dateStr),
    }));
  }, [
    filteredEvents,
    filteredHolidays,
    filteredLeaves,
    currentYear,
    currentMonthIndex,
    getActivitiesForDay,
  ]);

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Titre dynamique de la période
  const periodTitle = useMemo(() => {
    if (viewMode === 'month') {
      return `${MONTHS_FR[currentMonthIndex]} ${currentYear}`;
    }
    if (viewMode === 'week') {
      const first = weekDays[0];
      const last = weekDays[6];
      const weekNum = getWeekNumber(currentDate);
      if (first && last) {
        return `Semaine ${weekNum} • ${first.dayNum} - ${last.dayNum} ${MONTHS_FR[last.date.getMonth()]} ${last.date.getFullYear()}`;
      }
      return `Semaine ${weekNum} • ${currentYear}`;
    }
    return `${MONTHS_FR[currentMonthIndex]} ${currentYear}`;
  }, [viewMode, currentMonthIndex, currentYear, weekDays, currentDate]);

  // Compteurs globaux pour la légende
  const totalMissionsCount = filteredEvents.filter((e) => e.type === 'intervention').length;
  const totalLeavesCount = filteredLeaves.length;
  const totalHolidaysCount = filteredHolidays.length;

  return (
    <div className="gestion-calendar space-y-4">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER TOOLBAR (Navigation, Vues, Filtres)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border-border space-y-3 rounded-lg border p-3.5 sm:p-4">
        {/* Ligne Supérieure : Navigation + Switcher de Vues */}
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          {/* Navigation Date */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-surface-subtle border-border flex items-center rounded-lg border p-1">
              <button
                type="button"
                onClick={handlePrev}
                className="size-touch text-muted-foreground hover:text-foreground hover:bg-surface flex cursor-pointer items-center justify-center rounded-lg transition-colors sm:size-auto sm:p-1.5"
                title="Période précédente"
                aria-label="Période précédente"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="size-touch text-muted-foreground hover:text-foreground hover:bg-surface flex cursor-pointer items-center justify-center rounded-lg transition-colors sm:size-auto sm:p-1.5"
                title="Période suivante"
                aria-label="Période suivante"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <h2 className="text-foreground min-w-[200px] text-base font-extrabold tracking-tight sm:text-lg">
              {periodTitle}
            </h2>

            <Button
              size="sm"
              variant="outline"
              onClick={handleToday}
              className="h-8 cursor-pointer text-xs font-semibold"
            >
              Aujourd'hui
            </Button>
          </div>

          {/* Switcher de Vues (Mois / Semaine / Agenda) */}
          <div className="bg-surface-subtle border-border flex items-center self-start rounded-lg border p-1 sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              aria-pressed={viewMode === 'month'}
              className={cn(
                'min-h-touch flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all sm:min-h-0',
                viewMode === 'month'
                  ? 'bg-nav-selected text-nav-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface',
              )}
            >
              <CalendarIcon className="size-3.5" />
              <span>Mois</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('week')}
              aria-pressed={viewMode === 'week'}
              className={cn(
                'min-h-touch flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all sm:min-h-0',
                viewMode === 'week'
                  ? 'bg-nav-selected text-nav-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface',
              )}
            >
              <CalendarDays className="size-3.5" />
              <span>Semaine</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={cn(
                'min-h-touch flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all sm:min-h-0',
                viewMode === 'list'
                  ? 'bg-nav-selected text-nav-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface',
              )}
            >
              <ListFilter className="size-3.5" />
              <span>Agenda</span>
            </button>
          </div>
        </div>

        {/* Ligne Inférieure : Filtres (Recherche, Technicien, Type) */}
        <div className="border-border/60 flex flex-col flex-wrap items-stretch justify-between gap-2.5 border-t pt-2 sm:flex-row sm:items-center">
          {/* Recherche rapide */}
          <div className="relative w-full min-w-0 flex-1 sm:min-w-[220px]">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Rechercher dans le planning"
              placeholder="Rechercher mission, client, lieu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-border bg-surface text-foreground placeholder:text-muted-foreground focus:border-primary h-8 w-full rounded-lg border pr-3 pl-8 text-xs focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Effacer la recherche"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtre Technicien */}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-1.5">
              <User className="text-muted-foreground hidden size-3.5 sm:inline" />
              <SelectField
                aria-label="Filtrer par technicien"
                value={selectedTechFilter}
                onChange={(e) => setSelectedTechFilter(e.target.value)}
                className="border-border bg-surface text-foreground focus:border-primary h-8 w-full min-w-0 rounded-lg border px-2.5 text-xs font-semibold focus:outline-hidden sm:w-auto"
              >
                <option value="all">Tous les techniciens</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {memberDisplayName(member)}
                  </option>
                ))}
              </SelectField>
            </div>

            {/* Filtre Type d'Activité */}
            <div className="border-border bg-surface-subtle grid w-full grid-cols-3 items-center gap-1 rounded-lg border p-0.5 sm:flex sm:w-auto">
              <button
                type="button"
                onClick={() => setActivityTypeFilter('all')}
                aria-pressed={activityTypeFilter === 'all'}
                className={cn(
                  'min-h-touch text-3xs inline-flex cursor-pointer items-center justify-center rounded-lg px-2 py-1 font-bold transition-colors sm:min-h-0',
                  activityTypeFilter === 'all'
                    ? 'bg-surface text-foreground font-extrabold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setActivityTypeFilter('intervention')}
                aria-pressed={activityTypeFilter === 'intervention'}
                className={cn(
                  'min-h-touch text-3xs inline-flex cursor-pointer items-center justify-center rounded-lg px-2 py-1 font-bold transition-colors sm:min-h-0',
                  activityTypeFilter === 'intervention'
                    ? 'bg-success/20 text-success font-extrabold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Missions
              </button>
              <button
                type="button"
                onClick={() => setActivityTypeFilter('leave')}
                aria-pressed={activityTypeFilter === 'leave'}
                className={cn(
                  'min-h-touch text-3xs inline-flex cursor-pointer items-center justify-center rounded-lg px-2 py-1 font-bold transition-colors sm:min-h-0',
                  activityTypeFilter === 'leave'
                    ? 'bg-warning/20 text-warning font-extrabold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Congés
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. COLOR LEGEND & STATS BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border-border text-3xs sm:text-2xs flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2 font-semibold">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <span className="text-muted-foreground">Légende :</span>
          <div className="flex items-center gap-1.5">
            <span className="bg-success size-2.5 rounded-full" />
            <span className="text-foreground">Intervention ({totalMissionsCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="bg-warning size-2.5 rounded-full" />
            <span className="text-foreground">Congé validé ({totalLeavesCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="bg-error size-2.5 rounded-full" />
            <span className="text-foreground">Jour férié ({totalHolidaysCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="bg-primary size-2.5 rounded-full" />
            <span className="text-foreground">Tâche récurrente</span>
          </div>
        </div>

        {canCreateMission && onNewMissionAtDate && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNewMissionAtDate(todayStr)}
            className="text-3xs text-primary hover:bg-primary/10 h-6 cursor-pointer gap-1 px-2"
          >
            <Plus className="size-3" />
            <span>Planifier aujourd'hui</span>
          </Button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. VUE MOIS (Month Grid)
      ───────────────────────────────────────────────────────────── */}
      {viewMode === 'month' && (
        <div className="bg-surface border-border overflow-hidden rounded-lg border">
          {/* Days Header */}
          <div className="border-border bg-surface-subtle/50 text-muted-foreground grid grid-cols-7 border-b py-2.5 text-center text-xs font-bold">
            {DAYS_SHORT_FR.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="divide-border/60 grid grid-cols-7 divide-x divide-y">
            {monthDaysGrid.map(({ dateStr, dayNum, isCurrentMonth }) => {
              const {
                events: dayEvents,
                holidays: dayHolidays,
                leaves: dayLeaves,
                totalCount,
              } = getActivitiesForDay(dateStr);
              const isToday = dateStr === todayStr;
              const isSelected = detailDay === dateStr;

              // Rassemble les activités à afficher (max 2 pills visibles + compteur pour éviter le débordement)
              const visibleEvents = dayEvents.slice(0, 2);
              const remainingCount =
                totalCount - visibleEvents.length - dayHolidays.length - dayLeaves.length;

              return (
                <div
                  key={dateStr}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailDay(dateStr)}
                  onKeyDown={activateOnKey(() => setDetailDay(dateStr))}
                  className={cn(
                    'group relative flex min-h-[105px] cursor-pointer flex-col justify-between p-1.5 text-left transition-colors sm:min-h-[130px] sm:p-2',
                    !isCurrentMonth && 'bg-surface-subtle/40 opacity-45',
                    isToday && 'bg-primary/5 ring-primary/40 ring-1',
                    isSelected && 'bg-surface-hover/70 ring-primary/60 ring-2',
                    'hover:bg-surface-hover/50',
                  )}
                >
                  {/* Cell Header: Day Number + Quick Add */}
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full text-xs font-bold transition-all',
                        isToday
                          ? 'bg-nav-selected text-nav-foreground'
                          : isCurrentMonth
                            ? 'text-foreground group-hover:text-primary'
                            : 'text-muted-foreground',
                      )}
                    >
                      {dayNum}
                    </span>

                    {canCreateMission && onNewMissionAtDate && isCurrentMonth && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNewMissionAtDate(dateStr);
                        }}
                        /*
                          Visible en permanence au doigt, révélé au survol au
                          pointeur.

                          Ce bouton était en `opacity-0 group-hover:opacity-100`
                          et mesurait 20 px : sur un téléphone, où il n'existe
                          pas de survol, il restait invisible ET sous la cible
                          tactile minimale. Ajouter une mission depuis le
                          calendrier était donc impossible au doigt — trente
                          fois par mois affiché.
                        */
                        className="size-touch text-primary hover:bg-primary/10 flex cursor-pointer items-center justify-center rounded-md transition-opacity sm:size-5 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label={`Planifier une mission le ${dateStr}`}
                        title={`Planifier une mission le ${dateStr}`}
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Event Pills inside Day Cell */}
                  <div className="my-1 space-y-1 overflow-hidden">
                    {/* Holidays */}
                    {dayHolidays.map((holiday) => (
                      <div
                        key={holiday.name}
                        className="bg-error/15 border-error/30 text-error sm:text-3xs flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 font-semibold"
                        title={`Jour férié : ${holiday.name}`}
                      >
                        <span className="bg-error size-1.5 shrink-0 rounded-full" />
                        <span className="truncate">{holiday.name}</span>
                      </div>
                    ))}

                    {/* Leaves */}
                    {dayLeaves.map((leave) => (
                      <div
                        key={leave.id}
                        className="bg-warning/15 border-warning/30 text-warning sm:text-3xs flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 font-semibold"
                        title={`Congé : ${leave.technicianName} (${leave.type === 'rtt' ? 'RTT' : 'Congé payé'})`}
                      >
                        <Palmtree className="text-warning size-2.5 shrink-0" />
                        <span className="truncate">
                          [{leave.technicianInitials}] {leave.technicianName}
                        </span>
                      </div>
                    ))}

                    {/* Interventions & Tasks with Time */}
                    {visibleEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className={cn(
                          'sm:text-3xs flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 font-semibold',
                          evt.type === 'recurring_task'
                            ? 'bg-primary/15 border-primary/30 text-primary'
                            : 'bg-success/15 border-success/30 text-success',
                        )}
                        title={`${evt.startTime ? `${evt.startTime} • ` : ''}${getEventDisplayTitle(evt)} (${evt.clientName ?? 'Client'})`}
                      >
                        <Wrench className="size-2.5 shrink-0 opacity-80" />
                        <span className="truncate">
                          {evt.startTime && (
                            <span className="mr-0.5 font-mono opacity-85">{evt.startTime}</span>
                          )}
                          {evt.technicianInitials ? `[${evt.technicianInitials}] ` : ''}
                          {getEventDisplayTitle(evt)}
                        </span>
                      </div>
                    ))}

                    {/* Plus d'activités */}
                    {remainingCount > 0 && (
                      <div className="text-muted-foreground px-1 font-bold">
                        +{remainingCount} autre{remainingCount > 1 ? 's' : ''}…
                      </div>
                    )}
                  </div>

                  {/* Cell Footer summary count */}
                  <div className="sm:text-3xs text-muted-foreground/70 text-right font-medium">
                    {totalCount > 0 && <span>{totalCount} act.</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. VUE SEMAINE (Week Grid / Columns)
      ───────────────────────────────────────────────────────────── */}
      {viewMode === 'week' && (
        <div className="bg-surface border-border overflow-hidden rounded-lg border">
          {/* Grille 7 colonnes pour les 7 jours de la semaine */}
          <div className="divide-border grid grid-cols-1 divide-y md:grid-cols-7 md:divide-x md:divide-y-0">
            {weekDays.map(({ dateStr, dayNum, dayName }) => {
              const {
                events: dayEvents,
                holidays: dayHolidays,
                leaves: dayLeaves,
                totalCount,
              } = getActivitiesForDay(dateStr);
              const isToday = dateStr === todayStr;

              return (
                <div key={dateStr} className="flex min-h-[350px] flex-col">
                  {/* Colonne Header */}
                  <div
                    className={cn(
                      'border-border flex items-center justify-between gap-1 border-b p-3 text-center md:flex-col md:justify-center',
                      isToday ? 'bg-primary/10' : 'bg-surface-subtle/50',
                    )}
                  >
                    <div className="flex items-center gap-2 md:flex-col">
                      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                        {dayName.slice(0, 3)}
                      </span>
                      <span
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full text-sm font-extrabold',
                          isToday ? 'bg-nav-selected text-nav-foreground' : 'text-foreground',
                        )}
                      >
                        {dayNum}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {totalCount > 0 && (
                        <Badge variant="outline" className="px-1.5 py-0 font-bold">
                          {totalCount} act.
                        </Badge>
                      )}
                      {canCreateMission && onNewMissionAtDate && (
                        <button
                          type="button"
                          onClick={() => onNewMissionAtDate(dateStr)}
                          aria-label={'Ajouter une mission le ' + formatFullDateFR(dateStr)}
                          className="hover:bg-surface text-primary flex size-6 cursor-pointer items-center justify-center rounded-md"
                          title="Planifier une intervention"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cartes d'activités de la journée */}
                  <div className="flex-1 space-y-2 overflow-y-auto p-2">
                    {/* Fériés */}
                    {dayHolidays.map((holiday) => (
                      <div
                        key={holiday.name}
                        className="bg-error/15 border-error/30 text-error text-3xs rounded-lg border p-2 font-semibold"
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          <Flag className="text-error size-3" />
                          <span>{holiday.name}</span>
                        </div>
                      </div>
                    ))}

                    {/* Congés */}
                    {dayLeaves.map((leave) => (
                      <div
                        key={leave.id}
                        className="bg-warning/15 border-warning/30 text-warning text-3xs space-y-1 rounded-lg border p-2"
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          <Palmtree className="text-warning size-3" />
                          <span>{leave.technicianName}</span>
                        </div>
                        <p className="text-muted-foreground">
                          {leave.type === 'rtt' ? 'RTT' : 'Congé payé'} ({leave.daysCount}j)
                        </p>
                      </div>
                    ))}

                    {/* Missions & Interventions */}
                    {dayEvents.map((evt) => (
                      <div
                        key={evt.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetailDay(dateStr)}
                        onKeyDown={activateOnKey(() => setDetailDay(dateStr))}
                        className="bg-surface border-border/80 hover:border-primary/50 group cursor-pointer space-y-1.5 rounded-lg border p-2.5 transition-all hover:shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-primary font-mono font-extrabold">
                            {evt.startTime ?? 'Journée'}
                          </span>
                          {evt.technicianInitials && (
                            <Badge variant="outline" className="px-1 py-0 font-bold">
                              {evt.technicianInitials}
                            </Badge>
                          )}
                        </div>

                        <h4 className="text-foreground group-hover:text-primary line-clamp-2 text-xs leading-tight font-bold transition-colors">
                          {getEventDisplayTitle(evt)}
                        </h4>

                        {evt.clientName && (
                          <p className="text-3xs text-muted-foreground truncate font-medium">
                            🏢 {evt.clientName}
                          </p>
                        )}

                        {evt.address && (
                          <p className="text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin className="size-2.5 shrink-0 opacity-70" />
                            <span>{evt.address}</span>
                          </p>
                        )}

                        {/* Actions rapides */}
                        <div className="border-border/40 flex items-center gap-1 border-t pt-1">
                          {evt.latitude && evt.longitude && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openNavigationApp({
                                  latitude: evt.latitude!,
                                  longitude: evt.longitude!,
                                  ...(evt.address ? { address: evt.address } : {}),
                                });
                              }}
                              className="hover:bg-surface-subtle text-primary flex cursor-pointer items-center gap-1 rounded p-1"
                              title="Lancer l'itinéraire GPS"
                            >
                              <Navigation className="size-2.5" />
                              <span>GPS</span>
                            </button>
                          )}
                          {evt.missionId && (
                            <Link
                              to={ROUTES.mission(evt.missionId)}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:bg-surface-subtle text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1 rounded p-1"
                              title="Voir la mission"
                            >
                              <Eye className="size-2.5" />
                              <span>Fiche</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}

                    {totalCount === 0 && (
                      <div className="text-muted-foreground/50 text-3xs py-6 text-center">
                        Aucune activité
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. VUE AGENDA / LISTE (Mobile First Feed)
      ───────────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {agendaGroupedDays.length === 0 ? (
            <div className="bg-surface border-border text-muted-foreground space-y-2 rounded-lg border p-8 text-center">
              <CalendarRange className="text-muted-foreground mx-auto size-8 opacity-40" />
              <p className="text-sm font-semibold">Aucune activité trouvée pour cette période</p>
              <p className="text-xs">Modifiez vos filtres ou planifiez une nouvelle mission.</p>
            </div>
          ) : (
            agendaGroupedDays.map(
              ({
                dateStr,
                events: dayEvents,
                holidays: dayHolidays,
                leaves: dayLeaves,
                totalCount,
              }) => {
                const isToday = dateStr === todayStr;

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      'bg-surface overflow-hidden rounded-lg border transition-all',
                      isToday ? 'border-primary/50 ring-primary/30 ring-1' : 'border-border',
                    )}
                  >
                    {/* Header Journée */}
                    <div
                      className={cn(
                        'flex items-center justify-between gap-3 border-b p-3 sm:p-4',
                        isToday
                          ? 'bg-primary/5 border-primary/20'
                          : 'bg-surface-subtle/50 border-border',
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'flex size-8 items-center justify-center rounded-lg text-xs font-extrabold',
                            isToday
                              ? 'bg-nav-selected text-nav-foreground'
                              : 'bg-surface border-border text-foreground border',
                          )}
                        >
                          {dateStr.split('-')[2]}
                        </span>
                        <div>
                          <h3 className="text-foreground text-xs font-bold sm:text-sm">
                            {formatFullDateFR(dateStr)}
                          </h3>
                          <p className="text-3xs text-muted-foreground">
                            {totalCount} activité{totalCount > 1 ? 's' : ''} planifiée
                            {totalCount > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {canCreateMission && onNewMissionAtDate && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onNewMissionAtDate(dateStr)}
                          aria-label={`Ajouter une mission le ${formatFullDateFR(dateStr)}`}
                          className="text-3xs size-touch cursor-pointer gap-1 px-0 sm:h-7 sm:w-auto sm:px-2.5"
                        >
                          <Plus className="text-primary size-3" />
                          <span className="hidden sm:inline">Ajouter</span>
                        </Button>
                      )}
                    </div>

                    {/* Cartes d'activités de la journée */}
                    <div className="space-y-3 p-3 sm:p-4">
                      {/* Jours Fériés */}
                      {dayHolidays.map((holiday) => (
                        <div
                          key={holiday.name}
                          className="bg-error/10 border-error/30 text-error flex items-center gap-2 rounded-lg border p-3"
                        >
                          <Flag className="text-error size-4 shrink-0" />
                          <div>
                            <p className="text-xs font-bold">{holiday.name}</p>
                            <p className="text-3xs text-muted-foreground">Jour férié officiel</p>
                          </div>
                        </div>
                      ))}

                      {/* Congés */}
                      {dayLeaves.map((leave) => (
                        <div
                          key={leave.id}
                          className="bg-warning/10 border-warning/30 text-warning flex items-center justify-between gap-3 rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="bg-warning/20 text-warning flex size-7 items-center justify-center rounded-lg">
                              <Palmtree className="size-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold">{leave.technicianName}</p>
                              <p className="text-3xs text-muted-foreground">
                                {leave.type === 'rtt' ? 'RTT' : 'Congé payé'} • {leave.daysCount}{' '}
                                jour(s)
                              </p>
                            </div>
                          </div>
                          <Badge variant="warning" className="font-bold">
                            Validé
                          </Badge>
                        </div>
                      ))}

                      {/* Missions & Interventions */}
                      {dayEvents.map((evt) => (
                        <div
                          key={evt.id}
                          className="bg-surface-subtle/50 border-border hover:border-primary/40 space-y-3 rounded-lg border p-3.5 transition-all sm:p-4"
                        >
                          {/* Haut de carte : Horaires, Réf, Technicien */}
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="bg-primary/10 border-primary/20 text-primary text-3xs flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono font-bold">
                                <Clock className="size-2.5" />
                                <span>{evt.time ?? 'Horaire non précisé'}</span>
                              </span>

                              {evt.reference && (
                                <span className="text-3xs text-foreground font-mono font-bold">
                                  {evt.reference}
                                </span>
                              )}

                              {evt.priority && (
                                <Badge
                                  variant={
                                    evt.priority === 'urgent'
                                      ? 'error'
                                      : evt.priority === 'high'
                                        ? 'warning'
                                        : 'info'
                                  }
                                  className="px-1.5 py-0 font-bold"
                                >
                                  {
                                    {
                                      low: 'Basse',
                                      medium: 'Normale',
                                      high: 'Haute',
                                      urgent: 'Urgente',
                                    }[evt.priority]
                                  }
                                </Badge>
                              )}
                            </div>

                            {evt.technicianName && (
                              <div className="text-3xs text-muted-foreground flex items-center gap-1 font-semibold">
                                <User className="text-primary size-3" />
                                <span>{evt.technicianName}</span>
                              </div>
                            )}
                          </div>

                          {/* Corps : Titre, Client, Adresse */}
                          <div>
                            <h4 className="text-foreground text-sm font-bold">
                              {getEventDisplayTitle(evt)}
                            </h4>
                            {evt.clientName && (
                              <p className="text-primary/90 mt-0.5 text-xs font-semibold">
                                🏢 {evt.clientName}
                              </p>
                            )}
                            {evt.address && (
                              <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                                <MapPin className="text-muted-foreground/70 size-3 shrink-0" />
                                <span>{evt.address}</span>
                              </p>
                            )}
                            {evt.phone && (
                              <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                                <Phone className="text-muted-foreground/70 size-3 shrink-0" />
                                <span>{evt.phone}</span>
                              </p>
                            )}
                          </div>

                          {/* Actions : Itinéraire, Fiche, Appel */}
                          <div className="border-border/50 flex flex-wrap items-center gap-2 border-t pt-2">
                            {evt.latitude && evt.longitude && (
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() =>
                                  openNavigationApp({
                                    latitude: evt.latitude!,
                                    longitude: evt.longitude!,
                                    ...(evt.address ? { address: evt.address } : {}),
                                  })
                                }
                                className="text-3xs h-7 cursor-pointer gap-1.5 px-3"
                                title="Lancer le guidage GPS vers cette intervention"
                              >
                                <Navigation className="size-3" />
                                <span>🧭 Itinéraire GPS</span>
                              </Button>
                            )}

                            {evt.missionId && (
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="text-3xs h-7 gap-1.5 px-3"
                              >
                                <Link to={ROUTES.mission(evt.missionId)}>
                                  <Eye className="text-primary size-3" />
                                  <span>Voir la mission</span>
                                </Link>
                              </Button>
                            )}

                            {evt.phone && (
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="text-3xs text-muted-foreground hover:text-foreground ml-auto h-7 px-2"
                              >
                                <a href={`tel:${evt.phone}`}>
                                  <Phone className="text-success size-3" />
                                  <span className="hidden sm:inline">Appeler</span>
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              },
            )
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. MODAL DÉTAIL D'UNE JOURNÉE (Au clic sur un jour dans le calendrier)
      ───────────────────────────────────────────────────────────── */}
      {detailDay && (
        <Modal
          presentation="drawer"
          open={Boolean(detailDay)}
          onOpenChange={(open) => {
            if (!open) setDetailDay(null);
          }}
          size="lg"
          title={`Activités du ${formatFullDateFR(detailDay)}`}
          description="Liste détaillée des interventions, congés et jours fériés pour cette journée."
        >
          {(() => {
            const {
              events: dayEvents,
              holidays: dayHolidays,
              leaves: dayLeaves,
              totalCount,
            } = getActivitiesForDay(detailDay);

            return (
              <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
                {/* Actions en haut de modal */}
                <div className="bg-surface-subtle border-border flex items-center justify-between gap-2 rounded-lg border p-3">
                  <span className="text-foreground text-xs font-bold">
                    {totalCount} activité{totalCount > 1 ? 's' : ''} au planning
                  </span>
                  {canCreateMission && onNewMissionAtDate && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        const targetDate = detailDay;
                        setDetailDay(null);
                        onNewMissionAtDate(targetDate);
                      }}
                      className="h-7 cursor-pointer gap-1 text-xs"
                    >
                      <Plus className="size-3" />
                      <span>Planifier à cette date</span>
                    </Button>
                  )}
                </div>

                {totalCount === 0 ? (
                  <div className="text-muted-foreground space-y-2 py-12 text-center">
                    <CalendarIcon className="mx-auto size-8 opacity-30" />
                    <p className="text-xs font-semibold">Aucune activité enregistrée ce jour</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Jours fériés */}
                    {dayHolidays.map((holiday) => (
                      <div
                        key={holiday.name}
                        className="bg-error/10 border-error/30 text-error flex items-center gap-2 rounded-lg border p-3"
                      >
                        <Flag className="text-error size-4 shrink-0" />
                        <div>
                          <p className="text-xs font-bold">{holiday.name}</p>
                          <p className="text-3xs text-muted-foreground">Jour férié</p>
                        </div>
                      </div>
                    ))}

                    {/* Congés */}
                    {dayLeaves.map((leave) => (
                      <div
                        key={leave.id}
                        className="bg-warning/10 border-warning/30 text-warning flex items-center justify-between gap-2 rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-2">
                          <Palmtree className="text-warning size-4" />
                          <div>
                            <p className="text-xs font-bold">{leave.technicianName}</p>
                            <p className="text-3xs text-muted-foreground">
                              {leave.type === 'rtt' ? 'RTT' : 'Congé payé'} ({leave.daysCount}j)
                            </p>
                          </div>
                        </div>
                        <Badge variant="warning" className="font-bold">
                          Validé
                        </Badge>
                      </div>
                    ))}

                    {/* Missions */}
                    {dayEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="bg-surface border-border space-y-2 rounded-lg border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="bg-primary/10 text-primary text-3xs flex items-center gap-1 rounded-md px-2 py-0.5 font-mono font-bold">
                            <Clock className="size-2.5" />
                            <span>{evt.time ?? 'Horaire non précisé'}</span>
                          </span>
                          {evt.technicianName && (
                            <span className="text-3xs text-muted-foreground flex items-center gap-1 font-semibold">
                              <User className="text-primary size-2.5" />
                              {evt.technicianName}
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="text-foreground text-xs font-bold">
                            {getEventDisplayTitle(evt)}
                          </h4>
                          {evt.clientName && (
                            <p className="text-primary mt-0.5 text-xs font-semibold">
                              🏢 {evt.clientName}
                            </p>
                          )}
                          {evt.address && (
                            <p className="text-3xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <MapPin className="size-2.5 opacity-70" />
                              {evt.address}
                            </p>
                          )}
                        </div>

                        <div className="border-border/50 flex items-center gap-2 border-t pt-2">
                          {evt.latitude && evt.longitude && (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                openNavigationApp({
                                  latitude: evt.latitude!,
                                  longitude: evt.longitude!,
                                  ...(evt.address ? { address: evt.address } : {}),
                                });
                              }}
                              className="text-3xs h-7 cursor-pointer gap-1 px-2.5"
                            >
                              <Navigation className="size-2.5" />
                              <span>🧭 Itinéraire</span>
                            </Button>
                          )}
                          {evt.missionId && (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="text-3xs h-7 gap-1 px-2.5"
                            >
                              <Link to={ROUTES.mission(evt.missionId)}>
                                <Eye className="text-primary size-2.5" />
                                <span>Fiche</span>
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
