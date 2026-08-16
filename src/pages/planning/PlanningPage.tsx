import { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Download,
  Upload,
  Plus,
  Palmtree,
  RotateCcw,
  Flag,
  CheckCircle2,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import {
  PlanningCalendarView,
  LeavesManagementTab,
  RecurringTasksTab,
  PublicHolidaysTab,
  NewLeaveModal,
  NewEventModal,
  ImportICSModal,
  exportEventsToICS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_LEAVE_BALANCES,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_RECURRING_TASKS,
  type LeaveRequest,
  type StaffLeaveBalance,
  type PlanningCalendarEvent,
  type RecurringTask,
  type LeaveStatus,
  type HolidayTerritory,
  getHolidaysForTerritory,
} from '@/features/planning';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function PlanningPage() {
  useDocumentTitle('Planning & Congés');

  const [activeTab, setActiveTab] = useState<'calendar' | 'leaves' | 'recurring' | 'holidays'>('calendar');
  const [events, setEvents] = useState<PlanningCalendarEvent[]>(INITIAL_CALENDAR_EVENTS);
  const [leaves, setLeaves] = useState<LeaveRequest[]>(INITIAL_LEAVE_REQUESTS);
  const [balances, setBalances] = useState<StaffLeaveBalance[]>(INITIAL_LEAVE_BALANCES);
  const [tasks] = useState<RecurringTask[]>(INITIAL_RECURRING_TASKS);
  const [selectedTerritory, setSelectedTerritory] = useState<HolidayTerritory>('metropole');
  const holidays = getHolidaysForTerritory(selectedTerritory);

  const [isNewLeaveOpen, setIsNewLeaveOpen] = useState(false);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);
  const [isImportICSOpen, setIsImportICSOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const pendingLeavesCount = leaves.filter((l) => l.status === 'pending').length;

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleImportEvents = (imported: PlanningCalendarEvent[]) => {
    setEvents((prev) => [...imported, ...prev]);
    showNotification(`${imported.length} événement(s) iCal importé(s) avec succès dans le planning.`);
  };

  const handleAddLeave = (newLeave: LeaveRequest) => {
    setLeaves((prev) => [newLeave, ...prev]);

    // If approved, add to calendar events
    if (newLeave.status === 'approved') {
      const leaveEvent: PlanningCalendarEvent = {
        id: `evt-${newLeave.id}`,
        title: `Congé : ${newLeave.technicianName}`,
        date: newLeave.startDate,
        endDate: newLeave.endDate,
        type: 'leave',
        technicianId: newLeave.technicianId,
        technicianName: newLeave.technicianName,
        technicianInitials: newLeave.technicianInitials,
        details: `${newLeave.reason} (${newLeave.daysCount} jour(s))`,
      };
      setEvents((prev) => [leaveEvent, ...prev]);

      // Deduct from balance
      setBalances((prev) =>
        prev.map((b) => {
          if (b.technicianId === newLeave.technicianId) {
            if (newLeave.type === 'paid_leave') {
              return { ...b, paidLeaveRemaining: Math.max(0, b.paidLeaveRemaining - newLeave.daysCount) };
            }
            if (newLeave.type === 'rtt') {
              return { ...b, rttRemaining: Math.max(0, b.rttRemaining - newLeave.daysCount) };
            }
          }
          return b;
        }),
      );
    }

    showNotification(
      `Absence enregistrée pour ${newLeave.technicianName} (${newLeave.daysCount} jour(s)).`,
    );
  };

  const handleUpdateLeaveStatus = (leaveId: string, newStatus: LeaveStatus) => {
    setLeaves((prev) =>
      prev.map((l) => {
        if (l.id === leaveId) {
          return {
            ...l,
            status: newStatus,
            approvedBy: newStatus === 'approved' ? 'Gérant (Vous)' : undefined,
            approvedAt: newStatus === 'approved' ? new Date().toISOString().split('T')[0] : undefined,
          };
        }
        return l;
      }),
    );

    const leave = leaves.find((l) => l.id === leaveId);
    if (leave && newStatus === 'approved') {
      const leaveEvent: PlanningCalendarEvent = {
        id: `evt-${leave.id}`,
        title: `Congé : ${leave.technicianName}`,
        date: leave.startDate,
        endDate: leave.endDate,
        type: 'leave',
        technicianId: leave.technicianId,
        technicianName: leave.technicianName,
        technicianInitials: leave.technicianInitials,
        details: `${leave.reason} (${leave.daysCount} jour(s))`,
      };
      setEvents((prev) => [leaveEvent, ...prev]);
      showNotification(`Demande de congé validée pour ${leave.technicianName}.`);
    } else if (leave && newStatus === 'rejected') {
      showNotification(`Demande de congé refusée pour ${leave.technicianName}.`);
    }
  };

  const handleAddEvent = (newEvent: PlanningCalendarEvent) => {
    setEvents((prev) => [newEvent, ...prev]);
    showNotification(`Événement "${newEvent.title}" planifié au ${newEvent.date}.`);
  };

  const handleExportICS = () => {
    exportEventsToICS(events);
    showNotification('Fichier planning_nexoratech.ics téléchargé avec succès.');
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* 1. Header Page & Actions Globales */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CalendarIcon className="size-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
              Planning & Gestion des Congés
            </h1>
            <Badge variant="outline" className="hidden sm:inline-flex text-3xs font-mono">
              Équipes & Chantiers
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Calendrier des interventions, gestion des absences du personnel et tâches récurrentes
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsImportICSOpen(true)}
            className="text-xs h-8 gap-1.5"
            title="Importer un fichier iCalendar (.ics / .ical)"
          >
            <Upload className="size-3.5" />
            <span className="hidden sm:inline">Importer</span> .ics
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportICS}
            className="text-xs h-8 gap-1.5"
            title="Exporter vers Outlook, Apple Calendar ou Google Calendar"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Exporter</span> .ics
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsNewLeaveOpen(true)}
            className="text-xs h-8 gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <Palmtree className="size-3.5" />
            <span>Poser un congé</span>
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsNewEventOpen(true)}
            className="text-xs h-8 gap-1.5 shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Planifier</span>
          </Button>
        </div>
      </div>

      {/* Floating Notification Toast */}
      {notification && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* 2. Main Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 bg-surface-subtle p-1 rounded-2xl border border-border overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'calendar'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <CalendarIcon className="size-3.5" />
          <span>Calendrier & Agenda</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaves')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'leaves'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <Palmtree className="size-3.5" />
          <span>Congés & Absences</span>
          {pendingLeavesCount > 0 && (
            <span
              className={cn(
                'size-5 rounded-full flex items-center justify-center text-3xs font-extrabold',
                activeTab === 'leaves'
                  ? 'bg-white text-primary'
                  : 'bg-amber-500 text-white',
              )}
            >
              {pendingLeavesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recurring')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'recurring'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <RotateCcw className="size-3.5" />
          <span>Tâches Récurrentes ({tasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('holidays')}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
            activeTab === 'holidays'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <Flag className="size-3.5" />
          <span>Jours Fériés ({holidays.length})</span>
        </button>
      </div>

      {/* 3. Tab Content Display */}
      {activeTab === 'calendar' && (
        <PlanningCalendarView
          events={events}
          leaves={leaves}
          holidays={holidays}
        />
      )}

      {activeTab === 'leaves' && (
        <LeavesManagementTab
          leaves={leaves}
          balances={balances}
          onOpenNewLeave={() => setIsNewLeaveOpen(true)}
          onUpdateStatus={handleUpdateLeaveStatus}
        />
      )}

      {activeTab === 'recurring' && (
        <RecurringTasksTab
          tasks={tasks}
          onTriggerReminders={() => {
            showNotification('Rappels J-4 traités pour toutes les visites périodiques.');
          }}
        />
      )}

      {activeTab === 'holidays' && (
        <PublicHolidaysTab
          holidays={holidays}
          selectedTerritory={selectedTerritory}
          onSelectTerritory={setSelectedTerritory}
        />
      )}

      {/* Modals */}
      <NewLeaveModal
        open={isNewLeaveOpen}
        onOpenChange={setIsNewLeaveOpen}
        onAddLeave={handleAddLeave}
      />

      <NewEventModal
        open={isNewEventOpen}
        onOpenChange={setIsNewEventOpen}
        onAddEvent={handleAddEvent}
      />

      <ImportICSModal
        open={isImportICSOpen}
        onOpenChange={setIsImportICSOpen}
        onImportEvents={handleImportEvents}
      />
    </div>
  );
}
