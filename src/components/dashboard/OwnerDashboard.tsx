import {
  Activity,
  ArrowRight,
  Building2,
  ClipboardCheck,
  ClipboardList,
  MapPin,
  Plus,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { ROUTES } from '@/config/routes';
import { useAuditLogs } from '@/features/audit';
import { useSeatBilling } from '@/features/billing';
import { formatNewNoun, formatNoneNoun, useLabel } from '@/features/industries';
import { useReportsPendingReview } from '@/features/interventions';
import { MissionStatusBadge, useMissions } from '@/features/missions';
import {
  AddMemberDialog,
  InviteMemberDialog,
  useCurrentOrganization,
  useMembers,
} from '@/features/organizations';
import { useTeams } from '@/features/teams';

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
  const missions = useMissions(organizationId, { limit: 6 });
  const pendingReports = useReportsPendingReview(organizationId);
  const teams = useTeams(organizationId);
  const auditLogs = useAuditLogs(organizationId, { limit: 6 });

  const activeMembersCount = (members.data ?? []).filter((m) => m.status === 'active').length;
  const pendingReportsCount = (pendingReports.data ?? []).length;
  const missionList = missions.data ?? [];
  const teamList = teams.data ?? [];
  const recentLogs = auditLogs.data ?? [];

  const raccourcis = [
    { to: ROUTES.organizationMembers, label: workerPlural, sub: 'Membres et rôles', icon: Users },
    { to: ROUTES.teams, label: 'Équipes', sub: 'Groupes de terrain', icon: UsersRound },
    { to: ROUTES.customers, label: 'Clients', sub: 'Contacts et sites', icon: Building2 },
    { to: ROUTES.organization, label: 'Paramètres', sub: 'Entreprise et métier', icon: Settings },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* ------------------------------------------------------------ EN-TÊTE */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {organization?.name ?? 'Votre entreprise'} — effectifs, {jobPlural.toLowerCase()} et
            contrôle qualité.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <Button asChild size="sm">
            <Link to={ROUTES.missionNew}>
              <Plus className="size-4" aria-hidden="true" />
              {formatNewNoun(jobSingular)}
            </Link>
          </Button>
        </div>
      </div>

      {/* Le parcours guidé, tant qu'il n'est pas bouclé. Avant les indicateurs :
          une entreprise qui n'a pas encore de mission n'a pas de KPI à lire. */}
      <FirstStepsCard />

      {/* ------------------------------------------------------ 1. CE QUI ATTEND */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Comptes rendus à valider"
          value={pendingReportsCount}
          icon={ClipboardCheck}
          to={ROUTES.review}
          actionLabel="Contrôler"
          attention={pendingReportsCount > 0}
          badge={
            pendingReportsCount > 0
              ? { text: 'En attente', variant: 'warning' }
              : { text: 'À jour', variant: 'success' }
          }
        />
        <MetricCard
          label={jobPlural}
          value={missionList.length}
          icon={ClipboardList}
          to={ROUTES.missions}
          actionLabel="Voir"
        />
        <MetricCard
          label="Équipes de terrain"
          value={teamList.length}
          icon={UsersRound}
          to={ROUTES.teams}
          actionLabel="Organiser"
        />
        <MetricCard
          label={workerPlural}
          value={activeMembersCount}
          icon={Users}
          to={ROUTES.organizationMembers}
          actionLabel="Gérer"
          badge={{ text: `${activeMembersCount} actif${activeMembersCount > 1 ? 's' : ''}` }}
        />
      </div>

      {/* ------------------------------------------ 2. LE TRAVAIL ET SON HISTOIRE */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
            {missionList.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center py-10 text-center">
                <ClipboardList className="text-subtle-foreground mb-3 size-8" aria-hidden="true" />
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
                      className="hover:bg-surface-hover -mx-2 flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors"
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

        <Card>
          <CardHeader className="border-border border-b">
            <CardTitle className="flex items-center gap-2">
              <Activity className="text-primary size-4.5" aria-hidden="true" />
              Activité récente
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-4">
            {recentLogs.length === 0 ? (
              <div className="py-8 text-center">
                <Activity className="text-subtle-foreground mx-auto mb-2 size-7" aria-hidden="true" />
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

      {/* ------------------------------------------------------- 3. RACCOURCIS */}
      <div>
        <h2 className="text-foreground mb-3 text-sm font-semibold">Accès rapide</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {raccourcis.map(({ to, label, sub, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group border-border bg-surface hover:border-border-strong hover:shadow-raised flex min-w-0 items-center gap-3 rounded-xl border p-4 transition-shadow"
            >
              <span className="bg-primary-subtle text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-sm font-semibold">{label}</span>
                <span className="text-muted-foreground block truncate text-sm">{sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
