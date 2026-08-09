import { ArrowLeft, ClipboardList, KeyRound, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  AssignMissionDialog,
  MISSION_STATUS_LABELS,
  MissionPriorityBadge,
  MissionStatusBadge,
  MissionTransitions,
  useMission,
  useMissionHistory,
} from '@/features/missions';
import { MissionInterventionsPanel } from '@/features/interventions';
import {
  memberDisplayName,
  PERMISSIONS,
  useCurrentOrganization,
  useMembers,
  usePermission,
} from '@/features/organizations';
import { useTeams } from '@/features/teams';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function MissionDetailPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const { organization, membership } = useCurrentOrganization();
  const { can, role } = usePermission();

  const mission = useMission(missionId);
  const history = useMissionHistory(missionId);
  const teams = useTeams(organization?.id ?? null);
  const members = useMembers(organization?.id ?? null);

  useDocumentTitle(mission.data?.reference ?? 'Mission');

  if (mission.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (mission.isError) {
    return (
      <ErrorState
        error={mission.error}
        onRetry={() => {
          void mission.refetch();
        }}
      />
    );
  }

  if (mission.data === null || missionId === undefined) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Mission introuvable"
        description="Cette mission n’existe pas, ou ne vous est pas accessible."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.missions}>Retour aux missions</Link>
          </Button>
        }
      />
    );
  }

  const data = mission.data;

  /**
   * Qualité d'intervenant, reproduisant `app.is_mission_assignee()`.
   *
   * Deux voies, comme côté serveur : être nommément désigné, OU appartenir à
   * l'équipe affectée. Ne retenir que la première masquerait ses actions à un
   * membre d'équipe qui, lui, a bien le droit de les déclencher.
   */
  const myMemberId = membership?.id ?? null;
  const isNamedAssignee = myMemberId !== null && data.assigned_user_id === myMemberId;
  const isInAssignedTeam =
    data.assigned_team_id !== null &&
    (teams.data ?? []).some((team) => team.id === data.assigned_team_id);
  const isAssignee = isNamedAssignee || isInAssignedTeam;

  const canAssign = can(PERMISSIONS.missionAssign);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={ROUTES.missions}>
          <ArrowLeft className="size-4" />
          Missions
        </Link>
      </Button>

      <PageHeader
        title={data.title}
        {...(data.description !== null && data.description !== ''
          ? { description: data.description }
          : {})}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{data.reference}</Badge>
            <MissionPriorityBadge priority={data.priority} />
            <MissionStatusBadge status={data.status} />

            {canAssign ? (
              <AssignMissionDialog
                missionId={data.id}
                teams={teams.data ?? []}
                members={members.data ?? []}
                currentTeamId={data.assigned_team_id}
                currentMemberId={data.assigned_user_id}
              />
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Avancement</CardTitle>
        </CardHeader>
        <CardContent>
          <MissionTransitions mission={data} role={role} isAssignee={isAssignee} />
        </CardContent>
      </Card>

      {/*
        Le maillon entre la mission et le travail réel. Sans lui, la machine à
        états avançait mais aucune intervention n'existait — le chronomètre et
        le compte rendu restaient inatteignables.
      */}
      <Card>
        <CardHeader>
          <CardTitle>Interventions</CardTitle>
        </CardHeader>
        <CardContent>
          <MissionInterventionsPanel
            missionId={data.id}
            missionStatus={data.status}
            myMemberId={myMemberId}
            isAssignee={isAssignee}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lieu et client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.customer !== null ? (
              <Link
                to={ROUTES.customer(data.customer.id)}
                className="text-primary block text-sm hover:underline"
              >
                {data.customer.name} · {data.customer.reference}
              </Link>
            ) : (
              <p className="text-muted-foreground text-sm">
                {/*
                  Le nom figé sur la mission, quand aucune fiche n'est rattachée.
                  C'est l'instantané pris à la création, et il ne bouge plus.
                */}
                {data.customer_name ?? 'Aucun client rattaché'}
              </p>
            )}

            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {[data.location_label, data.address_line1, data.postal_code, data.city]
                  .filter((part) => part !== null && part !== '')
                  .join(', ') || 'Adresse non renseignée'}
              </span>
            </p>

            {data.site?.access_notes !== null && data.site?.access_notes !== undefined ? (
              <div className="bg-surface-sunken flex gap-2 rounded-md p-2">
                <KeyRound
                  className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-muted-foreground text-xs whitespace-pre-line">
                  {data.site.access_notes}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Affectation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Équipe</p>
              <p className="text-foreground">
                {data.assigned_team !== null ? (
                  <Link to={ROUTES.team(data.assigned_team.id)} className="hover:underline">
                    {data.assigned_team.name}
                  </Link>
                ) : (
                  <span className="text-subtle-foreground">Aucune</span>
                )}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">Intervenant</p>
              <p className="text-foreground">
                {data.assigned_member !== null ? (
                  memberDisplayName(data.assigned_member)
                ) : (
                  <span className="text-subtle-foreground">Aucun</span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground text-xs">Début prévu</p>
                <p className="text-foreground font-mono text-xs tabular-nums">
                  {data.scheduled_start !== null
                    ? new Date(data.scheduled_start).toLocaleString('fr-FR')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Début réel</p>
                <p className="text-foreground font-mono text-xs tabular-nums">
                  {data.actual_start !== null
                    ? new Date(data.actual_start).toLocaleString('fr-FR')
                    : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isPending ? (
            <ListSkeleton />
          ) : (history.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-xs">Aucun changement d’état enregistré.</p>
          ) : (
            /*
              Écrit par le trigger `enforce_mission_transition`, jamais par le
              client : aucun chemin applicatif ne permet d'y insérer une ligne
              complaisante. C'est ce qui rend cet historique opposable.
            */
            <ul className="divide-border divide-y">
              {(history.data ?? []).map((event) => (
                <li key={event.id} className="flex items-center gap-3 py-2 text-xs">
                  <span className="text-subtle-foreground font-mono tabular-nums">
                    {new Date(event.created_at).toLocaleString('fr-FR')}
                  </span>
                  <span className="text-muted-foreground">
                    {event.from_status !== null
                      ? `${MISSION_STATUS_LABELS[event.from_status]} → `
                      : ''}
                    <span className="text-foreground font-medium">
                      {MISSION_STATUS_LABELS[event.to_status]}
                    </span>
                  </span>
                  {event.reason !== null ? (
                    <span className="text-muted-foreground">— {event.reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
