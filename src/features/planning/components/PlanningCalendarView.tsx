import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  Wrench,
  Palmtree,
  MapPin,
  Clock,
  User,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { PlanningCalendarEvent, LeaveRequest, PublicHoliday } from '../types';

interface PlanningCalendarViewProps {
  events: PlanningCalendarEvent[];
  leaves: LeaveRequest[];
  holidays: PublicHoliday[];
}

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

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function PlanningCalendarView({
  events,
  leaves,
  holidays,
}: PlanningCalendarViewProps) {
  // Current displayed date (Default to August 2026 for rich mock data alignment, or current date)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 7, 1)); // August 2026
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonthIndex = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonthIndex - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonthIndex + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 7, 1));
  };

  // Generate grid days for the month
  const firstDayOfMonth = new Date(currentYear, currentMonthIndex, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonthIndex + 1, 0);

  // Day of week for 1st day (0 = Sunday, 1 = Monday... convert to Mon=0, Sun=6)
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const totalDays = lastDayOfMonth.getDate();
  const daysArray: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
  const prevMonthLastDay = new Date(currentYear, currentMonthIndex, 0).getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const prevM = currentMonthIndex === 0 ? 12 : currentMonthIndex;
    const prevY = currentMonthIndex === 0 ? currentYear - 1 : currentYear;
    const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    daysArray.push({ dateStr, dayNum: day, isCurrentMonth: false });
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(
      day,
    ).padStart(2, '0')}`;
    daysArray.push({ dateStr, dayNum: day, isCurrentMonth: true });
  }

  // Next month leading days to complete grid (42 cells = 6 weeks)
  const remainingCells = 42 - daysArray.length;
  for (let day = 1; day <= remainingCells; day++) {
    const nextM = currentMonthIndex === 11 ? 1 : currentMonthIndex + 2;
    const nextY = currentMonthIndex === 11 ? currentYear + 1 : currentYear;
    const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    daysArray.push({ dateStr, dayNum: day, isCurrentMonth: false });
  }

  // Filter events by technician
  const filteredEvents = events.filter((e) => {
    if (selectedTechFilter === 'all') return true;
    return e.technicianId === selectedTechFilter;
  });

  const getEventsForDay = (dateStr: string) => {
    const dayEvents = filteredEvents.filter((e) => e.date === dateStr && e.type !== 'holiday');
    const dayHolidays = holidays.filter((h) => h.date === dateStr);
    const dayLeaves = leaves.filter((l) => {
      if (l.status !== 'approved') return false;
      if (selectedTechFilter !== 'all' && l.technicianId !== selectedTechFilter) return false;
      return dateStr >= l.startDate && dateStr <= l.endDate;
    });

    return { dayEvents, dayHolidays, dayLeaves };
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar (Navigation, Month Title, Filters & Actions) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface p-3.5 sm:p-4 rounded-2xl border border-border shadow-xs">
        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-subtle p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
              title="Mois précédent"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
              title="Mois suivant"
              aria-label="Mois suivant"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight min-w-[170px]">
            {MONTHS_FR[currentMonthIndex]} {currentYear}
          </h2>

          <Button size="sm" variant="outline" onClick={handleToday} className="text-xs h-8">
            Aujourd'hui
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Filter by Technician */}
          <div className="flex items-center gap-1.5">
            <Filter className="size-3.5 text-muted-foreground hidden sm:inline" />
            <select
              value={selectedTechFilter}
              onChange={(e) => setSelectedTechFilter(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-border bg-surface text-xs font-semibold text-foreground focus:border-primary focus:outline-hidden"
            >
              <option value="all">Tous les techniciens</option>
              <option value="tech-1">Aurélie B. (Climatisation)</option>
              <option value="tech-2">Thomas R. (Fibre)</option>
              <option value="tech-3">Karim M. (Électricité)</option>
              <option value="tech-4">Sophie L. (Plomberie)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Color Legend Bar */}
      <div className="flex items-center gap-3 sm:gap-6 px-4 py-2 bg-surface rounded-xl border border-border/80 text-3xs sm:text-2xs font-semibold flex-wrap">
        <span className="text-muted-foreground">Légende :</span>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500" />
          <span className="text-foreground">Intervention planifiée</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500" />
          <span className="text-foreground">Congé validé</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-500" />
          <span className="text-foreground">Jour férié</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-blue-500" />
          <span className="text-foreground">Tâche récurrente</span>
        </div>
      </div>

      {/* 3. Calendar Month Grid */}
      <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-border bg-surface-subtle/50 text-center text-xs font-bold text-muted-foreground py-2.5">
          {DAYS_FR.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days Grid Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
          {daysArray.map(({ dateStr, dayNum, isCurrentMonth }) => {
            const { dayEvents, dayHolidays, dayLeaves } = getEventsForDay(dateStr);
            const isToday = dateStr === '2026-08-16'; // Simulation Today
            const isSelected = selectedDay === dateStr;

            return (
              <button
                type="button"
                key={dateStr}
                onClick={() => setSelectedDay(dateStr)}
                className={cn(
                  'min-h-[105px] sm:min-h-[125px] p-1.5 sm:p-2 transition-colors flex flex-col justify-between cursor-pointer group text-left w-full focus:outline-hidden',
                  !isCurrentMonth && 'bg-surface-subtle/40 opacity-45',
                  isToday && 'bg-primary/5 ring-1 ring-primary/40',
                  isSelected && 'bg-surface-hover/70',
                  'hover:bg-surface-hover/50',
                )}
              >
                {/* Cell Header: Day Number */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'size-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                      isToday
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : isCurrentMonth
                          ? 'text-foreground group-hover:text-primary'
                          : 'text-muted-foreground',
                    )}
                  >
                    {dayNum}
                  </span>
                </div>

                {/* Event Pills inside Day Cell */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {/* Holidays */}
                  {dayHolidays.map((holiday) => (
                    <div
                      key={holiday.name}
                      className="px-1.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-3xs font-semibold truncate flex items-center gap-1"
                    >
                      <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span className="truncate">{holiday.name}</span>
                    </div>
                  ))}

                  {/* Leaves */}
                  {dayLeaves.map((leave) => (
                    <div
                      key={leave.id}
                      className="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-3xs font-semibold truncate flex items-center gap-1"
                    >
                      <Palmtree className="size-2.5 shrink-0 text-amber-500" />
                      <span className="truncate">
                        {leave.technicianName} ({leave.type === 'rtt' ? 'RTT' : 'Congé'})
                      </span>
                    </div>
                  ))}

                  {/* Interventions & Tasks */}
                  {dayEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className={cn(
                        'px-1.5 py-0.5 rounded-md text-3xs font-semibold truncate flex items-center gap-1 border',
                        evt.type === 'recurring_task'
                          ? 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
                      )}
                    >
                      <Wrench className="size-2.5 shrink-0 opacity-80" />
                      <span className="truncate">
                        {evt.technicianInitials ? `[${evt.technicianInitials}] ` : ''}
                        {evt.title}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Cell Footer summary count */}
                <div className="text-3xs text-muted-foreground/60 text-right">
                  {dayEvents.length + dayLeaves.length + dayHolidays.length > 0 && (
                    <span>{dayEvents.length + dayLeaves.length + dayHolidays.length} act.</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Selected Day Quick Detail Drawer / Popover (if clicked) */}
      {selectedDay && (
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <CalendarIcon className="size-4 text-primary" />
              Activités du {selectedDay}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold"
            >
              Fermer ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
            {/* List for day */}
            {(() => {
              const { dayEvents, dayHolidays, dayLeaves } = getEventsForDay(selectedDay);
              if (
                dayEvents.length === 0 &&
                dayHolidays.length === 0 &&
                dayLeaves.length === 0
              ) {
                return (
                  <p className="text-xs text-muted-foreground italic col-span-full">
                    Aucune activité, congé ou intervention planifiée ce jour.
                  </p>
                );
              }

              return (
                <>
                  {dayHolidays.map((h) => (
                    <div
                      key={h.name}
                      className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1"
                    >
                      <Badge variant="error" className="text-3xs">
                        Jour Férié Légal
                      </Badge>
                      <h4 className="text-xs font-bold text-foreground">{h.name}</h4>
                    </div>
                  ))}

                  {dayLeaves.map((l) => (
                    <div
                      key={l.id}
                      className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1"
                    >
                      <Badge variant="warning" className="text-3xs">
                        Congé {l.type === 'rtt' ? 'RTT' : 'Payé'}
                      </Badge>
                      <h4 className="text-xs font-bold text-foreground">{l.technicianName}</h4>
                      <p className="text-3xs text-muted-foreground">{l.reason}</p>
                    </div>
                  ))}

                  {dayEvents.map((e) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-xl bg-surface-subtle border border-border space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="primary" className="text-3xs">
                          {e.tradeLabel ?? 'Intervention'}
                        </Badge>
                        {e.time && (
                          <span className="text-3xs font-semibold text-muted-foreground flex items-center gap-1">
                            <Clock className="size-3" />
                            {e.time}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-foreground">{e.title}</h4>
                      {e.technicianName && (
                        <p className="text-3xs text-primary font-semibold flex items-center gap-1">
                          <User className="size-3" />
                          {e.technicianName}
                        </p>
                      )}
                      {e.details && (
                        <p className="text-3xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="size-3 shrink-0" />
                          {e.details}
                        </p>
                      )}
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
