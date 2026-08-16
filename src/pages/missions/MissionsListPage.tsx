import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutList,
  MapPin,
  Plus,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLabel } from '@/features/industries';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  countActiveFilters,
  EMPTY_MISSION_FILTERS,
  MissionFiltersBar,
  MissionPriorityBadge,
  MissionStatusBadge,
  MISSION_STATUS_LABELS,
  toMissionQuery,
  useMissionStatusCounts,
  useMissions,
} from '@/features/missions';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { MissionStatus } from '@/types/database';
import type { MissionWithRelations } from '@/types/domain';

type ViewMode = 'list' | 'week' | 'month';

export default function MissionsListPage() {
  useDocumentTitle('Missions & Planning');

  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [filters, setFilters] = useState(EMPTY_MISSION_FILTERS);

  // State pour la modale d'inspection des missions d'un jour précis
  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    missions: MissionWithRelations[];
  } | null>(null);

  const missions = useMissions(organizationId, toMissionQuery(filters));
  const statusCounts = useMissionStatusCounts(organizationId);
  // « Missions » chez un fibreur, « Chantiers » chez un paysagiste.
  const jobPlural = useLabel('job', true);

  const canCreate = can(PERMISSIONS.missionCreate);
  const canViewAll = can(PERMISSIONS.missionViewAll);
  const activeFilters = countActiveFilters(filters);
  const list = missions.data ?? [];

  /**
   * États réellement peuplés, hors celui déjà sélectionné.
   *
   * Triés par ordre du cycle de vie plutôt que par volume : on cherche « où en
   * est mon travail », pas « quel tas est le plus gros ».
   */
  const counts: Record<string, number> = statusCounts.data ?? {};
  const elsewhere = (Object.keys(MISSION_STATUS_LABELS) as MissionStatus[])
    .filter((status) => (counts[status] ?? 0) > 0 && status !== filters.status)
    .map((status) => [status, counts[status] ?? 0] as const);

  // --- LOGIQUE SEMAINE (6 jours : LUN-SAM) ---
  const baseMonday = new Date(2026, 7, 10);
  baseMonday.setDate(baseMonday.getDate() + weekOffset * 7);

  const dayNamesWeek = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
  const daysOfWeek = dayNamesWeek.map((label, index) => {
    const d = new Date(baseMonday);
    d.setDate(baseMonday.getDate() + index);
    return {
      key: `day-${index}-${d.getTime()}`,
      label,
      dateStr: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      dayNum: d.getDate(),
      fullDate: d,
    };
  });

  // --- LOGIQUE MOIS (Grille mensuelle 7x5) ---
  const targetMonthDate = new Date(2026, 7 + monthOffset, 1);
  const monthYearLabel = targetMonthDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  const getMonthGridCells = () => {
    const year = targetMonthDate.getFullYear();
    const month = targetMonthDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const totalDays = lastDay.getDate();
    const cells = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
      cells.push({ date: prevDate, isCurrentMonth: false });
    }

    for (let i = 1; i <= totalDays; i++) {
      const currDate = new Date(year, month, i);
      cells.push({ date: currDate, isCurrentMonth: true });
    }

    const totalCellCount = cells.length > 35 ? 42 : 35;
    let nextMonthDay = 1;
    while (cells.length < totalCellCount) {
      const nextDate = new Date(year, month + 1, nextMonthDay++);
      cells.push({ date: nextDate, isCurrentMonth: false });
    }

    return cells;
  };

  const monthGridCells = getMonthGridCells();

  const getMissionsForDate = (targetDate: Date) => {
    return list.filter((m) => {
      if (!m.scheduled_start) return false;
      const d = new Date(m.scheduled_start);
      return (
        d.getDate() === targetDate.getDate() &&
        d.getMonth() === targetDate.getMonth() &&
        d.getFullYear() === targetDate.getFullYear()
      );
    });
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title={`${jobPlural} & Planning`}
        description={
          canViewAll
            ? 'Pilotage des interventions de l’entreprise en vue Liste, Semaine ou Calendrier Mensuel.'
            : 'Vos interventions affectées et votre planning du jour.'
        }
        actions={
          <div className="flex items-center gap-3">
            {/* 3-Way Switcher : Liste / Semaine / Mois */}
            <div className="border-border bg-surface scroll-x flex w-full items-center rounded-lg border p-1 shadow-xs sm:w-auto">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex min-h-touch cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1 ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutList className="size-3.5" />
                Liste
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`flex min-h-touch cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1 ${
                  viewMode === 'week'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarIcon className="size-3.5" />
                Semaine
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`flex min-h-touch cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors sm:min-h-0 sm:py-1 ${
                  viewMode === 'month'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarDays className="size-3.5" />
                Calendrier Mensuel
              </button>
            </div>

            {canCreate ? (
              <Button asChild variant="primary" size="sm">
                <Link to={ROUTES.missionNew}>
                  <Plus className="size-4" />
                  Nouvelle mission
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Bannière de guidage pour les comptes-rendus */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center justify-between gap-3 text-xs text-foreground">
        <div className="flex items-center gap-2.5">
          <FileText className="size-4 shrink-0 text-primary" />
          <span>
            <strong>Rédaction des comptes-rendus :</strong> Sélectionnez une mission ci-dessous, démarrez l’intervention pour enregistrer le chronomètre et rédiger votre compte-rendu terrain.
          </span>
        </div>
      </div>

      <MissionFiltersBar
        organizationId={organizationId}
        value={filters}
        onChange={setFilters}
        showAdvanced={canViewAll}
      />

      {missions.isPending ? (
        <ListSkeleton />
      ) : missions.isError ? (
        <ErrorState
          error={missions.error}
          onRetry={() => {
            void missions.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <div className="space-y-4">
        <EmptyState
          icon={ClipboardList}
          title={activeFilters === 0 ? 'Aucune mission en cours' : 'Aucun résultat'}
          action={
            activeFilters > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilters(EMPTY_MISSION_FILTERS);
                }}
              >
                Réinitialiser les filtres
              </Button>
            ) : null
          }
          description={
            activeFilters > 0
              ? 'Aucune mission ne correspond à ces critères.'
              : canCreate
                ? 'Créez une mission pour l’affecter à une équipe et suivre son avancement.'
                : 'Aucune intervention ne vous est confiée pour le moment.'
          }
        />
        {/*
            Où sont les missions, alors ?

            « Aucun résultat » est exact et muet : il ne dit pas si l'entreprise
            n'en a aucune, ou si les onze qu'elle compte sont simplement dans un
            autre état. L'utilisateur conclut à une panne là où il suffisait de
            changer de filtre — d'autant que la liste masque les états terminaux
            par défaut.

            Chaque pastille bascule directement sur l'état correspondant.
          */}
        {elsewhere.length > 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">Vos missions se trouvent ici :</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {elsewhere.map(([status, count]) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setFilters({ ...EMPTY_MISSION_FILTERS, status });
                    }}
                    className="border-border bg-surface hover:border-primary/50 hover:text-foreground text-muted-foreground cursor-pointer rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors"
                  >
                    {MISSION_STATUS_LABELS[status]} · {count}
                  </button>
                ))}
              </div>
            </div>
        ) : null}
        </div>
      ) : viewMode === 'list' ? (
        /* 📋 VUE 1 : LISTE ADMINISTRATIVE */
        <ul className="divide-border divide-y border-t border-border">
          {list.map((mission) => (
            <li key={mission.id}>
              <Link
                to={ROUTES.mission(mission.id)}
                className="hover:bg-surface-hover -mx-2 block rounded-md px-2 py-3 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{mission.reference}</Badge>
                  <MissionPriorityBadge priority={mission.priority} />
                  <MissionStatusBadge status={mission.status} />

                  <span className="text-subtle-foreground ml-auto shrink-0 font-mono text-xs tabular-nums">
                    {mission.scheduled_start !== null
                      ? new Date(mission.scheduled_start).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>

                <p className="text-foreground mt-1.5 truncate text-sm font-medium">
                  {mission.title}
                </p>

                <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {mission.customer !== null ? <span>{mission.customer.name}</span> : null}

                  {mission.site !== null ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3 shrink-0" aria-hidden="true" />
                      {mission.site.name}
                    </span>
                  ) : null}

                  {mission.assigned_team !== null ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            mission.assigned_team.color ?? 'var(--color-border-strong)',
                        }}
                      />
                      {mission.assigned_team.name}
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : viewMode === 'week' ? (
        /* 📅 VUE 2 : PLANNING HEBDOMADAIRE (6 jours) */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-5 text-primary" />
              <span className="text-foreground font-bold text-sm">
                Planning — Du {daysOfWeek[0]?.dateStr} au {daysOfWeek[5]?.dateStr} 2026
              </span>
              {weekOffset !== 0 ? (
                <Badge variant="outline" className="text-2xs font-mono">
                  {weekOffset > 0 ? `+${weekOffset} sem.` : `${weekOffset} sem.`}
                </Badge>
              ) : (
                <Badge variant="success" className="text-2xs">
                  Semaine actuelle
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setWeekOffset((w) => w - 1)}
              >
                <ChevronLeft className="size-3.5 mr-1" /> Sem. Précédente
              </Button>
              <Button
                variant={weekOffset === 0 ? 'primary' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setWeekOffset(0)}
              >
                Aujourd'hui
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setWeekOffset((w) => w + 1)}
              >
                Sem. Suivante <ChevronRight className="size-3.5 ml-1" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {daysOfWeek.map((day) => {
              const dayMissions = getMissionsForDate(day.fullDate);
              const isToday = weekOffset === 0 && day.fullDate.getDate() === 10;

              return (
                <div
                  key={day.key}
                  className={`rounded-xl border flex flex-col min-h-[340px] transition-colors ${
                    isToday ? 'border-primary/50 bg-primary/5 shadow-xs' : 'border-border bg-surface'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between p-3 border-b text-xs font-bold ${
                      isToday
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border text-foreground'
                    }`}
                  >
                    <span>{day.label}</span>
                    <span className="font-mono">{day.dateStr}</span>
                  </div>

                  <div className="p-2 space-y-2 flex-1">
                    {dayMissions.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-subtle-foreground text-2xs italic py-8 text-center">
                        Aucune intervention
                      </div>
                    ) : (
                      dayMissions.map((m) => (
                        <Link
                          key={m.id}
                          to={ROUTES.mission(m.id)}
                          className="group block rounded-lg border border-border bg-surface p-3 shadow-xs hover:border-primary/50 hover:bg-surface-hover transition-all space-y-2"
                        >
                          <div className="flex items-center justify-between gap-1 text-2xs">
                            <span className="font-mono font-medium text-foreground">
                              {m.scheduled_start !== null
                                ? new Date(m.scheduled_start).toLocaleTimeString('fr-FR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '08:00'}
                            </span>
                            <MissionStatusBadge status={m.status} />
                          </div>

                          <p className="text-foreground font-semibold text-xs leading-snug group-hover:text-primary transition-colors break-words">
                            {m.title}
                          </p>

                          <div className="text-muted-foreground text-2xs flex items-center gap-1">
                            <Building2Icon className="size-3 shrink-0" />
                            <span className="truncate">{m.customer?.name ?? 'Client'}</span>
                          </div>

                          {m.assigned_team ? (
                            <div className="flex items-center gap-1.5 text-3xs text-subtle-foreground pt-1.5 border-t border-border/50">
                              <span
                                className="size-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    m.assigned_team.color ?? 'var(--color-border-strong)',
                                }}
                              />
                              <span className="truncate font-medium">{m.assigned_team.name}</span>
                            </div>
                          ) : null}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 🗓️ VUE 3 : CALENDRIER MENSUEL (MULTIPLE MISSIONS PAR JOUR) */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-5 text-primary" />
              <span className="text-foreground font-bold text-sm capitalize">
                Calendrier Mensuel — {monthYearLabel}
              </span>
              {monthOffset !== 0 ? (
                <Badge variant="outline" className="text-2xs font-mono">
                  {monthOffset > 0 ? `+${monthOffset} mois` : `${monthOffset} mois`}
                </Badge>
              ) : (
                <Badge variant="success" className="text-2xs">
                  Mois actuel
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setMonthOffset((m) => m - 1)}
              >
                <ChevronLeft className="size-3.5 mr-1" /> Mois Précédent
              </Button>
              <Button
                variant={monthOffset === 0 ? 'primary' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setMonthOffset(0)}
              >
                Mois Actuel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setMonthOffset((m) => m + 1)}
              >
                Mois Suivant <ChevronRight className="size-3.5 ml-1" />
              </Button>
            </div>
          </div>

          <Card className="border border-border shadow-md overflow-hidden">
            <CardContent className="p-0">
              {/*
                Sept colonnes tiennent toujours dans la largeur : on ne fait pas
                défiler un mois horizontalement, on allège chaque case. En
                dessous de `md`, l'initiale suffit — « L M M J V S D » se lit
                aussi bien que les abrégés et libère 40 % de la largeur.
              */}
              <div className="border-border bg-surface-subtle text-foreground grid grid-cols-7 border-b text-center text-2xs font-bold sm:text-xs">
                {[
                  { short: 'L', long: 'Lun' },
                  { short: 'M', long: 'Mar' },
                  { short: 'M', long: 'Mer' },
                  { short: 'J', long: 'Jeu' },
                  { short: 'V', long: 'Ven' },
                  { short: 'S', long: 'Sam' },
                  { short: 'D', long: 'Dim' },
                ].map((day) => (
                  <div
                    key={day.long}
                    className="border-border border-r py-2 tracking-wider uppercase last:border-r-0 sm:py-3"
                  >
                    <span className="md:hidden">{day.short}</span>
                    <span className="hidden md:inline">{day.long}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 divide-x divide-y divide-border bg-surface/50">
                {monthGridCells.map((cell, idx) => {
                  const dayMissions = getMissionsForDate(cell.date);
                  const isToday =
                    cell.date.getDate() === 10 &&
                    cell.date.getMonth() === 7 &&
                    cell.date.getFullYear() === 2026;

                  const visibleMissions = dayMissions.slice(0, 2);
                  const remainingCount = dayMissions.length - visibleMissions.length;

                  return (
                    /*
                      Une case est un bouton, pas un `div` cliquable.

                      Elle ouvre le détail de la journée : le clavier et les
                      lecteurs d'écran doivent pouvoir le faire aussi. Elle est
                      désactivée quand la journée est vide, ce qui supprime au
                      passage le curseur « main » trompeur.

                      Hauteur : 140 px porte deux fiches de mission, ce qui
                      demande une colonne d'au moins 110 px — impossible à sept
                      sur un téléphone. En dessous de `md` la case se réduit à
                      une pastille de comptage, et l'appui ouvre la liste
                      complète du jour dans la modale qui existe déjà.
                    */
                    <button
                      key={idx}
                      type="button"
                      disabled={dayMissions.length === 0}
                      aria-label={`${cell.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} — ${dayMissions.length} mission${dayMissions.length > 1 ? 's' : ''}`}
                      onClick={() => {
                        if (dayMissions.length > 0) {
                          setSelectedDay({ date: cell.date, missions: dayMissions });
                        }
                      }}
                      className={`flex min-h-touch flex-col justify-between p-1.5 text-left transition-colors sm:min-h-[96px] md:min-h-[140px] md:p-2 ${
                        dayMissions.length > 0 ? 'cursor-pointer' : ''
                      } ${
                        !cell.isCurrentMonth
                          ? 'bg-surface-subtle/30 opacity-40'
                          : isToday
                            ? 'bg-primary/5 ring-2 ring-inset ring-primary/50'
                            : 'bg-surface hover:bg-surface-hover/60'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1">
                        <span
                          className={`text-xs font-mono font-bold ${
                            isToday
                              ? 'flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs'
                              : cell.isCurrentMonth
                                ? 'text-foreground'
                                : 'text-subtle-foreground/50'
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>

                        {dayMissions.length > 0 ? (
                          <span className="bg-primary/10 text-primary border-primary/20 rounded-full border px-1.5 py-0.5 text-3xs font-semibold">
                            {dayMissions.length}
                            <span className="hidden md:inline">
                              {' '}
                              mission{dayMissions.length > 1 ? 's' : ''}
                            </span>
                          </span>
                        ) : null}
                      </div>

                      {/* Interventions du Jour */}
                      <div className="mt-1 hidden flex-1 space-y-1.5 md:block">
                        {visibleMissions.map((m) => (
                          <Link
                            key={m.id}
                            to={ROUTES.mission(m.id)}
                            onClick={(e) => e.stopPropagation()}
                            title={`${m.reference} — ${m.title} (${m.customer?.name ?? 'Client'})`}
                            className="group block rounded-lg border border-border bg-surface-hover/80 hover:bg-surface p-2 shadow-2xs hover:border-primary/50 hover:shadow-xs transition-all leading-snug"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className="size-2 rounded-full shrink-0"
                                    style={{
                                      backgroundColor:
                                        m.assigned_team?.color ?? 'var(--color-primary)',
                                    }}
                                  />
                                  <span className="font-mono text-3xs text-subtle-foreground font-medium">
                                    {m.reference}
                                  </span>
                                </span>
                                <Badge
                                  variant={
                                    m.status === 'completed'
                                      ? 'success'
                                      : m.status === 'in_progress'
                                        ? 'primary'
                                        : 'outline'
                                  }
                                  className="text-3xs py-0 px-1 shrink-0"
                                >
                                  {m.status === 'completed'
                                    ? 'Fait'
                                    : m.status === 'in_progress'
                                      ? 'En cours'
                                      : 'Prévu'}
                                </Badge>
                              </div>

                              <p className="text-foreground font-semibold text-xs group-hover:text-primary transition-colors break-words">
                                {m.title}
                              </p>

                              {m.customer ? (
                                <p className="text-muted-foreground text-2xs truncate">
                                  {m.customer.name}
                                </p>
                              ) : null}
                            </div>
                          </Link>
                        ))}

                        {/* Bouton "+ N autres missions" pour ouvrir le détail complet de la journée */}
                        {remainingCount > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDay({ date: cell.date, missions: dayMissions });
                            }}
                            className="w-full text-left rounded-md border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 px-2 py-1 text-3xs font-semibold text-primary transition-colors flex items-center justify-between"
                          >
                            <span>+ {remainingCount} autre{remainingCount > 1 ? 's' : ''}</span>
                            <span>Voir ➔</span>
                          </button>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODALE D'INSPECTION DE TOUTES LES MISSIONS D'UN JOUR DÉSIGNÉ */}
      <Modal
        open={selectedDay !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDay(null);
        }}
        title={
          selectedDay !== null
            ? `Interventions du ${selectedDay.date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}`
            : 'Interventions du jour'
        }
        description={
          selectedDay !== null
            ? `${selectedDay.missions.length} mission(s) planifiée(s) pour cette journée.`
            : ''
        }
      >
        {selectedDay !== null ? (
          <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto pr-1">
            {selectedDay.missions.map((m) => (
              <Link
                key={m.id}
                to={ROUTES.mission(m.id)}
                className="group flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 hover:border-primary/50 hover:bg-surface-hover transition-all shadow-xs"
                onClick={() => setSelectedDay(null)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-2xs">
                      {m.reference}
                    </Badge>
                    <MissionPriorityBadge priority={m.priority} />
                  </div>
                  <MissionStatusBadge status={m.status} />
                </div>

                <div>
                  <p className="text-foreground font-semibold text-sm group-hover:text-primary transition-colors">
                    {m.title}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {m.customer?.name ?? 'Client'} {m.site ? `• ${m.site.name}` : ''}
                  </p>
                </div>

                {m.assigned_team ? (
                  <div className="flex items-center gap-2 text-xs text-subtle-foreground pt-2 border-t border-border/50">
                    <span
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor:
                          m.assigned_team.color ?? 'var(--color-border-strong)',
                      }}
                    />
                    <span>{m.assigned_team.name}</span>
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Building2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}
