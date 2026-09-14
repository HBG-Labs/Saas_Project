import { useMemo, useState } from 'react';
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

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { useDefaultTerritory } from '@/config/territories';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth';
import { useCreateMission } from '@/features/missions';
import {
  PERMISSIONS,
  useCurrentOrganization,
  useMembers,
  usePermission,
} from '@/features/organizations';
import { useMissions } from '@/features/missions';
import { useTeams } from '@/features/teams';
import {
  PlanningCalendarView,
  LeavesManagementTab,
  RecurringTasksTab,
  PublicHolidaysTab,
  NewLeaveModal,
  NewEventModal,
  ImportICSModal,
  buildCalendarEvents,
  exportEventsToICS,
  getHolidaysForTerritory,
  toLeaveRequest,
  toRecurringTask,
  toStaffLeaveBalance,
  useCreateLeaveRequest,
  useLeaveBalances,
  useLeaveRequests,
  useRecurringTasks,
  useSetLeaveStatus,
  type HolidayTerritory,
  type ImportSubmission,
  type LeaveStatus,
  type NewEventSubmission,
  type NewLeaveSubmission,
} from '@/features/planning';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useEphemeralValue } from '@/lib/use-ephemeral-flag';

/**
 * Planning & congés.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE CALENDRIER N'A PAS DE TABLE
 *
 * Il compose trois sources : les missions planifiées, les congés accordés ou en
 * attente, et les jours fériés calculés. Une table `calendar_events` aurait
 * dupliqué des lignes qui existent déjà — et la copie qu'on n'affiche pas est
 * toujours celle qui reste fausse le plus longtemps.
 *
 * C'est aussi ce qui explique que « Planifier » crée une MISSION : c'est la
 * seule chose qu'un événement de calendrier puisse être ici.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function PlanningPage() {
  useDocumentTitle('Planning & Congés');

  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;

  const [activeTab, setActiveTab] = useState<'calendar' | 'leaves' | 'recurring' | 'holidays'>(
    'calendar',
  );
  // Le territoire affiché suit celui de l'ENTREPRISE, sauf choix explicite dans
  // l'onglet « Jours fériés ». Le déduire au rendu évite le double affichage —
  // les fériés de métropole une image, puis ceux de Martinique.
  //
  // C'est aussi le territoire qui gouverne le décompte des congés : il vient
  // désormais de `organizations.holiday_territory`, et non plus d'une
  // préférence par navigateur, qui donnait deux totaux pour la même demande.
  const { territory: defaultTerritoryConfig } = useDefaultTerritory();
  const organizationTerritory =
    (organization?.holiday_territory as HolidayTerritory | undefined) ?? defaultTerritoryConfig.id;

  const [chosenTerritory, setChosenTerritory] = useState<HolidayTerritory | null>(null);
  const selectedTerritory = chosenTerritory ?? organizationTerritory;
  const setSelectedTerritory = setChosenTerritory;

  const [isNewLeaveOpen, setIsNewLeaveOpen] = useState(false);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);
  const [selectedPlanDate, setSelectedPlanDate] = useState<string | null>(null);
  const [isImportICSOpen, setIsImportICSOpen] = useState(false);
  const [notification, signalerNotification] = useEphemeralValue<string>(4000);

  const membersQuery = useMembers(organizationId);
  const teamsQuery = useTeams(organizationId);
  const leavesQuery = useLeaveRequests(organizationId);
  const balancesQuery = useLeaveBalances(organizationId, new Date().getFullYear());
  const tasksQuery = useRecurringTasks(organizationId);
  // Les missions du calendrier : celles qui portent une date. La limite évite
  // de charger un historique entier pour afficher un mois.
  const missionsQuery = useMissions(organizationId, { limit: 400 });

  const createLeave = useCreateLeaveRequest(organizationId ?? '');
  const setLeaveStatus = useSetLeaveStatus();
  const createMission = useCreateMission();

  const holidays = useMemo(() => getHolidaysForTerritory(selectedTerritory), [selectedTerritory]);

  const leaves = useMemo(() => (leavesQuery.data ?? []).map(toLeaveRequest), [leavesQuery.data]);
  const balances = useMemo(
    () => (balancesQuery.data ?? []).map(toStaffLeaveBalance),
    [balancesQuery.data],
  );
  const tasks = useMemo(() => (tasksQuery.data ?? []).map(toRecurringTask), [tasksQuery.data]);

  const events = useMemo(
    () =>
      buildCalendarEvents({
        missions: missionsQuery.data ?? [],
        leaves: leavesQuery.data ?? [],
        holidays,
      }),
    [missionsQuery.data, leavesQuery.data, holidays],
  );

  /** Sa propre ligne de membership : la présélection naturelle d'une demande. */
  const ownMemberId =
    (membersQuery.data ?? []).find((member) => member.user_id === user?.id)?.id ?? null;

  const pendingLeavesCount = leaves.filter((leave) => leave.status === 'pending').length;

  const showNotification = (message: string) => {
    signalerNotification(message);
  };

  const handleAddLeave = (submission: NewLeaveSubmission) => {
    createLeave.mutate(submission, {
      onSuccess: () => {
        setIsNewLeaveOpen(false);
        showNotification('Demande enregistrée. Elle attend la validation d’un responsable.');
      },
    });
  };

  const handleUpdateLeaveStatus = (leaveId: string, newStatus: LeaveStatus) => {
    if (newStatus === 'pending') return;

    setLeaveStatus.mutate(
      { leaveId, status: newStatus },
      {
        onSuccess: () => {
          showNotification(
            newStatus === 'approved' ? 'Demande de congé validée.' : 'Demande de congé refusée.',
          );
        },
        // Le refus vient du serveur : un responsable qui vise ses propres
        // congés, ou un chef d'équipe sans `leave.approve`, sera arrêté par le
        // trigger. On le dit plutôt que de laisser l'écran muet.
        onError: (error: unknown) => {
          showNotification(
            error instanceof Error ? error.message : 'Cette décision a été refusée.',
          );
        },
      },
    );
  };

  const handleAddEvent = (submission: NewEventSubmission) => {
    if (organizationId === null || user === null) return;

    createMission.mutate(
      {
        organizationId,
        createdBy: user.id,
        title: submission.title,
        priority: submission.priority,
        scheduledStart: submission.scheduledStart,
        ...(submission.scheduledEnd !== undefined ? { scheduledEnd: submission.scheduledEnd } : {}),
        ...(submission.assignedMemberId !== null
          ? { assignedUserId: submission.assignedMemberId }
          : {}),
        ...(submission.assignedTeamId !== null
          ? { assignedTeamId: submission.assignedTeamId }
          : {}),
        ...(submission.notes !== '' ? { notes: submission.notes } : {}),
      },
      {
        onSuccess: () => {
          setIsNewEventOpen(false);
          showNotification(`Mission « ${submission.title} » planifiée.`);
        },
      },
    );
  };

  /**
   * L'import crée les missions une par une, en série.
   *
   * Volontairement séquentiel : la référence de mission est générée par un
   * trigger qui incrémente un compteur par organisation. Vingt insertions
   * lancées de front se disputeraient ce compteur, et l'échec ne serait ni
   * lisible ni reproductible.
   */
  const handleImportEvents = async (submission: ImportSubmission) => {
    if (organizationId === null || user === null) return;

    let created = 0;
    for (const event of submission.events) {
      try {
        await createMission.mutateAsync({
          organizationId,
          createdBy: user.id,
          title: event.title,
          priority: 'normal',
          scheduledStart: new Date(`${event.date}T09:00:00`).toISOString(),
          notes: event.details ?? `Importé depuis ${submission.sourceName}`,
          ...(submission.assignedMemberId !== null
            ? { assignedUserId: submission.assignedMemberId }
            : {}),
        });
        created += 1;
      } catch {
        // Un événement mal formé ne doit pas emporter tout l'import : le
        // décompte final dira combien sont réellement passés.
      }
    }

    setIsImportICSOpen(false);
    showNotification(
      created === submission.events.length
        ? `${String(created)} mission(s) créée(s) depuis ${submission.sourceName}.`
        : `${String(created)} mission(s) sur ${String(submission.events.length)} créée(s) — les autres ont été refusées.`,
    );
  };

  const handleExportICS = () => {
    exportEventsToICS(events);
    showNotification('Fichier planning_rezo360.ics téléchargé.');
  };

  if (leavesQuery.isError) {
    return <ErrorState error={leavesQuery.error} onRetry={() => void leavesQuery.refetch()} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-10">
      <PageHeader
        title="Planning & congés"
        description="Planifiez les interventions, suivez les absences et anticipez les échéances récurrentes."
        className="mb-4"
        actions={
          <>
            {can(PERMISSIONS.missionCreate) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsImportICSOpen(true)}
                title="Importer un fichier iCalendar (.ics / .ical)"
              >
                <Upload className="size-3.5" />
                <span className="hidden sm:inline">Importer</span> .ics
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportICS}
              title="Exporter vers Outlook, Apple Calendar ou Google Calendar"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Exporter</span> .ics
            </Button>

            {can(PERMISSIONS.leaveRequest) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsNewLeaveOpen(true)}
                className="border-warning/30 text-warning hover:bg-warning/10"
              >
                <Palmtree className="size-3.5" />
                <span>Poser un congé</span>
              </Button>
            )}

            {can(PERMISSIONS.missionCreate) && (
              <Button size="sm" variant="primary" onClick={() => setIsNewEventOpen(true)}>
                <Plus className="size-3.5" />
                <span>Planifier</span>
              </Button>
            )}
          </>
        }
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="border-success-border bg-success-subtle text-success animate-in fade-in slide-in-from-top-2 flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold motion-reduce:animate-none"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* 2. Main Tab Navigation Bar */}
      <div
        className="no-scrollbar border-border/80 bg-surface flex items-center gap-1 overflow-x-auto scroll-smooth rounded-2xl border p-1 shadow-xs sm:gap-1.5"
        aria-label="Sections du planning"
      >
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          aria-pressed={activeTab === 'calendar'}
          className={cn(
            'focus-visible:ring-ring min-h-touch inline-flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-0 sm:flex-initial sm:shrink sm:gap-2 sm:px-3.5 sm:text-xs',
            activeTab === 'calendar'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0" />
          <span className="sm:hidden">Agenda</span>
          <span className="hidden sm:inline">Calendrier & Agenda</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaves')}
          aria-pressed={activeTab === 'leaves'}
          className={cn(
            'focus-visible:ring-ring min-h-touch inline-flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-0 sm:flex-initial sm:shrink sm:gap-2 sm:px-3.5 sm:text-xs',
            activeTab === 'leaves'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <Palmtree className="size-3.5 shrink-0" />
          <span className="sm:hidden">Congés</span>
          <span className="hidden sm:inline">Congés & Absences</span>
          {pendingLeavesCount > 0 && (
            <span
              className={cn(
                'sm:text-3xs flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold sm:size-5',
                activeTab === 'leaves' ? 'text-primary bg-white' : 'bg-warning text-white',
              )}
            >
              {pendingLeavesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recurring')}
          aria-pressed={activeTab === 'recurring'}
          className={cn(
            'focus-visible:ring-ring min-h-touch inline-flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-0 sm:flex-initial sm:shrink sm:gap-2 sm:px-3.5 sm:text-xs',
            activeTab === 'recurring'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <RotateCcw className="size-3.5 shrink-0" />
          <span className="sm:hidden">Tâches</span>
          <span className="hidden sm:inline">Tâches récurrentes ({tasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('holidays')}
          aria-pressed={activeTab === 'holidays'}
          className={cn(
            'focus-visible:ring-ring min-h-touch inline-flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-0 sm:flex-initial sm:shrink sm:gap-2 sm:px-3.5 sm:text-xs',
            activeTab === 'holidays'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <Flag className="size-3.5 shrink-0" />
          <span className="sm:hidden">Fériés</span>
          <span className="hidden sm:inline">Jours fériés ({holidays.length})</span>
        </button>
      </div>

      {/* 3. Tab Content Display */}
      {activeTab === 'calendar' && (
        <PlanningCalendarView
          events={events}
          leaves={leaves}
          holidays={holidays}
          members={membersQuery.data ?? []}
          canCreateMission={can(PERMISSIONS.missionCreate)}
          onNewMissionAtDate={(dateStr) => {
            setSelectedPlanDate(dateStr);
            setIsNewEventOpen(true);
          }}
        />
      )}

      {activeTab === 'leaves' && (
        <LeavesManagementTab
          leaves={leaves}
          balances={balances}
          canApprove={can(PERMISSIONS.leaveApprove)}
          onOpenNewLeave={() => setIsNewLeaveOpen(true)}
          onUpdateStatus={handleUpdateLeaveStatus}
        />
      )}

      {activeTab === 'recurring' && <RecurringTasksTab tasks={tasks} />}

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
        members={membersQuery.data ?? []}
        defaultMemberId={ownMemberId}
        canRequestForOthers={can(PERMISSIONS.leaveApprove)}
        territory={organizationTerritory}
        submitting={createLeave.isPending}
        error={createLeave.error}
        onSubmit={handleAddLeave}
      />

      <NewEventModal
        open={isNewEventOpen}
        onOpenChange={(open) => {
          setIsNewEventOpen(open);
          if (!open) setSelectedPlanDate(null);
        }}
        initialDate={selectedPlanDate}
        teams={teamsQuery.data ?? []}
        members={membersQuery.data ?? []}
        submitting={createMission.isPending}
        error={createMission.error}
        onSubmit={handleAddEvent}
      />

      <ImportICSModal
        open={isImportICSOpen}
        onOpenChange={setIsImportICSOpen}
        members={membersQuery.data ?? []}
        submitting={createMission.isPending}
        onImport={(submission) => void handleImportEvents(submission)}
      />
    </div>
  );
}
