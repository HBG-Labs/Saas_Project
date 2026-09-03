import { CheckCircle2, ClipboardCheck, FileText, Send, Sparkles, Plus, AlertCircle, BookOpen, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

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
  const activeInterventionId = selectedInterventionId || (interventionList[0]?.id ?? 'inter-001');

  const intervention = useIntervention(activeInterventionId);
  const attachments = useAttachments(activeInterventionId);
  const createReport = useCreateReport(activeInterventionId);
  const submitReport = useSubmitReport(activeInterventionId);

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
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ClipboardCheck className="size-4 text-primary" />
            Sélectionner l’intervention / chantier
          </CardTitle>
          {activeInterventionId && (
            <Button asChild variant="ghost" size="sm" className="text-xs gap-1 text-primary">
              <Link to={ROUTES.interventionReport(activeInterventionId)}>
                <ExternalLink className="size-3.5" />
                Éditeur complet & Signatures
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {interventionList.length === 0 && missionList.length === 0 ? (
              <p className="text-xs text-muted-foreground col-span-full">
                Chargement des interventions et missions...
              </p>
            ) : interventionList.length > 0 ? (
              interventionList.map((item) => {
                const isSelected = item.id === activeInterventionId;
                const rep = item.report;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedInterventionId(item.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-2xs font-semibold'
                        : 'border-border/60 hover:border-primary/50 bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between text-2xs mb-1 text-muted-foreground">
                      <span className="font-mono font-bold text-foreground">
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
                    <h4 className="text-xs font-bold text-foreground truncate">
                      Intervention du{' '}
                      {item.start_time
                        ? new Date(item.start_time).toLocaleDateString('fr-FR')
                        : 'chantier'}
                    </h4>
                    <p className="text-2xs text-muted-foreground truncate mt-0.5">
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
                  className="p-3.5 rounded-xl border border-border/60 hover:border-primary/50 bg-surface text-left transition-all block"
                >
                  <div className="flex items-center justify-between text-2xs mb-1 text-muted-foreground">
                    <span className="font-mono font-bold text-foreground">{m.reference}</span>
                    <Badge variant="outline" className="text-3xs py-0">
                      {m.status === 'completed' ? 'Terminée' : 'En cours'}
                    </Badge>
                  </div>
                  <h4 className="text-xs font-bold text-foreground truncate">{m.title}</h4>
                  <p className="text-2xs text-primary truncate mt-1 font-medium">
                    → Démarrer l’intervention sur la mission
                  </p>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formulaire de Rédaction de Compte-rendu */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="size-4 text-primary" />
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
          <div className="border-error/30 bg-error/10 rounded-xl border p-4 text-error">
            <p className="text-sm font-bold flex items-center gap-1.5">
              <AlertCircle className="size-4" />
              Compte rendu refusé par le responsable
            </p>
            <p className="mt-1 text-xs leading-relaxed">{report.rejection_reason}</p>
          </div>
        ) : null}

        {report === null ? (
          <Card>
            <CardContent className="space-y-4 pt-6 text-center py-8">
              <p className="text-sm text-foreground font-medium">
                Aucun compte rendu n’a encore été ouvert pour cette intervention.
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Cliquez ci-dessous pour ouvrir la fiche et saisir vos notes de travaux, observations et photos du chantier.
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  createReport.mutate({ interventionId: selectedInterventionId });
                }}
                disabled={createReport.isPending}
                className="gap-2 shadow-md"
              >
                <Plus className="size-4" />
                Ouvrir et Rédiger le Compte-rendu
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold">Nature des travaux réalisés</CardTitle>
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
                      className="gap-2"
                    >
                      {saveReport.isPending
                        ? 'Enregistrement…'
                        : hasUnsavedChanges
                          ? 'Enregistrer les modifications'
                          : 'Brouillon enregistré'}
                    </Button>

                    {hasUnsavedChanges ? (
                      <span className="text-warning text-xs font-medium">
                        Modifications non enregistrées
                      </span>
                    ) : savedAt !== null ? (
                      <span className="text-success text-xs font-medium flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />
                        Enregistré à {savedAt.toLocaleTimeString('fr-FR')}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Photos du terrain & pièces jointes */}
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Photos du chantier & Documents</CardTitle>
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
                />
              </CardContent>
            </Card>

            {isEditable ? (
              <Card className="border-primary/30 bg-primary/5 shadow-sm">
                <CardContent className="space-y-3 pt-6">
                  <div className="space-y-1">
                    <p className="text-foreground text-sm font-bold flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      Finaliser et transmettre le compte-rendu
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Une fois transmis, votre compte-rendu est immédiatement envoyé à votre responsable pour contrôle et validation.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full font-bold gap-2 shadow-md"
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
                    disabled={saveReport.isPending || submitReport.isPending || workDescription.trim() === ''}
                  >
                    <Send className="size-4" />
                    Soumettre le compte-rendu au contrôle
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
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
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <BookOpen className="size-3.5 text-primary" />
          Insérer depuis mon Bloc-notes
        </Button>
      }
    >
      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Aucune note enregistrée dans votre bloc-notes.
          </p>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                className="w-full text-left p-3 rounded-xl border border-border/60 hover:border-primary bg-surface transition-all cursor-pointer flex flex-col gap-1 focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => {
                  onInsert(note.content);
                  setOpen(false);
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-foreground">{note.title}</span>
                  <Badge variant="outline" className="text-3xs">Insérer</Badge>
                </div>
                <p className="text-2xs text-muted-foreground line-clamp-2">
                  {note.content || 'Note vide'}
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
