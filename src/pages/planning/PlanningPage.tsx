import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Calendar as CalendarIcon,
  Download,
  Upload,
  Plus,
  Palmtree,
  RotateCcw,
  Flag,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
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
import { useTeamMembershipsByMember } from '@/features/teams';
import {
  PlanningCalendarView,
  LeavesManagementTab,
  RecurringTasksTab,
  PublicHolidaysTab,
  NewLeaveModal,
  ImportICSModal,
  buildCalendarEvents,
  dateKeysToSafeIsoRange,
  exportEventsToICS,
  getHolidaysForTerritory,
  organizationDateKey,
  startOfIsoWeek,
  addDaysToDateKey,
  toLeaveRequest,
  toRecurringTask,
  toStaffLeaveBalance,
  useCreateLeaveRequest,
  useLeaveBalances,
  useLeaveRequests,
  useRecurringTasks,
  useSetLeaveStatus,
  zonedLocalDateTimeToIso,
  type HolidayTerritory,
  type ImportSubmission,
  type LeaveStatus,
  type NewLeaveSubmission,
} from '@/features/planning';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useEphemeralValue } from '@/lib/use-ephemeral-flag';
import { successFeedback } from '@/lib/mobile-feedback';
import type { MemberWithProfile } from '@/types/domain';

type PlanningSection = 'calendar' | 'leaves' | 'recurring' | 'holidays';

