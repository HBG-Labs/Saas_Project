import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  KeyRound,
  MapPin,
  Phone,
  Trash2,
  User,
  UserMinus,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { LocateMissionButton, NavigationButton, MapLocationPickerDialog } from '@/features/geo';
import {
  AssignMissionDialog,
  MISSION_STATUS_LABELS,
  MissionEditDialog,
  MissionPriorityBadge,
  MissionStatusBadge,
  MissionTransitions,
  useDeleteMission,
  useMission,
  useUpdateMission,
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
  const location = useLocation();
  const { organization, membership } = useCurrentOrganization();
  const { can, role } = usePermission();

  const mission = useMission(missionId);
  const history = useMissionHistory(missionId);
  const assignments = useMissionAssignments(missionId);
  const teams = useTeams(organization?.id ?? null);
  const members = useMembers(organization?.id ?? null);
  const deleteMission = useDeleteMission();
  const updateMission = useUpdateMission(missionId ?? '');

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
  const requestedBack = (location.state as { from?: unknown } | null)?.from;
  const backTarget =
    typeof requestedBack === 'string' && requestedBack.startsWith(ROUTES.planning)
      ? requestedBack
      : ROUTES.missions;
  const backLabel = backTarget.startsWith(ROUTES.planning) ? 'Planning' : 'Missions';

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
      <div className="space-y-3 md:hidden">
        <Link
          to={backTarget}
          className="text-muted-foreground focus-visible:ring-ring min-h-touch -ml-1 inline-flex items-center gap-1 rounded-lg px-1 text-xs font-bold focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>

        <section className="border-border bg-surface-raised overflow-hidden rounded-2xl border shadow-xs">
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <MissionStatusBadge status={data.status} />
              <span className="text-muted-foreground text-2xs font-mono font-bold">
                {data.reference}
              </span>
            </div>
            <div>
              {data.intervention_type ? (
                <p className="text-primary text-3xs font-bold tracking-wide uppercase">
                  {data.intervention_type.label}
                </p>
              ) : null}
              <h1 className="text-foreground mt-1 text-xl leading-tight font-extrabold tracking-tight">
                {data.title}
              </h1>
              {data.customer?.name || data.customer_name ? (
                <p className="text-foreground mt-2 text-sm font-semibold">
                  {data.customer?.name ?? data.customer_name}
                </p>
              ) : null}
              {data.site?.name || address ? (
                <p className="text-muted-foreground mt-1 flex items-start gap-1.5 text-xs">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>{joinParts([data.site?.name, address])}</span>
                </p>
              ) : null}
            </div>

            {data.scheduled_start ? (
              <div className="bg-surface-subtle text-muted-foreground flex items-center gap-2 rounded-xl px-3 py-2 text-xs tabular-nums">
                <CalendarDays className="text-primary size-4" aria-hidden />
                <span>
                  {new Date(data.scheduled_start).toLocaleString('fr-FR', {
                    timeZone: organization?.timezone ?? 'Europe/Paris',
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                  {data.scheduled_end
                    ? ` – ${new Date(data.scheduled_end).toLocaleTimeString('fr-FR', {
                        timeZone: organization?.timezone ?? 'Europe/Paris',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : ''}
                </span>
              </div>
            ) : null}

            <MissionTransitions mission={data} role={role} isAssignee={isAssignee} />
          </div>

          <div className="border-border grid grid-cols-3 border-t">
            <NavigationButton
              destination={{
                latitude: data.latitude,
                longitude: data.longitude,
                address: mapsDestination,
                label: data.title,
              }}
              className="text-2xs min-h-14 justify-center rounded-none border-0"
              label="Itinéraire GPS"
            />
            {data.customer_phone !== null && data.customer_phone !== '' ? (
              <a
                href={`tel:${toDialable(data.customer_phone)}`}
                className="border-border text-foreground focus-visible:ring-ring text-2xs flex min-h-14 flex-col items-center justify-center gap-1 border-l font-bold focus-visible:ring-2 focus-visible:outline-none"
              >
                <Phone className="size-4" aria-hidden />
                Appeler
              </a>
            ) : (
              <a
                href="#interventions-mission"
                className="border-border text-foreground focus-visible:ring-ring text-2xs flex min-h-14 flex-col items-center justify-center gap-1 border-l font-bold focus-visible:ring-2 focus-visible:outline-none"
              >
                <ClipboardList className="size-4" aria-hidden />
                Interventions
              </a>
            )}
            <a
              href="#details-mission"
              className="border-border text-foreground focus-visible:ring-ring text-2xs flex min-h-14 flex-col items-center justify-center gap-1 border-l font-bold focus-visible:ring-2 focus-visible:outline-none"
            >
              <User className="size-4" aria-hidden />
              Détails
            </a>
          </div>
        </section>

        <div
          className="bg-surface-subtle grid grid-cols-2 rounded-xl p-1"
          aria-label="Sections de la mission"
        >
          <a
            href="#details-mission"
            className="bg-surface text-foreground flex min-h-10 items-center justify-center rounded-lg text-xs font-bold shadow-xs"
          >
            Détails
          </a>
          <a
            href="#interventions-mission"
            className="text-muted-foreground flex min-h-10 items-center justify-center rounded-lg text-xs font-bold"
          >
            Interventions
          </a>
        </div>

        {can(PERMISSIONS.missionUpdate) || canAssign || canDelete ? (
          <div className="flex flex-wrap gap-2">
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
              <Button variant="danger-outline" size="sm" onClick={() => setIsDeleteModalOpen(true)}>
                <Trash2 className="size-4" />
                Supprimer
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Button asChild variant="ghost" size="sm" className="-ml-2 hidden md:inline-flex">
        <Link to={backTarget}>
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      </Button>

      <div className="hidden md:block">
        <PageHeader
          title={data.title}
          {...(data.description !== null && data.description !== ''
            ? { description: data.description }
            : {})}
          actions={
            <div className="flex flex-wrap items-center gap-2">
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
                  <div className="bg-border mx-1 h-4 w-px" aria-hidden="true" />
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
                      Cette action est irréversible. La mission et son historique seront
                      définitivement retirés de votre entreprise.
                    </p>
                  </Modal>
                </>
              ) : null}
            </div>
          }
        />
      </div>

      <section
        aria-labelledby="mission-progress-title"
        className="border-primary/20 bg-primary-subtle/35 hidden gap-4 rounded-xl border p-4 sm:p-5 md:grid lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-center"
      >
        <div>
          <p
            id="mission-progress-title"
            className="text-primary text-3xs font-bold tracking-[0.14em] uppercase"
          >
            Avancement
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-surface font-mono">
              {data.reference}
            </Badge>
            <MissionPriorityBadge priority={data.priority} />
            <MissionStatusBadge status={data.status} />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Les actions disponibles dépendent de l’état actuel de la mission.
          </p>
        </div>
        <div className="border-primary/15 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <MissionTransitions mission={data} role={role} isAssignee={isAssignee} />
        </div>
      </section>

      {data.site?.access_notes !== null && data.site?.access_notes !== undefined ? (
        <section
          aria-labelledby="mission-access-title"
          className="border-warning-border bg-warning-subtle flex items-start gap-3 rounded-xl border p-4"
        >
          <span
            className="bg-surface text-warning border-warning-border flex size-10 shrink-0 items-center justify-center rounded-lg border"
            aria-hidden="true"
          >
            <KeyRound className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="mission-access-title" className="text-foreground text-sm font-semibold">
              Consignes d’accès au site
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed whitespace-pre-line">
              {data.site.access_notes}
            </p>
          </div>
        </section>
      ) : null}

      {/*
        Le maillon entre la mission et le travail réel. Sans lui, la machine à
        états avançait mais aucune intervention n'existait — le chronomètre et
        le compte rendu restaient inatteignables.
      */}
      <Card id="interventions-mission" variant="section" className="scroll-mt-24">
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

      <div id="details-mission" className="grid scroll-mt-24 gap-6 lg:grid-cols-2">
        <Card variant="section">
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

            {data.latitude != null && data.longitude != null && (
              <div className="bg-surface-subtle border-border/80 text-3xs text-muted-foreground flex items-center gap-1.5 rounded-lg border p-2 font-mono">
                <MapPin className="text-primary size-3 shrink-0" />
                <span>
                  GPS : {Number(data.latitude).toFixed(6)}, {Number(data.longitude).toFixed(6)}
                </span>
              </div>
            )}

            <div className="border-border space-y-2 border-t pt-2">
              {/* 1. Bouton Itinéraire */}
              <NavigationButton
                destination={{
                  latitude: data.latitude,
                  longitude: data.longitude,
                  address: mapsDestination,
                  label: data.title,
                }}
                className="w-full justify-center gap-1.5"
                label="Itinéraire vers le chantier"
              />

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {/* 2. Bouton Localiser le chantier (GPS smartphone) */}
                <LocateMissionButton
                  missionId={data.id}
                  currentLatitude={data.latitude}
                  currentLongitude={data.longitude}
                  className="w-full justify-center text-xs"
                />

                {/* 3. Bouton Pointer sur la carte (Clic sur carte Leaflet) */}
                <MapLocationPickerDialog
                  initialLatitude={data.latitude}
                  initialLongitude={data.longitude}
                  initialAddress={mapsDestination}
                  title={`Position GPS — ${data.reference}`}
                  description="Cliquez sur la carte pour définir ou ajuster les coordonnées exactes du chantier."
                  onSelectLocation={async (loc) => {
                    await updateMission.mutateAsync({
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                    });
                  }}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-center gap-1.5 text-xs"
                      title="Choisir ou ajuster le repère en cliquant sur la carte"
                    >
                      <MapPin className="text-primary size-3.5" />
                      <span>Pointer sur la carte</span>
                    </Button>
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="section">
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
                <p className="text-foreground text-sm tabular-nums">
                  {data.scheduled_start !== null
                    ? new Date(data.scheduled_start).toLocaleString('fr-FR')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Début réel</p>
                <p className="text-foreground text-sm tabular-nums">
                  {data.actual_start !== null
                    ? new Date(data.actual_start).toLocaleString('fr-FR')
                    : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="section">
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
            <ol className="relative">
              {(assignments.data ?? []).map((assignment, index, allAssignments) => {
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

                const presentation =
                  assignment.declined_at !== null
                    ? {
                        label: 'Refusée',
                        variant: 'error' as const,
                        icon: XCircle,
                        iconClass: 'border-error-border bg-error-subtle text-error',
                      }
                    : assignment.accepted_at !== null
                      ? {
                          label: 'Acceptée',
                          variant: 'success' as const,
                          icon: CheckCircle2,
                          iconClass: 'border-success-border bg-success-subtle text-success',
                        }
                      : assignment.unassigned_at !== null
                        ? {
                            label: 'Retirée',
                            variant: 'neutral' as const,
                            icon: UserMinus,
                            iconClass: 'border-border bg-surface-sunken text-muted-foreground',
                          }
                        : {
                            label: 'En attente',
                            variant: 'outline' as const,
                            icon: Clock3,
                            iconClass: 'border-primary/25 bg-primary-subtle text-primary',
                          };

                const AssignmentIcon = presentation.icon;

                return (
                  <li key={assignment.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {index < allAssignments.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="bg-border absolute top-9 bottom-1 left-[19px] w-px"
                      />
                    ) : null}
                    <span
                      className={`relative flex size-10 shrink-0 items-center justify-center rounded-full border ${presentation.iconClass}`}
                      aria-hidden="true"
                    >
                      <AssignmentIcon className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-foreground min-w-0 flex-1 text-sm font-semibold">
                          {target}
                        </p>
                        <Badge variant={presentation.variant}>{presentation.label}</Badge>
                      </div>
                      <time
                        dateTime={assignment.assigned_at}
                        className="text-subtle-foreground mt-0.5 block text-sm tabular-nums"
                      >
                        Affectée le {new Date(assignment.assigned_at).toLocaleString('fr-FR')}
                      </time>
                      {assignment.decline_reason !== null ? (
                        <p className="border-error-border bg-error-subtle text-error mt-2 rounded-lg border px-3 py-2 text-xs leading-relaxed">
                          <span className="font-semibold">Motif du refus :</span>{' '}
                          {assignment.decline_reason}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card variant="section">
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
