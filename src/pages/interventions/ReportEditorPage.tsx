import { AlertTriangle, ArrowLeft, Pen, Printer, Send, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { ROUTES } from '@/config/routes';
import { FEATURES, useOrganizationEntitlements } from '@/features/billing';
import { ChecklistCard, InterventionFormCard } from '@/features/industries';
import { useChangeMissionStatus, useMission } from '@/features/missions';
import { useAuth } from '@/features/auth';
import {
  AttachmentGallery,
  InterventionPdfModal,
  SignaturePadModal,
  useAttachments,
  useCreateReport,
  useIntervention,
  useSaveReport,
  useSubmitReport,
  useWorkedSeconds,
} from '@/features/interventions';
import { useCurrentOrganization } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { ReportStatus } from '@/types/database';

const STATUS_LABELS: Record<ReportStatus, string> = {
  draft: 'Brouillon',
  submitted: 'Soumis au contrôle',
  approved: 'Validé',
  rejected: 'Refusé',
};

export default function ReportEditorPage() {
  useDocumentTitle('Compte rendu');

  const { interventionId } = useParams<{ interventionId: string }>();
  const { user } = useAuth();
  const { organization, membership } = useCurrentOrganization();
  const { has } = useOrganizationEntitlements(organization?.id ?? null);

  const intervention = useIntervention(interventionId);
  const workedSecondsQuery = useWorkedSeconds(interventionId);
  // La mission porte le statut que la machine à états fait avancer ; le compte
  // rendu ne peut partir au contrôle que depuis `completed`.
  const mission = useMission(intervention.data?.mission_id);
  const advanceMission = useChangeMissionStatus(intervention.data?.mission_id ?? '');
  const attachments = useAttachments(interventionId);
  const createReport = useCreateReport(interventionId ?? '');
  const submitReport = useSubmitReport(interventionId ?? '');

  const report = intervention.data?.report ?? null;
  const saveReport = useSaveReport(report?.id ?? '', interventionId);

  const [workDescription, setWorkDescription] = useState('');
  const [observations, setObservations] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loadedReportId, setLoadedReportId] = useState<string | null>(null);

  const [isCustomerSignOpen, setIsCustomerSignOpen] = useState(false);
  const [isTechSignOpen, setIsTechSignOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  /**
   * Amorçage du formulaire à l'arrivée des données.
   *
   * Ajusté PENDANT le rendu et non dans un effet — c'est le motif que React
   * recommande pour synchroniser un état sur une donnée reçue. Un effet
   * déclencherait un second rendu après affichage, et l'utilisateur verrait les
   * champs vides une fraction de seconde avant qu'ils ne se remplissent.
   *
   * La garde sur l'identifiant est essentielle : sans elle, chaque
   * rafraîchissement de la requête écraserait la saisie en cours.
   */
  if (report !== null && report.id !== loadedReportId) {
    setLoadedReportId(report.id);
    setWorkDescription(report.work_description ?? '');
    setObservations(report.observations ?? '');
  }

  if (intervention.isPending) {
    return <Skeleton className="h-64 w-full" />;
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
   * Seul l'auteur écrit, et seulement tant que le compte rendu n'est pas validé.
   *
   * Reproduit `intervention_reports_update` et le trigger de paternité : un
   * compte rendu validé est définitif pour tout le monde, son auteur compris.
   * Une correction passe par un refus motivé, qui laisse une trace.
   */
  const isAuthor = membership !== null && data.technician_id === membership.id;
  const isEditable =
    isAuthor && (report === null || report.status === 'draft' || report.status === 'rejected');

  /**
   * Le compte rendu ne part au contrôle que depuis une mission `completed`.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * POURQUOI CE N'EST PAS AUTOMATIQUE
   *
   * `mission_status_transitions` ne déclare que `completed → submitted` : une
   * mission encore `in_progress` fait échouer la soumission par le trigger
   * `sync_mission_from_report`.
   *
   * Terminer une INTERVENTION ne termine pas la MISSION, et c'est délibéré —
   * une mission peut compter plusieurs passages sur site. Le technicien qui
   * clôt son relevé de temps n'a pas forcément fini le chantier.
   *
   * Mais l'écran ne doit pas pour autant renvoyer ailleurs : le geste qui
   * débloque se fait ICI, en un clic, sans quitter le compte rendu en cours de
   * rédaction. La décision reste explicite, l'aller-retour disparaît.
   * ───────────────────────────────────────────────────────────────────────────
   */
  const missionStatus = mission.data?.status ?? null;
  const worksFinished = missionStatus === null || missionStatus === 'completed';

  /** Transition à opérer pour débloquer, selon l'état réel de la mission. */
  const unblock: { to: 'completed' | 'in_progress'; label: string; explanation: string } | null =
    missionStatus === 'in_progress'
      ? {
          to: 'completed',
          label: 'Terminer les travaux',
          explanation:
            'Vous avez clôturé votre relevé de temps, mais la mission reste ouverte — elle peut compter plusieurs passages sur site. Confirmez que le chantier est achevé pour transmettre le compte rendu.',
        }
      : missionStatus === 'rejected'
        ? {
            to: 'in_progress',
            label: 'Reprendre les travaux',
            explanation:
              'Ce compte rendu vous a été renvoyé. Reprenez la mission pour le corriger, puis terminez-la à nouveau avant de la soumettre.',
          }
        : null;

  /** Comparé au texte SERVEUR, jamais à un drapeau posé à la frappe : revenir sur sa saisie ne compte pas comme une modification. */
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
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={ROUTES.intervention(interventionId)}>
          <ArrowLeft className="size-4" />
          Intervention
        </Link>
      </Button>

      <PageHeader
        title="Compte rendu"
        description="Ce que vous écrivez ici fait foi : le contrôleur peut le valider ou le refuser, il ne peut pas le réécrire."
        actions={
          <div className="flex items-center gap-2">
            {report !== null && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPdfModalOpen(true)}
                className="text-xs gap-1.5"
              >
                <Printer className="size-3.5" />
                <span>PV / PDF</span>
              </Button>
            )}
            {report !== null ? <Badge>{STATUS_LABELS[report.status]}</Badge> : null}
          </div>
        }
      />

      <FormError error={error} />

      {report !== null && report.status === 'rejected' && report.rejection_reason !== null ? (
        <div className="border-error-border bg-error-subtle rounded-lg border p-3">
          <p className="text-foreground text-sm font-medium">Compte rendu refusé</p>
          <p className="text-muted-foreground mt-1 text-xs">{report.rejection_reason}</p>
        </div>
      ) : null}

      {report === null ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-muted-foreground text-sm">
              Aucun compte rendu n’a encore été ouvert pour cette intervention.
            </p>
            {isAuthor ? (
              <Button
                variant="primary"
                onClick={() => {
                  createReport.mutate({ interventionId });
                }}
                disabled={createReport.isPending}
              >
                Rédiger le compte rendu
              </Button>
            ) : (
              <p className="text-muted-foreground text-xs">
                Seul l’intervenant peut ouvrir le compte rendu de son intervention.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Travaux réalisés</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label="Description des travaux"
                rows={6}
                placeholder="Nature de l’intervention, opérations effectuées, mesures relevées."
                value={workDescription}
                onChange={(event) => {
                  setWorkDescription(event.target.value);
                }}
                disabled={!isEditable}
              />

              <Textarea
                label="Observations"
                rows={4}
                placeholder="Anomalies constatées, réserves, préconisations."
                value={observations}
                onChange={(event) => {
                  setObservations(event.target.value);
                }}
                disabled={!isEditable}
              />

              {isEditable ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant={hasUnsavedChanges ? 'primary' : 'outline'}
                    className="w-full sm:w-auto"
                    onClick={save}
                    disabled={saveReport.isPending || !hasUnsavedChanges}
                  >
                    {saveReport.isPending
                      ? 'Enregistrement…'
                      : hasUnsavedChanges
                        ? 'Enregistrer les modifications'
                        : 'Enregistré'}
                  </Button>

                  {hasUnsavedChanges ? (
                    <span className="text-warning text-xs">Modifications non enregistrées.</span>
                  ) : savedAt !== null ? (
                    <span className="text-success text-xs">
                      Enregistré à {savedAt.toLocaleTimeString('fr-FR')}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {organization !== null ? (
            <ChecklistCard
              interventionId={data.id}
              organizationId={organization.id}
              interventionTypeId={mission.data?.intervention_type_id ?? null}
              readOnly={
                report !== null && report.status !== 'draft' && report.status !== 'rejected'
              }
            />
          ) : null}

          {organization !== null ? (
            <InterventionFormCard
              interventionId={data.id}
              organizationId={organization.id}
              interventionTypeId={mission.data?.intervention_type_id ?? null}
              readOnly={
                report !== null && report.status !== 'draft' && report.status !== 'rejected'
              }
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Photos et documents</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentGallery
                interventionId={interventionId}
                organizationId={organization?.id ?? ''}
                missionId={data.mission_id}
                uploadedBy={user?.id ?? ''}
                attachments={attachments.data ?? []}
                canEdit={isEditable}
                hasAttachmentsFeature={has(FEATURES.attachments)}
              />
            </CardContent>
          </Card>

          {/* ✍️ Signatures électroniques */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Signatures & Validation terrain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Signature Technicien */}
                <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/50 flex flex-col justify-between min-h-[140px] space-y-2">
                  <div>
                    <span className="text-3xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      Signature Intervenant / Technicien
                    </span>
                    <p className="text-xs font-bold text-foreground mt-0.5">
                      {user?.email ?? 'Technicien'}
                    </p>
                  </div>

                  {report.technician_signature_path ? (
                    <div className="space-y-1">
                      <div className="p-1 rounded bg-white dark:bg-surface-sunken border border-border inline-block">
                        <img
                          src={report.technician_signature_path}
                          alt="Signature technicien"
                          className="max-h-14 object-contain"
                        />
                      </div>
                      <p className="text-success font-semibold flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        Signature enregistrée
                      </p>
                    </div>
                  ) : (
                    <p className="text-3xs text-muted-foreground italic">Non signée</p>
                  )}

                  {isEditable && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsTechSignOpen(true)}
                      className="text-xs h-7 gap-1 self-start cursor-pointer"
                    >
                      <Pen className="size-3" />
                      <span>{report.technician_signature_path ? 'Modifier' : 'Signer'}</span>
                    </Button>
                  )}
                </div>

                {/* Signature Client */}
                <div className="p-3.5 rounded-xl border border-border bg-surface-subtle/50 flex flex-col justify-between min-h-[140px] space-y-2">
                  <div>
                    <span className="text-3xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      Signature Client / Réceptionnaire
                    </span>
                    <p className="text-xs font-bold text-foreground mt-0.5">
                      {report.customer_signature_name || mission.data?.customer?.name || 'Client'}
                    </p>
                  </div>

                  {report.customer_signature_path ? (
                    <div className="space-y-1">
                      <div className="p-1 rounded bg-white dark:bg-surface-sunken border border-border inline-block">
                        <img
                          src={report.customer_signature_path}
                          alt="Signature client"
                          className="max-h-14 object-contain"
                        />
                      </div>
                      <p className="text-success font-semibold flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        Signé par {report.customer_signature_name || 'le client'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-3xs text-muted-foreground italic">En attente de signature</p>
                  )}

                  {isEditable && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsCustomerSignOpen(true)}
                      className="text-xs h-7 gap-1 self-start cursor-pointer"
                    >
                      <Pen className="size-3" />
                      <span>{report.customer_signature_path ? 'Faire re-signer' : 'Faire signer le client'}</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {isEditable ? (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <p className="text-muted-foreground text-xs">
                  Une fois soumis, le compte rendu part au contrôle et n’est plus modifiable —
                  sauf s’il vous est renvoyé avec un motif.
                </p>

                {!worksFinished ? (
                  <div className="border-warning/40 bg-warning/10 flex gap-2 rounded-md border p-3">
                    <AlertTriangle
                      className="text-warning mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="space-y-2 text-xs">
                      <p className="text-foreground font-medium">
                        {unblock?.to === 'in_progress'
                          ? 'Compte rendu renvoyé pour correction.'
                          : 'La mission est encore ouverte.'}
                      </p>
                      <p className="text-muted-foreground">
                        {unblock?.explanation ??
                          'Cette mission n’est pas dans un état permettant la soumission.'}
                      </p>

                      <FormError error={advanceMission.error} />

                      {unblock !== null ? (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={advanceMission.isPending}
                            onClick={() => {
                              setError(null);
                              saveReport.mutate(
                                { work_description: workDescription, observations },
                                { onSuccess: () => setSavedAt(new Date()) },
                              );
                              advanceMission.mutate(unblock.to);
                            }}
                          >
                            {advanceMission.isPending ? 'Enregistrement…' : unblock.label}
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link to={ROUTES.mission(data.mission_id)}>Ouvrir la mission</Link>
                          </Button>
                        </div>
                      ) : (
                        <Button asChild variant="outline" size="sm" className="mt-1">
                          <Link to={ROUTES.mission(data.mission_id)}>Ouvrir la mission</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
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
                    !worksFinished ||
                    saveReport.isPending ||
                    submitReport.isPending ||
                    workDescription.trim() === ''
                  }
                >
                  <Send className="size-4" />
                  Soumettre au contrôle
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {/* Modales de Signature & PDF */}
      <SignaturePadModal
        open={isCustomerSignOpen}
        onOpenChange={setIsCustomerSignOpen}
        title="Signature du client / réceptionnaire"
        description="Faites signer le client directement sur votre écran pour attester de la bonne réception des travaux."
        defaultSignerName={report?.customer_signature_name || mission.data?.customer?.name || ''}
        signerRoleLabel="Nom complet du signataire client"
        onSaveSignature={({ signatureDataUrl, signerName }) => {
          if (!report) return;
          saveReport.mutate({
            customer_signature_path: signatureDataUrl,
            customer_signature_name: signerName,
          });
        }}
      />

      <SignaturePadModal
        open={isTechSignOpen}
        onOpenChange={setIsTechSignOpen}
        title="Signature du technicien intervenant"
        description="Apposez votre signature pour certifier l’exactitude du compte-rendu d’intervention."
        defaultSignerName={user?.email || 'Technicien'}
        signerRoleLabel="Nom du technicien"
        onSaveSignature={({ signatureDataUrl }) => {
          if (!report) return;
          saveReport.mutate({
            technician_signature_path: signatureDataUrl,
          });
        }}
      />

      <InterventionPdfModal
        open={isPdfModalOpen}
        onOpenChange={setIsPdfModalOpen}
        organizationName={organization?.name}
        mission={mission.data}
        intervention={intervention.data}
        report={report}
        attachments={attachments.data ?? []}
        workedSeconds={workedSecondsQuery.data ?? 0}
      />
    </div>
  );
}
