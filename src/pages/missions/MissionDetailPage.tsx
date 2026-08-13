import {
  ArrowLeft,
  ClipboardList,
  KeyRound,
  MapPin,
  Navigation,
  Phone,
  Trash2,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  AssignMissionDialog,
  MISSION_STATUS_LABELS,
  MissionEditDialog,
  MissionPriorityBadge,
  MissionStatusBadge,
  MissionTransitions,
  useDeleteMission,
  useMission,
  useMissionAssignments,
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
import type { MissionWithRelations } from '@/types/domain';

/** Retire les vides et les doublons, en conservant l'ordre de saisie. */
function joinParts(parts: readonly (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const part of parts) {
    const value = part?.trim();
    if (value === undefined || value === '') continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    kept.push(value);
  }

  return kept.join(', ');
}

/**
 * Adresse du chantier, en une ligne.
 *
 * `location_label` d'abord : c'est le repère que le planificateur a saisi
 * (« pied du pylône », « local technique B »), et il désigne souvent mieux le
 * point d'intervention que la voie postale.
 */
function formatAddress(mission: MissionWithRelations): string {
  return joinParts([
    mission.location_label,
    mission.address_line1,
    mission.postal_code,
    mission.city,
  ]);
}

/**
 * Destination à ouvrir dans Google Maps.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE N'EST PAS SIMPLEMENT L'ADRESSE
 *
 * Une mission n'a pas toujours d'adresse postale complète. Sur le terrain, elle
 * porte souvent un repère seul — « Site Central Baie A12 » — qui ne mène nulle
 * part si on l'envoie tel quel à un moteur de cartes. Le bouton disparaissait
 * alors, ce qui privait le technicien de la seule action dont il a besoin en
 * montant dans son véhicule.
 *
 * DEUX RÉGIMES, SELON CE QUE L'ON SAIT
 *
 *   Adresse réelle (voie + code postal ou ville) → on l'envoie SEULE. Y ajouter
 *   le nom du client dégraderait la précision d'un point que Maps sait déjà
 *   situer exactement.
 *
 *   Repère seul → on assemble tout ce qui peut aider à le localiser : le repère,
 *   le site, sa ville, le client. Le résultat est une recherche, pas une adresse
 *   — c'est ce que ferait un humain devant la barre de recherche.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function buildMapsDestination(mission: MissionWithRelations): string {
  const hasStreet = mission.address_line1 !== null && mission.address_line1.trim() !== '';
  const hasLocality =
    (mission.postal_code !== null && mission.postal_code.trim() !== '') ||
    (mission.city !== null && mission.city.trim() !== '');

  if (hasStreet && hasLocality) {
    return joinParts([mission.address_line1, mission.postal_code, mission.city]);
  }

  return joinParts([
    mission.location_label,
    mission.address_line1,
    mission.site?.name,
    mission.postal_code,
    mission.city,
    mission.site?.city,
    mission.customer?.name ?? mission.customer_name,
  ]);
}

/**
 * Numéro rendu composable par `tel:`.
 *
 * Espaces, points et parenthèses sont retirés — un technicien ne doit pas avoir
 * à recopier à la main un numéro saisi « 06 96 45 89 12 ». Le `+` initial est
 * conservé : il porte l'indicatif pays.
 */
function toDialable(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : cleaned.replace(/\+/g, '');
}

export default function MissionDetailPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const navigate = useNavigate();
  const { organization, membership } = useCurrentOrganization();
  const { can, role } = usePermission();

  const mission = useMission(missionId);
  const history = useMissionHistory(missionId);
  const assignments = useMissionAssignments(missionId);
  const teams = useTeams(organization?.id ?? null);
  const members = useMembers(organization?.id ?? null);
  const deleteMission = useDeleteMission();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
        description="Cette mission n’existe pas, ou vous n’avez pas le droit d’y accéder."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.missions}>Retour aux missions</Link>
          </Button>
        }
      />
    );
  }

  const data = mission.data;

  /** Adresse telle qu'affichée — peut rester vide, la mission n'en exige pas. */
  const address = formatAddress(data);

  /**
   * Destination de l'itinéraire, plus tolérante que l'adresse : elle retombe sur
   * le site puis sur le client, de sorte que le bouton reste utilisable même
   * quand seule une référence de chantier a été saisie.
   */
  const mapsDestination = buildMapsDestination(data);

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
  const canDelete = can(PERMISSIONS.missionDelete) || can(PERMISSIONS.missionUpdate);

  const handleDelete = async () => {
    if (!missionId) return;
    await deleteMission.mutateAsync(missionId);
    setIsDeleteModalOpen(false);
    void navigate(ROUTES.missions);
  };

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

            {/*
              Réservé à `mission.update`. Le trigger `enforce_mission_assignee_scope`
              interdit à l'intervenant de modifier tout ce que ce formulaire
              touche : lui ouvrir la fenêtre reviendrait à le laisser saisir dix
              champs pour se voir refuser à l'enregistrement.
            */}
            {can(PERMISSIONS.missionUpdate) ? (
              <MissionEditDialog mission={data} organizationId={organization?.id ?? null} />
            ) : null}

            {canAssign ? (
              <AssignMissionDialog
                missionId={data.id}
                teams={teams.data ?? []}
                members={members.data ?? []}
                currentTeamId={data.assigned_team_id}
                currentMemberId={data.assigned_user_id}
              />
            ) : null}

            {canDelete ? (
              <>
                <div className="h-4 w-px bg-border mx-1" aria-hidden="true" />
                <Button
                  variant="danger-outline"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(true)}
                  disabled={deleteMission.isPending}
                >
                  <Trash2 className="size-4" />
                  Supprimer
                </Button>

                <Modal
                  open={isDeleteModalOpen}
                  onOpenChange={setIsDeleteModalOpen}
                  title="Supprimer la mission"
                  description={`Êtes-vous sûr de vouloir supprimer définitivement la mission "${data.title}" (${data.reference}) ?`}
                  footer={
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDeleteModalOpen(false)}
                        disabled={deleteMission.isPending}
                      >
                        Annuler
                      </Button>
                      <Button
                        variant="danger-outline"
                        size="sm"
                        onClick={() => void handleDelete()}
                        disabled={deleteMission.isPending}
                      >
                        {deleteMission.isPending ? 'Suppression…' : 'Supprimer la mission'}
                      </Button>
                    </div>
                  }
                >
                  <p className="text-muted-foreground text-sm">
                    Cette action est irréversible. La mission et son historique seront définitivement retirés de votre entreprise.
                  </p>
                </Modal>
              </>
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
              <span>{address === '' ? 'Adresse non renseignée' : address}</span>
            </p>

            {/*
              Interlocuteur sur place et son numéro.

              Ces deux colonnes existaient depuis l'origine sur `missions` et
              n'étaient affichées nulle part. C'est pourtant l'information la
              plus utile au technicien devant un portail fermé : qui appeler.
            */}
            {data.customer_contact !== null && data.customer_contact !== '' ? (
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <User className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>{data.customer_contact}</span>
              </p>
            ) : null}

            {data.customer_phone !== null && data.customer_phone !== '' ? (
              <a
                href={`tel:${toDialable(data.customer_phone)}`}
                className="text-primary flex items-center gap-1.5 text-xs font-medium hover:underline"
              >
                <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                {data.customer_phone}
              </a>
            ) : null}

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

            {/*
              Itinéraire. `google.com/maps` plutôt qu'un schéma natif (`geo:`,
              `maps://`) : cette URL s'ouvre dans l'application de cartes sur
              Android et iOS, et dans le navigateur ailleurs — sans détection de
              plateforme à maintenir.

              Le bouton est TOUJOURS rendu. Il n'est désactivé que si la mission
              ne porte strictement aucun repère : ni adresse, ni site, ni client.
              Le masquer laissait le technicien sans explication.
            */}
            {mapsDestination === '' ? (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="w-full justify-center gap-1.5"
                title="Renseignez une adresse, un site ou un client pour activer l’itinéraire"
              >
                <Navigation className="size-3.5" aria-hidden="true" />
                Itinéraire indisponible — aucun lieu renseigné
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="w-full justify-center gap-1.5">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsDestination)}`}
                  target="_blank"
                  rel="noreferrer"
                  title={`Ouvrir Google Maps vers : ${mapsDestination}`}
                >
                  <Navigation className="size-3.5" aria-hidden="true" />
                  Itinéraire vers le chantier
                </a>
              </Button>
            )}
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <CardTitle>Historique des affectations</CardTitle>
        </CardHeader>
        <CardContent>
          {/*
            Distinct de l'historique d'état ci-dessous. La fiche ne montre que
            l'affectation COURANTE : une mission passée de main en main ne
            garde trace de rien, et un refus — sa date, son motif — n'a plus
            aucune réponse ailleurs.
          */}
          {assignments.isPending ? (
            <ListSkeleton />
          ) : (assignments.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-xs">Aucune affectation enregistrée.</p>
          ) : (
            <ul className="divide-border divide-y">
              {(assignments.data ?? []).map((assignment) => {
                const team =
                  assignment.team_id === null
                    ? null
                    : ((teams.data ?? []).find((item) => item.id === assignment.team_id) ?? null);

                const member =
                  assignment.member_id === null
                    ? null
                    : ((members.data ?? []).find((item) => item.id === assignment.member_id) ??
                      null);

                const target =
                  [team?.name, member === null ? null : memberDisplayName(member)]
                    .filter((part) => part !== null && part !== undefined)
                    .join(' · ') ||
                  // Le nom vient des listes chargées pour cette page. La RLS
                  // peut les tronquer, ou l'équipe avoir été archivée depuis :
                  // dire « supprimée » serait une déduction, pas un fait.
                  'Destinataire non consultable';

                return (
                  <li key={assignment.id} className="flex flex-wrap items-center gap-3 py-2 text-xs">
                    <span className="text-subtle-foreground font-mono tabular-nums">
                      {new Date(assignment.assigned_at).toLocaleString('fr-FR')}
                    </span>

                    <span className="text-foreground flex-1 font-medium">{target}</span>

                    {assignment.declined_at !== null ? (
                      <Badge variant="error">
                        Refusée{assignment.decline_reason !== null ? ` — ${assignment.decline_reason}` : ''}
                      </Badge>
                    ) : assignment.accepted_at !== null ? (
                      <Badge variant="success">Acceptée</Badge>
                    ) : assignment.unassigned_at !== null ? (
                      <Badge variant="neutral">Retirée</Badge>
                    ) : (
                      <Badge variant="outline">En attente</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des états</CardTitle>
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
