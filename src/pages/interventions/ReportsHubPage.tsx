import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Plus,
  Send,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { EmptyState } from '@/components/feedback/EmptyState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import {
  AttachmentGallery,
  useAttachments,
  useCreateReport,
  useIntervention,
  useOrganizationInterventions,
  useSaveReport,
  useSubmitReport,
} from '@/features/interventions';
import { FEATURES, useOrganizationEntitlements } from '@/features/billing';
import { useClientPortalAccess } from '@/features/client-portal';
import { useMissions } from '@/features/missions';
import { useNotes } from '@/features/notes';
import { useCurrentOrganization } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { ReportStatus } from '@/types/database';

const STATUS_LABELS: Record<ReportStatus, string> = {
  draft: 'Brouillon',
  submitted: 'Soumis au contrôle',
  approved: 'Validé',
  rejected: 'Refusé',
};

const STATUS_BADGE_VARIANTS: Record<ReportStatus, 'outline' | 'primary' | 'success' | 'error'> = {
  draft: 'outline',
  submitted: 'primary',
  approved: 'success',
  rejected: 'error',
};

export default function ReportsHubPage() {
  useDocumentTitle('Comptes-rendus & Rapports');

  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { has } = useOrganizationEntitlements(organizationId);
  const portal = useClientPortalAccess();

  const missionsQuery = useMissions(organizationId);
  const interventionsQuery = useOrganizationInterventions(organizationId);
  const missionList = missionsQuery.data ?? [];
  const interventionList = interventionsQuery.data ?? [];

  const [selectedInterventionId, setSelectedInterventionId] = useState<string>('');

  // La première intervention sert de sélection par défaut — DÉDUITE, pas posée.
  //
  // Un effet s'en chargeait, en doublon avec la ligne ci-dessous qui appliquait
  // déjà le même repli. Il ne produisait donc qu'un rendu supplémentaire, et un
  // clignotement au chargement de la liste.
  const activeInterventionId = selectedInterventionId || interventionList[0]?.id;

  const intervention = useIntervention(activeInterventionId);
  const attachments = useAttachments(activeInterventionId);
  const createReport = useCreateReport(activeInterventionId ?? 'none');
  const submitReport = useSubmitReport(activeInterventionId ?? 'none');

  const report = intervention.data?.report ?? null;
  const saveReport = useSaveReport(report?.id ?? '', activeInterventionId);

  const [workDescription, setWorkDescription] = useState('');
  const [observations, setObservations] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loadedReportId, setLoadedReportId] = useState<string | null>(null);

  if (report !== null && report.id !== loadedReportId) {
    setLoadedReportId(report.id);
    setWorkDescription(report.work_description ?? '');
    setObservations(report.observations ?? '');
  }

  const isEditable = report === null || report.status === 'draft' || report.status === 'rejected';
  const hasUnsavedChanges =
    report !== null &&
    (workDescription !== (report.work_description ?? '') ||
      observations !== (report.observations ?? ''));

  const save = () => {
    if (report === null) return;
    setError(null);
    saveReport.mutate(
      { work_description: workDescription, observations },
      {
        onSuccess: (updatedReport) => {
          setSavedAt(new Date());
          if (updatedReport) {
            setWorkDescription(updatedReport.work_description ?? '');
            setObservations(updatedReport.observations ?? '');
          }
        },
        onError: (mutationError) => {
          setError(mutationError);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rédiger & Gérer vos Comptes-rendus"
        description="Espace dédié aux techniciens pour saisir, enregistrer et soumettre les comptes-rendus d'intervention terrain."
      />

      {/* Selecteur de mission/intervention */}
      <Card className="border-border/80 overflow-hidden">
        <CardHeader className="border-border bg-surface-sunken/35 flex flex-col items-stretch justify-between gap-3 border-b sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <ClipboardCheck className="size-4" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Sélectionner l’intervention</CardTitle>
              <p className="text-muted-foreground mt-1 text-xs">
                Choisissez le chantier dont vous souhaitez rédiger le compte rendu.
              </p>
            </div>
          </div>
          {activeInterventionId && (
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to={ROUTES.interventionReport(activeInterventionId)}>
                <ExternalLink className="size-3.5" />
                Éditeur complet
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {interventionsQuery.isPending || missionsQuery.isPending ? (
              <p className="text-muted-foreground col-span-full py-3 text-center text-xs">
                Chargement des interventions et missions…
              </p>
            ) : interventionList.length === 0 && missionList.length === 0 ? (
              <EmptyState
                illustration={<AtelierIllustration subject="missions" className="w-44" />}
                title="Aucun chantier disponible"
                description="Les interventions apparaîtront ici dès qu’une mission aura démarré."
                size="sm"
                className="col-span-full"
              />
            ) : interventionList.length > 0 ? (
              interventionList.map((item) => {
                const isSelected = item.id === activeInterventionId;
                const rep = item.report;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedInterventionId(item.id)}
                    className={`focus-visible:ring-primary cursor-pointer rounded-xl border p-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:hover:translate-y-0 ${
                      isSelected
                        ? 'border-primary bg-primary/10 font-semibold'
                        : 'border-border bg-surface hover:border-primary/35'
                    }`}
                  >
                    <div className="text-2xs text-muted-foreground mb-1 flex items-center justify-between">
                      <span className="text-foreground font-mono font-bold">
                        {item.id.slice(0, 8)}
                      </span>
                      {rep !== null ? (
                        <Badge
                          variant={STATUS_BADGE_VARIANTS[rep.status]}
                          className="text-3xs py-0"
                        >
                          {STATUS_LABELS[rep.status]}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-3xs py-0">
                          Sans compte-rendu
                        </Badge>
                      )}
                    </div>
                    <h4 className="text-foreground truncate text-xs font-bold">
                      Intervention du{' '}
                      {item.start_time
                        ? new Date(item.start_time).toLocaleDateString('fr-FR')
                        : 'chantier'}
                    </h4>
                    <p className="text-2xs text-muted-foreground mt-0.5 truncate">
                      Statut intervention : {item.status}
                    </p>
                  </button>
                );
              })
            ) : (
              missionList.map((m) => (
                <Link
                  key={m.id}
                  to={ROUTES.mission(m.id)}
                  className="border-border bg-surface hover:border-primary/35 focus-visible:ring-primary block rounded-xl border p-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:hover:translate-y-0"
                >
                  <div className="text-2xs text-muted-foreground mb-1 flex items-center justify-between">
                    <span className="text-foreground font-mono font-bold">{m.reference}</span>
                    <Badge variant="outline" className="text-3xs py-0">
                      {m.status === 'completed' ? 'Terminée' : 'En cours'}
                    </Badge>
                  </div>
                  <h4 className="text-foreground truncate text-xs font-bold">{m.title}</h4>
                  <p className="text-2xs text-primary mt-1 truncate font-medium">
                    → Démarrer l’intervention sur la mission
                  </p>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formulaire de Rédaction de Compte-rendu */}
      {activeInterventionId ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
              <FileText className="text-primary size-4" />
              Saisie du Compte-rendu Terrain
            </h3>
            {report !== null && (
              <Badge variant={STATUS_BADGE_VARIANTS[report.status]}>
                {STATUS_LABELS[report.status]}
              </Badge>
            )}
          </div>

          <FormError error={error} />

          {report !== null && report.status === 'rejected' && report.rejection_reason !== null ? (
            <div className="border-error/30 bg-error/10 text-error rounded-xl border p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <AlertCircle className="size-4" />
                Compte rendu refusé par le responsable
              </p>
              <p className="mt-1 text-xs leading-relaxed">{report.rejection_reason}</p>
            </div>
          ) : null}

          {report === null ? (
            <Card className="overflow-hidden">
              <CardContent className="space-y-4 py-8 text-center">
                <p className="text-foreground text-sm font-medium">
                  Aucun compte rendu n’a encore été ouvert pour cette intervention.
                </p>
                <p className="text-muted-foreground mx-auto max-w-md text-xs">
                  Cliquez ci-dessous pour ouvrir la fiche et saisir vos notes de travaux,
                  observations et photos du chantier.
                </p>
                <Button
                  variant="primary"
                  onClick={() => {
                    createReport.mutate({ interventionId: activeInterventionId });
                  }}
                  disabled={createReport.isPending}
                  isLoading={createReport.isPending}
                  loadingLabel="Ouverture du compte rendu"
                  leadingIcon={<Plus />}
                >
                  Ouvrir et rédiger le compte rendu
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-border/80 overflow-hidden">
                <CardHeader className="border-border bg-surface-sunken/35 flex flex-col items-stretch justify-between gap-3 border-b sm:flex-row sm:items-center">
                  <CardTitle>Nature des travaux réalisés</CardTitle>
                  {isEditable && (
                    <InsertFromNotepadDialog
                      onInsert={(noteContent) => {
                        setWorkDescription((prev) =>
                          prev ? `${prev}\n\n${noteContent}` : noteContent,
                        );
                      }}
                    />
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    label="Description des travaux effectués"
                    rows={6}
                    placeholder="Détaillez ici les opérations effectuées (soudure, raccordement, mesures d'atténuation, tirage de câble...)."
                    value={workDescription}
                    onChange={(event) => {
                      setWorkDescription(event.target.value);
                    }}
                    disabled={!isEditable}
                  />

                  <Textarea
                    label="Observations & Préconisations"
                    rows={4}
                    placeholder="Saisissez vos remarques, réserves éventuelles ou recommandations pour le client/manager."
                    value={observations}
                    onChange={(event) => {
                      setObservations(event.target.value);
                    }}
                    disabled={!isEditable}
                  />

                  {isEditable ? (
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <Button
                        variant={hasUnsavedChanges ? 'primary' : 'outline'}
                        onClick={save}
                        disabled={saveReport.isPending || !hasUnsavedChanges}
                        isLoading={saveReport.isPending}
                        loadingLabel="Enregistrement du brouillon"
                      >
                        {hasUnsavedChanges
                          ? 'Enregistrer les modifications'
                          : 'Brouillon enregistré'}
                      </Button>

                      {hasUnsavedChanges ? (
                        <span className="text-warning text-xs font-medium">
                          Modifications non enregistrées
                        </span>
                      ) : savedAt !== null ? (
                        <span className="text-success flex items-center gap-1 text-xs font-medium">
                          <CheckCircle2 className="size-3.5" />
                          Enregistré à {savedAt.toLocaleTimeString('fr-FR')}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Photos du terrain & pièces jointes */}
              <Card className="border-border/80 overflow-hidden">
                <CardHeader className="border-border bg-surface-sunken/35 border-b">
                  <CardTitle>Photos du chantier & documents</CardTitle>
                </CardHeader>
                <CardContent>
                  <AttachmentGallery
                    interventionId={activeInterventionId}
                    organizationId={organization?.id ?? ''}
                    missionId={intervention.data?.mission_id ?? ''}
                    uploadedBy={user?.id ?? ''}
                    attachments={attachments.data ?? []}
                    canEdit={isEditable}
                    hasAttachmentsFeature={has(FEATURES.attachments)}
                    canShareWithClient={portal.canShare}
                  />
                </CardContent>
              </Card>

              {isEditable ? (
                <Card className="border-primary/30 bg-primary-subtle overflow-hidden">
                  <CardContent className="space-y-3 pt-6">
                    <div className="space-y-1">
                      <p className="text-foreground flex items-center gap-2 text-sm font-bold">
                        <Sparkles className="text-primary size-4" />
                        Finaliser et transmettre le compte-rendu
                      </p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Une fois transmis, votre compte-rendu est immédiatement envoyé à votre
                        responsable pour contrôle et validation.
                      </p>
                    </div>

                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full gap-2 font-bold shadow-md"
                      onClick={() => {
                        setError(null);
                        saveReport.mutate(
                          { work_description: workDescription, observations },
                          {
                            onSuccess: () => {
                              submitReport.mutate(report.id, {
                                onError: (mutationError) => {
                                  setError(mutationError);
                                },
                              });
                            },
                            onError: (mutationError) => {
                              setError(mutationError);
                            },
                          },
                        );
                      }}
                      disabled={
                        saveReport.isPending ||
                        submitReport.isPending ||
                        workDescription.trim() === ''
                      }
                      isLoading={saveReport.isPending || submitReport.isPending}
                      loadingLabel="Transmission du compte rendu"
                      leadingIcon={<Send />}
                    >
                      Soumettre le compte-rendu au contrôle
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Reprend une note du bloc-notes dans le compte rendu.
 *
 * Les notes viennent de la table `notes`, filtrées par la RLS sur l'utilisateur
 * courant : celles saisies sur le téléphone au pied de la baie sont donc
 * disponibles ici, ce que la version stockée dans le navigateur ne permettait
 * pas.
 */
function InsertFromNotepadDialog({ onInsert }: { onInsert: (content: string) => void }) {
  const [open, setOpen] = useState(false);
  const notesQuery = useNotes();
  const notes = notesQuery.data ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Insérer une note du Bloc-notes"
      description="Choisissez l'une de vos notes personnelles pour l'insérer directement dans ce compte-rendu."
      trigger={
        <Button variant="outline" size="sm" className="w-full text-xs sm:w-auto">
          <BookOpen className="text-primary size-3.5" />
          Insérer depuis mon Bloc-notes
        </Button>
      }
      footer={
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(false)}
          className="w-full sm:w-auto"
        >
          Fermer
        </Button>
      }
    >
      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
            Aucune note enregistrée dans votre bloc-notes.
          </p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                className="border-border/60 hover:border-primary bg-surface focus-visible:ring-primary flex w-full cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left transition-all focus-visible:ring-2"
                onClick={() => {
                  onInsert(note.content);
                  setOpen(false);
                }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-foreground text-xs font-bold">{note.title}</span>
                  <Badge variant="outline" className="text-3xs">
                    Insérer
                  </Badge>
                </div>
                <p className="text-2xs text-muted-foreground line-clamp-2">
                  {note.content || 'Note vide'}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