function planningSectionFromSearch(search: string): PlanningSection {
  const section = new URLSearchParams(search).get('section');
  if (section === 'leaves' || section === 'recurring' || section === 'holidays') return section;
  return 'calendar';
}

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
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;
  const timeZone = organization?.timezone ?? 'Europe/Paris';
  const todayKey = organizationDateKey(new Date(), timeZone);
  const dateFromUrl = new URLSearchParams(location.search).get('date');
  const selectedPlanningDate =
    dateFromUrl !== null && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl) ? dateFromUrl : todayKey;
  const [calendarRange, setCalendarRange] = useState(() => {
    const from = startOfIsoWeek(todayKey);
    return { from, to: addDaysToDateKey(from, 6) };
  });
  const [calendarTimeZone, setCalendarTimeZone] = useState(timeZone);

  const activeTab = planningSectionFromSearch(location.search);

  const openPlanningSection = useCallback(
    (section: PlanningSection) => {
      const params = new URLSearchParams(location.search);
      params.set('section', section === 'calendar' ? 'agenda' : section);
      void navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    },
    [location.pathname, location.search, navigate],
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
  const [isImportICSOpen, setIsImportICSOpen] = useState(false);
  const [notification, signalerNotification] = useEphemeralValue<string>(4000);

  const membersQuery = useMembers(organizationId);
  const membershipsQuery = useTeamMembershipsByMember(organizationId);
  const leavesQuery = useLeaveRequests(organizationId);
  const balancesQuery = useLeaveBalances(organizationId, new Date().getFullYear());
  const tasksQuery = useRecurringTasks(organizationId);
  // La requête suit la fenêtre réellement visible. Les bornes sont élargies
  // avant le filtre UTC puis les événements sont rangés dans le fuseau métier.
  const missionIsoRange = useMemo(() => {
    if (calendarTimeZone === timeZone) {
      return dateKeysToSafeIsoRange(calendarRange.from, calendarRange.to);
    }
    const from = startOfIsoWeek(organizationDateKey(new Date(), timeZone));
    return dateKeysToSafeIsoRange(from, addDaysToDateKey(from, 6));
  }, [calendarRange.from, calendarRange.to, calendarTimeZone, timeZone]);
  const missionsQuery = useMissions(organizationId, {
    from: missionIsoRange.from,
    to: missionIsoRange.to,
    limit: 1000,
  });

  const createLeave = useCreateLeaveRequest(organizationId ?? '');
  const setLeaveStatus = useSetLeaveStatus();
  const createMission = useCreateMission();

  const holidays = useMemo(() => {
    const firstYear = Number(calendarRange.from.slice(0, 4));
    const lastYear = Number(calendarRange.to.slice(0, 4));
    const values = [];
    for (let year = firstYear; year <= lastYear; year += 1) {
      values.push(...getHolidaysForTerritory(selectedTerritory, year));
    }
    return values;
  }, [calendarRange.from, calendarRange.to, selectedTerritory]);

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
        timeZone,
      }),
    [missionsQuery.data, leavesQuery.data, holidays, timeZone],
  );

  /** Sa propre ligne de membership : la présélection naturelle d'une demande. */
  const ownMemberId =
    (membersQuery.data ?? []).find((member) => member.user_id === user?.id)?.id ?? null;

  const ownTeamIds = useMemo(
    () =>
      ownMemberId === null
        ? []
        : (membershipsQuery.data?.get(ownMemberId) ?? []).map((team) => team.id),
    [membershipsQuery.data, ownMemberId],
  );

  const teamMembersByTeam = useMemo(() => {
    const byTeam = new Map<string, MemberWithProfile[]>();
    for (const member of membersQuery.data ?? []) {
      for (const team of membershipsQuery.data?.get(member.id) ?? []) {
        const existing = byTeam.get(team.id);
        if (existing) existing.push(member);
        else byTeam.set(team.id, [member]);
      }
    }
    return byTeam;
  }, [membersQuery.data, membershipsQuery.data]);

  const handleVisibleRangeChange = useCallback(
    (range: { from: string; to: string }) => {
      setCalendarRange((current) =>
        current.from === range.from && current.to === range.to ? current : range,
      );
      setCalendarTimeZone(timeZone);
    },
    [timeZone],
  );

  const pendingLeavesCount = leaves.filter((leave) => leave.status === 'pending').length;

  const showNotification = (message: string) => {
    signalerNotification(message);
  };

  const handleAddLeave = (submission: NewLeaveSubmission) => {
    createLeave.mutate(submission, {
      onSuccess: () => {
        setIsNewLeaveOpen(false);
        successFeedback();
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

  const openMissionCreation = (date = selectedPlanningDate) => {
    const returnTo = `${location.pathname}${location.search}`;
    void navigate(
      `${ROUTES.missionNew}?date=${encodeURIComponent(date)}&from=${encodeURIComponent(returnTo)}`,
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
          scheduledStart:
            event.scheduledStart ?? zonedLocalDateTimeToIso(event.date, '09:00:00', timeZone),
          ...(event.scheduledEnd ? { scheduledEnd: event.scheduledEnd } : {}),
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
    exportEventsToICS(events, timeZone);
    showNotification('Fichier planning_rezo360.ics téléchargé.');
  };

  if (leavesQuery.isError) {
    return <ErrorState error={leavesQuery.error} onRetry={() => void leavesQuery.refetch()} />;
  }

  return (
    <div className="gestion-planning mx-auto max-w-7xl space-y-4 pb-10">
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-foreground text-xl font-extrabold tracking-tight">Planning</h1>
          {can(PERMISSIONS.missionCreate) ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => openMissionCreation()}
              className="bg-primary text-primary-foreground hover:bg-primary-hover shrink-0"
            >
              <Plus className="size-3.5" aria-hidden />
              <span>Nouvelle intervention</span>
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Organisez vos équipes, simplifiez vos journées
        </p>
      </div>

      <div className="hidden md:block">
        <PageHeader
          title="Planning"
          description="Organisez vos équipes, simplifiez vos journées"
          className="mb-2 sm:mb-4 sm:flex-col xl:flex-row"
          actions={
            <>
              {can(PERMISSIONS.missionCreate) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden md:inline-flex"
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
                className="hidden md:inline-flex"
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
                  className="border-warning/30 text-warning hover:bg-warning/10 hidden md:inline-flex"
                >
                  <Palmtree className="size-3.5" />
                  <span>Poser un congé</span>
                </Button>
              )}

              {can(PERMISSIONS.missionCreate) && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => openMissionCreation()}
                  className="bg-primary text-primary-foreground hover:bg-primary-hover"
                >
                  <Plus className="size-3.5" />
                  <span className="md:hidden">Nouvelle intervention</span>
                  <span className="hidden md:inline">Planifier</span>
                </Button>
              )}
            </>
          }
        />
      </div>

      {/* Floating Notification Toast */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="border-success-border bg-success-subtle text-success animate-in fade-in slide-in-from-top-2 flex items-center gap-2 rounded-full border p-3 text-xs font-semibold motion-reduce:animate-none"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* 2. Main Tab Navigation Bar */}
      <div
        className="no-scrollbar border-border/80 bg-surface hidden items-center gap-1 overflow-x-auto scroll-smooth rounded-2xl border p-1 shadow-xs md:flex md:gap-1.5"
        aria-label="Sections du planning"
      >
        <button
          type="button"
          onClick={() => openPlanningSection('calendar')}
          aria-pressed={activeTab === 'calendar'}
          className={cn(
            'focus-visible:ring-ring min-h-touch inline-flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full px-2 py-2 text-xs font-bold whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-0 sm:flex-initial sm:shrink sm:gap-2 sm:px-3.5 sm:text-xs',
            activeTab === 'calendar'
              ? 'bg-nav-selected text-nav-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0" />
          <span className="sm:hidden">Agenda</span>
          <span className="hidden sm:inline">Calendrier & Agenda</span>
        </button>

        <button
          type="button"
          onClick={() => openPlanningSection('leaves')}
          aria-pressed={activeTab === 'leaves'}
          className={cn(
            'focus-visible:ring-ring min-h-touch inline-flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full px-2 py-2 text-xs font-bold whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-0 sm:flex-initial sm:shrink sm:gap-2 sm:px-3.5 sm:text-xs',
            activeTab === 'leaves'
              ? 'bg-nav-selected text-nav-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <Palmtree className="size-3.5 shrink-0" />
          <span className="sm:hidden">Congés</span>
          <span className="hidden sm:inline">Congés & Absences</span>
          {pendingLeavesCount > 0 && (
            <span
              className={cn(
                'sm:text-3xs flex size-4 shrink-0 items-center justify-center rounded-full text-xs font-extrabold sm:size-5',
                activeTab === 'leaves'
                  ? 'bg-surface text-foreground'
                  : 'bg-warning-subtle text-warning',
              )}
            >
              {pendingLeavesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => openPlanningSection('recurring')}
          aria-pressed={activeTab === 'recurring'}
          className={cn(
            'focus-visible:ring-ring min-h-touch inline-flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full px-2 py-2 text-xs font-bold whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-0 sm:flex-initial sm:shrink sm:gap-2 sm:px-3.5 sm:text-xs',
            activeTab === 'recurring'
              ? 'bg-nav-selected text-nav-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <RotateCcw className="size-3.5 shrink-0" />
          <span className="sm:hidden">Tâches</span>
          <span className="hidden sm:inline">Tâches récurrentes ({tasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => openPlanningSection('holidays')}
          aria-pressed={activeTab === 'holidays'}
          className={cn(
            'focus-visible:ring-ring min-h-touch inline-flex flex-1 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full px-2 py-2 text-xs font-bold whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-0 sm:flex-initial sm:shrink sm:gap-2 sm:px-3.5 sm:text-xs',
            activeTab === 'holidays'
              ? 'bg-nav-selected text-nav-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface',
          )}
        >
          <Flag className="size-3.5 shrink-0" />
          <span className="sm:hidden">Fériés</span>
          <span className="hidden sm:inline">Jours fériés ({holidays.length})</span>
        </button>
      </div>

      {activeTab !== 'calendar' ? (
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => openPlanningSection('calendar')}
            className="border-border bg-surface size-touch flex cursor-pointer items-center justify-center rounded-xl border"
            aria-label="Retour au planning"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <div>
            <p className="text-foreground text-sm font-extrabold">
              {activeTab === 'leaves'
                ? 'Congés & absences'
                : activeTab === 'recurring'
                  ? 'Tâches récurrentes'
                  : 'Jours fériés'}
            </p>
            <p className="text-muted-foreground text-xs">Retour au planning en une interaction</p>
          </div>
        </div>
      ) : null}

      {/* 3. Tab Content Display */}
      {activeTab === 'calendar' && (
        <PlanningCalendarView
          events={events}
          leaves={leaves}
          holidays={holidays}
          members={membersQuery.data ?? []}
          teamMembersByTeam={teamMembersByTeam}
          ownMemberId={ownMemberId}
          ownTeamIds={ownTeamIds}
          canCreateMission={can(PERMISSIONS.missionCreate)}
          isLoading={missionsQuery.isPending}
          isError={missionsQuery.isError}
          onRetry={() => void missionsQuery.refetch()}
          onVisibleRangeChange={handleVisibleRangeChange}
          onOpenLeaves={() => openPlanningSection('leaves')}
          onOpenTasks={() => openPlanningSection('recurring')}
          onOpenHolidays={() => openPlanningSection('holidays')}
          onImportICS={() => setIsImportICSOpen(true)}
          onExportICS={handleExportICS}
          canImportICS={can(PERMISSIONS.missionCreate)}
          timeZone={timeZone}
          onNewMissionAtDate={(dateStr) => {
            openMissionCreation(dateStr);
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

      <ImportICSModal
        open={isImportICSOpen}
        onOpenChange={setIsImportICSOpen}
        members={membersQuery.data ?? []}
        submitting={createMission.isPending}
        timeZone={timeZone}
        onImport={(submission) => void handleImportEvents(submission)}
      />
    </div>
  );
}
