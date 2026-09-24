import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
  MapPin,
  Plus,
  Users,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { useAuditLogs } from '@/features/audit';
import { useSeatBilling } from '@/features/billing';
import { formatNewNoun, formatNoneNoun, useLabel } from '@/features/industries';
import { useReportsPendingReview } from '@/features/interventions';
import { MissionStatusBadge, useMissionStatusCounts, useMissions } from '@/features/missions';
import {
  AddMemberDialog,
  InviteMemberDialog,
  useCurrentOrganization,
  useMembers,
} from '@/features/organizations';
import { useTeams } from '@/features/teams';
import { cn } from '@/lib/cn';

import { FirstStepsCard } from './FirstStepsCard';

/**
 * Tableau de bord — direction et propriétaire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * L'ORDRE RÉPOND À UNE QUESTION, PAS À UN ORGANIGRAMME
 *
 * « Qu'est-ce qui m'attend ? », puis « où en sont les chantiers ? », puis « qui
 * a fait quoi ? ». Les indicateurs qui n'appellent aucune action passent
 * derrière : un chiffre qu'on ne peut pas actionner n'est pas une priorité de
 * haut d'écran.
 *
 * CE QUI A ÉTÉ RETIRÉ
 *
 * Une barre de progression affichait un pourcentage INVENTÉ, dérivé du seul
 * statut (`completed → 100 %`, `in_progress → 65 %`, sinon `25 %`). Elle
 * donnait à un dirigeant une information chiffrée qui ne mesurait rien. Le
 * statut est déjà porté par son badge : la barre n'ajoutait que de la fausse
 * précision.
 *
 * Les huit cartes recopiées à la main (quatre indicateurs, quatre raccourcis)
 * sont devenues des `MetricCard` et des liens de raccourci partagés.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function OwnerDashboard() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const jobPlural = useLabel('job', true);
  const jobSingular = useLabel('job');
  const workerPlural = useLabel('worker', true);

  const sieges = useSeatBilling(organizationId);
  const members = useMembers(organizationId);
  const missions = useMissions(organizationId, { limit: 12 });
  const missionStatusCounts = useMissionStatusCounts(organizationId);
  const pendingReports = useReportsPendingReview(organizationId);
  const teams = useTeams(organizationId);
  const auditLogs = useAuditLogs(organizationId, { limit: 6 });

  const activeMembersCount = (members.data ?? []).filter((m) => m.status === 'active').length;
  const pendingReportsCount = (pendingReports.data ?? []).length;
  const missionList = missions.data ?? [];
  const missionCount = Object.values(missionStatusCounts.data ?? {}).reduce(
    (total, count) => total + count,
    0,
  );
  const teamList = teams.data ?? [];
  const recentLogs = auditLogs.data ?? [];

  const raccourcis = [
    {
      to: ROUTES.organizationMembers,
      label: workerPlural,
      subject: 'technicians',
      tone: 'border-primary/20 bg-primary-subtle/70',
    },
    {
      to: ROUTES.teams,
      label: 'Équipes',
      subject: 'teams',
      tone: 'border-success-border bg-success-subtle',
    },
    {
      to: ROUTES.customers,
      label: 'Clients',
      subject: 'customers',
      tone: 'border-warning-border bg-warning-subtle',
    },
    {
      to: ROUTES.review,
      label: 'Comptes rendus',
      subject: 'reports',
      tone: 'border-info-border bg-info-subtle',
    },
  ] as const;

  return (
    <div className="space-y-4 pb-8 sm:space-y-6">
      {/* ------------------------------------------------------------ EN-TÊTE */}
      <PageHeader
        title="Tableau de bord"
        description={`${organization?.name ?? 'Votre entreprise'} — effectifs, ${jobPlural.toLowerCase()} et contrôle qualité.`}
        className="mb-2 gap-3 sm:mb-0 sm:flex-col xl:flex-row"
        actions={
          <div className="grid w-full grid-cols-2 gap-2 pb-1 sm:flex sm:w-auto sm:flex-wrap sm:pb-0">
            {organizationId ? (
              <>
                {/* Les mêmes valeurs que sur l'écran des membres : un raccourci
                  qui tairait le coût d'un siège supplémentaire ferait de ce
                  bouton le chemin le moins informé vers la même dépense. */}
                <AddMemberDialog
                  organizationId={organizationId}
                  viewerIsOwner={true}
                  quotaReached={sieges.quotaBlocked}
                  isExtraSeat={sieges.isExtraSeat}
                  onMemberAdded={() => {
                    void members.refetch();
                  }}
                />
                <InviteMemberDialog
                  organizationId={organizationId}
                  viewerIsOwner={true}
                  quotaReached={false}
                />
              </>
            ) : null}

            <Button asChild size="sm" className="col-span-2 w-full sm:w-auto">
              <Link to={ROUTES.missionNew}>
                <Plus className="size-4" aria-hidden="true" />
                {formatNewNoun(jobSingular)}
              </Link>
            </Button>
          </div>
        }
      />

      {/* Le parcours guidé, tant qu'il n'est pas bouclé. Avant les indicateurs :
          une entreprise qui n'a pas encore de mission n'a pas de KPI à lire. */}
      <FirstStepsCard />

      {/* ------------------------------------------------------ 1. CE QUI ATTEND */}
      <section
        aria-label="Indicateurs clés"
        className="plan-metrics border-border bg-surface grid grid-cols-2 overflow-hidden rounded-lg border lg:grid-cols-4"
      >
        <MetricCard
          layout="strip"
          compact
          label="Comptes rendus à valider"
          value={pendingReports.isPending || pendingReports.isError ? '—' : pendingReportsCount}
          icon={ClipboardCheck}
          to={ROUTES.review}
          actionLabel="Contrôler"
          attention={
            !pendingReports.isPending && !pendingReports.isError && pendingReportsCount > 0
          }
          badge={
            pendingReports.isPending
              ? { text: 'Chargement', variant: 'neutral' }
              : pendingReports.isError
                ? { text: 'Indisponible', variant: 'neutral' }
                : pendingReportsCount > 0
                  ? { text: 'En attente', variant: 'warning' }
                  : { text: 'À jour', variant: 'success' }
          }
          className="border-b lg:border-r lg:border-b-0"
        />
        <MetricCard
          layout="strip"
          compact
          label={jobPlural}
          value={missionStatusCounts.isPending || missionStatusCounts.isError ? '—' : missionCount}
          icon={ClipboardList}
          to={ROUTES.missions}
          actionLabel="Voir"
          className="border-r-0 border-b lg:border-r lg:border-b-0"
        />
        <MetricCard
          layout="strip"
          compact
          label="Équipes de terrain"
          value={teams.isPending || teams.isError ? '—' : teamList.length}
          icon={UsersRound}
          to={ROUTES.teams}
          actionLabel="Organiser"
          className="lg:border-r"
        />
        <MetricCard
          layout="strip"
          compact
          label={workerPlural}
          value={members.isPending || members.isError ? '—' : activeMembersCount}
          icon={Users}
          to={ROUTES.organizationMembers}
          actionLabel="Gérer"
          className="border-r-0"
          {...(members.isPending
            ? { badge: { text: 'Chargement', variant: 'neutral' as const } }
            : members.isError
              ? { badge: { text: 'Indisponible', variant: 'neutral' as const } }
              : {})}
        />
      </section>

      {/* Les raccourcis illustrés reprennent les visuels des états vides : le
          dessin identifie le module avant même la lecture du libellé. */}
      <section aria-labelledby="dashboard-quick-access-title">
        <h2
          id="dashboard-quick-access-title"
          className="text-foreground mb-2 text-sm font-bold sm:mb-3"
        >
          Accès rapide
        </h2>
        <Card className="p-2 sm:p-3">
          <nav
            aria-label="Accès rapide du tableau de bord"
            className="grid grid-cols-4 gap-1.5 sm:gap-3"
          >
            {raccourcis.map(({ to, label, subject, tone }) => (
              <Link
                key={to}
                to={to}
                className="group focus-visible:ring-ring hover:bg-surface-hover flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-0.5 py-1.5 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-2 sm:py-2"
              >
                <span
                  className={cn(
                    'flex size-14 items-center justify-center overflow-hidden rounded-2xl border sm:size-16',
                    tone,
                  )}
                >
                  <AtelierIllustration
                    subject={subject}
                    className="w-16 max-w-none transition-transform duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100 sm:w-[4.5rem]"
                  />
                </span>
                <span className="text-foreground line-clamp-2 text-xs leading-tight font-bold">
                  {label}
                </span>
              </Link>
            ))}
          </nav>
        </Card>
      </section>

      {/* ------------------------------------------ 2. LE TRAVAIL ET SON HISTOIRE */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="border-border flex flex-row items-center justify-between border-b">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="text-primary size-4.5" aria-hidden="true" />
              {jobPlural} récentes
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to={ROUTES.missions}>
                Voir tout
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="pt-4">
            {missions.isPending ? (
              <ListSkeleton rows={4} />
            ) : missions.isError ? (
              <ErrorState
                error={missions.error}
                onRetry={() => {
                  void missions.refetch();
                }}
              />
            ) : missionList.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center py-6 text-center sm:py-8">
                <AtelierIllustration subject="missions" className="mb-1 w-28 sm:w-36" />
                <p className="text-foreground text-sm font-medium">
                  {formatNoneNoun(jobSingular, 'enregistré')}
                </p>
                <p className="mt-1 text-sm">Créez la première pour lancer le suivi.</p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link to={ROUTES.missionNew}>
                    <Plus className="size-3.5" aria-hidden="true" />
                    {formatNewNoun(jobSingular)}
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {missionList.map((m) => (
                  <li key={m.id}>
                    <Link
                      to={ROUTES.mission(m.id)}
                      className="plan-row plan-row-sm hover:bg-surface-hover -mx-2 flex flex-wrap items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="shrink-0 font-mono">
                            {m.reference}
                          </Badge>
                          <span className="text-foreground truncate text-sm font-semibold">
                            {m.title}
                          </span>
                        </div>

                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          {m.customer !== null ? <span>{m.customer.name}</span> : null}
                          {m.site !== null ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                              {m.site.name}
                              {m.site.city ? ` (${m.site.city})` : ''}
                            </span>
                          ) : null}
                          {m.assigned_team !== null ? (
                            <span className="flex items-center gap-1.5">
                              <span
                                aria-hidden="true"
                                className="size-2 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    m.assigned_team.color ?? 'var(--color-border-strong)',
                                }}
                              />
                              {m.assigned_team.name}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <MissionStatusBadge status={m.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader className="border-border border-b">
            <CardTitle className="flex items-center gap-2">
              <Activity className="text-primary size-4.5" aria-hidden="true" />
              Activité récente
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-4">
            {auditLogs.isPending ? (
              <ListSkeleton rows={4} />
            ) : auditLogs.isError ? (
              <ErrorState
                error={auditLogs.error}
                onRetry={() => {
                  void auditLogs.refetch();
                }}
              />
            ) : recentLogs.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <AtelierIllustration subject="audit" className="mb-1 w-24 sm:w-28" />
                <p className="text-muted-foreground text-sm">Aucune activité récente</p>
                <p className="text-subtle-foreground mt-1 text-sm">
                  Les actions de vos équipes apparaîtront ici.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {recentLogs.map((log) => (
                  <li key={log.id} className="flex items-start gap-3">
                    <span
                      className="bg-primary-subtle mt-1.5 size-2 shrink-0 rounded-full"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground text-sm leading-snug">{log.action}</p>
                      <time className="text-muted-foreground text-sm" dateTime={log.created_at}>
                        {new Date(log.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
