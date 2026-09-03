import { ArrowLeft, FileText, KeyRound, MapPin, Printer, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { LocateMissionButton, NavigationButton, MapLocationPickerDialog } from '@/features/geo';
import {
  AttachmentGallery,
  InterventionPdfModal,
  InterventionTimer,
  useAttachments,
  useIntervention,
  useTimeEntries,
  useUpdateInterventionNotes,
  useWorkedSeconds,
} from '@/features/interventions';
import { FEATURES, useOrganizationEntitlements } from '@/features/billing';
import { useMission, useUpdateMission } from '@/features/missions';
import { useCurrentOrganization } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Vue terrain d'une intervention.
 *
 * Conçue pour être tenue à une main, sous la pluie, avec des gants : le
 * chronomètre et ses commandes occupent le haut de l'écran, les informations
 * consultables viennent après. C'est l'inverse d'une fiche de bureau, où le
 * contexte précède l'action.
 */
export default function InterventionPage() {
  const { interventionId } = useParams<{ interventionId: string }>();
  const { user } = useAuth();
  const { organization, membership } = useCurrentOrganization();
  const { has } = useOrganizationEntitlements(organization?.id ?? null);

  const intervention = useIntervention(interventionId);
  const timeEntries = useTimeEntries(interventionId);
  const workedSeconds = useWorkedSeconds(interventionId);
  const attachments = useAttachments(interventionId);
  const mission = useMission(intervention.data?.mission_id);
  const updateMission = useUpdateMission(intervention.data?.mission_id ?? '');

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  useDocumentTitle(mission.data?.reference ?? 'Intervention');

  if (intervention.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (intervention.isError) {
    return (
      <ErrorState
        error={intervention.error}
        onRetry={() => {
          void intervention.refetch();
        }}
      />
    );
  }

  if (intervention.data === null || interventionId === undefined) {
    return (
      <EmptyState
        icon={Wrench}
        title="Intervention introuvable"
        description="Cette intervention n’existe pas, ou ne vous est pas accessible."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.missions}>Retour aux missions</Link>
          </Button>
        }
      />
    );
  }

  const data = intervention.data;

  /**
   * Seul l'intervenant pointe ses heures.
   *
   * La policy `intervention_time_entries_insert` le vérifie côté serveur : un
   * responsable qui pointerait à la place de quelqu'un d'autre viderait le
   * relevé de son sens. Il consulte, il ne pointe pas.
   */
  const canTrack = membership !== null && data.technician_id === membership.id;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={data.mission_id !== null ? ROUTES.mission(data.mission_id) : ROUTES.missions}>
          <ArrowLeft className="size-4" />
          Mission
        </Link>
      </Button>

      {/* Le chronomètre EN PREMIER : c'est la raison d'ouvrir cet écran. */}
      <Card>
        <CardContent className="pt-6">
          <InterventionTimer
            interventionId={interventionId}
            organizationId={organization?.id ?? ''}
            entries={timeEntries.data ?? []}
            workedSeconds={workedSeconds.data ?? 0}
            canTrack={canTrack}
            isCompleted={data.status === 'completed'}
          />
        </CardContent>
      </Card>

      {/*
        Le compte rendu est la suite naturelle du chronomètre : on le rédige en
        partant, souvent depuis le véhicule. Le laisser accessible seulement par
        l'URL le rendrait introuvable.
      */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-foreground text-sm font-medium">Compte rendu</p>
            <p className="text-muted-foreground text-xs">
              {data.report === null
                ? 'Aucun compte rendu ouvert pour cette intervention.'
                : data.report.status === 'draft'
                  ? 'Brouillon en cours de rédaction.'
                  : data.report.status === 'submitted'
                    ? 'Soumis au contrôle.'
                    : data.report.status === 'approved'
                      ? 'Validé — définitif.'
                      : 'Refusé — à corriger et resoumettre.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {data.report !== null && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPdfModalOpen(true)}
                className="text-xs gap-1.5"
                title="Prévisualiser le PV et imprimer en PDF"
              >
                <Printer className="size-3.5" />
                <span>PV / PDF</span>
              </Button>
            )}

            <Button asChild variant={data.report === null ? 'primary' : 'outline'} size="sm">
              <Link to={ROUTES.interventionReport(interventionId)}>
                <FileText className="size-4" />
                {data.report === null ? 'Rédiger' : 'Ouvrir'}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {mission.data !== null && mission.data !== undefined ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">{mission.data.reference}</Badge>
              {mission.data.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {[
                  mission.data.location_label,
                  mission.data.address_line1,
                  mission.data.postal_code,
                  mission.data.city,
                ]
                  .filter((part) => part !== null && part !== '')
                  .join(', ') || 'Adresse non renseignée'}
              </span>
            </p>

            {/*
              Les consignes d'accès sont mises en évidence : c'est ce que le
              technicien cherche en arrivant devant une grille fermée.
            */}
            {mission.data.site?.access_notes !== null &&
            mission.data.site?.access_notes !== undefined ? (
              <div className="bg-surface-sunken flex gap-2 rounded-md p-2">
                <KeyRound
                  className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-muted-foreground text-xs whitespace-pre-line">
                  {mission.data.site.access_notes}
                </p>
              </div>
            ) : null}

            {mission.data.description !== null && mission.data.description !== '' ? (
              <p className="text-foreground text-sm whitespace-pre-line">
                {mission.data.description}
              </p>
            ) : null}

            {mission.data.latitude != null && mission.data.longitude != null && (
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-surface-subtle border border-border/80 text-3xs font-mono text-muted-foreground">
                <MapPin className="size-3 text-primary shrink-0" />
                <span>GPS : {Number(mission.data.latitude).toFixed(6)}, {Number(mission.data.longitude).toFixed(6)}</span>
              </div>
            )}

            <div className="pt-2 space-y-2 border-t border-border">
              <NavigationButton
                destination={{
                  latitude: mission.data.latitude,
                  longitude: mission.data.longitude,
                  address: [
                    mission.data.site?.name,
                    mission.data.address_line1,
                    mission.data.postal_code,
                    mission.data.city,
                  ]
                    .filter(Boolean)
                    .join(', '),
                  label: mission.data.title,
                }}
                className="w-full justify-center text-xs"
                label="🧭 Itinéraire vers le site"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <LocateMissionButton
                  missionId={mission.data.id}
                  currentLatitude={mission.data.latitude}
                  currentLongitude={mission.data.longitude}
                  className="w-full justify-center text-xs"
                />

                <MapLocationPickerDialog
                  initialLatitude={mission.data.latitude}
                  initialLongitude={mission.data.longitude}
                  initialAddress={[
                    mission.data.address_line1,
                    mission.data.postal_code,
                    mission.data.city,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  title={`Position GPS — ${mission.data.reference}`}
                  description="Cliquez sur la carte pour définir ou ajuster l'emplacement exact du chantier."
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
                      className="w-full justify-center text-xs gap-1.5"
                      title="Choisir ou ajuster le repère en cliquant sur la carte"
                    >
                      <MapPin className="size-3.5 text-primary" />
                      <span>Pointer sur la carte</span>
                    </Button>
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/*
        Les notes se prennent PENDANT, pas à la fin.

        `completeIntervention` acceptait déjà un champ de notes, mais une seule
        fois, au moment de terminer — c'est-à-dire au pire moment, celui où l'on
        range le matériel. Un câble sectionné, un client absent, un accès
        refusé : cela se note sur place, ou cela se perd.
      */}
      <InterventionNotes
        interventionId={interventionId}
        notes={data.notes}
        canEdit={canTrack && data.status !== 'completed'}
      />

      <Card>
        <CardHeader>
          <CardTitle>Photos & Justificatifs terrain</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentGallery
            interventionId={interventionId}
            organizationId={organization?.id ?? ''}
            missionId={data.mission_id}
            uploadedBy={user?.id ?? ''}
            attachments={attachments.data ?? []}
            canEdit={canTrack && data.status !== 'completed'}
            hasAttachmentsFeature={has(FEATURES.attachments)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relevé du temps</CardTitle>
        </CardHeader>
        <CardContent>
          {(timeEntries.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Aucun segment enregistré. Démarrez l’intervention pour ouvrir le relevé.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {(timeEntries.data ?? []).map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2 text-xs">
                  <Badge variant={entry.kind === 'work' ? 'primary' : 'warning'}>
                    {entry.kind === 'work' ? 'Travail' : 'Pause'}
                  </Badge>
                  <span className="text-foreground font-mono tabular-nums">
                    {new Date(entry.started_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' → '}
                    {entry.ended_at !== null
                      ? new Date(entry.ended_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '…'}
                  </span>
                  {entry.reason !== null ? (
                    <span className="text-muted-foreground">{entry.reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <InterventionPdfModal
        open={isPdfModalOpen}
        onOpenChange={setIsPdfModalOpen}
        organizationName={organization?.name}
        mission={mission.data}
        intervention={data}
        report={data.report}
        attachments={attachments.data ?? []}
        workedSeconds={workedSeconds.data ?? 0}
      />
    </div>
  );
}

/**
 * Notes de terrain.
 *
 * Enregistrement explicite plutôt qu'automatique à la frappe : sur un chantier,
 * le réseau est ce qu'il est, et un champ qui se sauvegarde tout seul ne dit
 * pas si le texte est parti. Le bouton, lui, le dit.
 *
 * En lecture seule après la clôture. C'est un choix d'ERGONOMIE et non une
 * protection — le serveur, lui, laisse ce champ ouvert. Ce qui doit être opposable
 * passe par le compte rendu et son circuit de validation ; des notes retouchées
 * après coup seraient un second récit, sans contrôle.
 */
function InterventionNotes({
  interventionId,
  notes,
  canEdit,
}: {
  interventionId: string;
  notes: string | null;
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState(notes ?? '');
  const updateNotes = useUpdateInterventionNotes(interventionId);

  const saved = notes ?? '';
  const dirty = draft !== saved;

  if (!canEdit) {
    return saved === '' ? null : (
      <Card>
        <CardHeader>
          <CardTitle>Notes de terrain</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground text-sm whitespace-pre-line">{saved}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes de terrain</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          label="Notes de terrain"
          hideLabel
          rows={4}
          placeholder="Ce qu’il faut retenir de cette intervention : accès, matériel, imprévus…"
          hint="Visible par vous et par votre responsable. Le compte rendu client se rédige à part."
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />

        <FormError error={updateNotes.error} />

        <div className="flex items-center justify-end gap-3">
          {!dirty && updateNotes.isSuccess ? (
            <span className="text-success text-xs">Enregistré.</span>
          ) : null}

          <Button
            variant="primary"
            size="sm"
            disabled={!dirty || updateNotes.isPending}
            onClick={() => {
              // `null` et non `''` : un champ vidé redevient vide en base, et
              // non une chaîne vide qui se lirait comme une note sans contenu.
              updateNotes.mutate(draft.trim() === '' ? null : draft);
            }}
          >
            {updateNotes.isPending ? 'Enregistrement…' : 'Enregistrer les notes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
