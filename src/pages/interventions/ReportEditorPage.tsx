import { ArrowLeft, Send } from 'lucide-react';
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
import { useAuth } from '@/features/auth';
import {
  AttachmentGallery,
  useAttachments,
  useCreateReport,
  useIntervention,
  useSaveReport,
  useSubmitReport,
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

  const intervention = useIntervention(interventionId);
  const attachments = useAttachments(interventionId);
  const createReport = useCreateReport(interventionId ?? '');
  const submitReport = useSubmitReport(interventionId ?? '');

  const report = intervention.data?.report ?? null;
  const saveReport = useSaveReport(report?.id ?? '');

  const [workDescription, setWorkDescription] = useState('');
  const [observations, setObservations] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loadedReportId, setLoadedReportId] = useState<string | null>(null);

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

  const save = () => {
    if (report === null) return;
    setError(null);
    saveReport.mutate(
      { work_description: workDescription, observations },
      {
        onSuccess: () => {
          setSavedAt(new Date());
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
        actions={report !== null ? <Badge>{STATUS_LABELS[report.status]}</Badge> : null}
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
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={save} disabled={saveReport.isPending}>
                    {saveReport.isPending ? 'Enregistrement…' : 'Enregistrer'}
                  </Button>
                  {savedAt !== null ? (
                    <span className="text-success text-xs">
                      Enregistré à {savedAt.toLocaleTimeString('fr-FR')}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

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
              />
            </CardContent>
          </Card>

          {isEditable ? (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <p className="text-muted-foreground text-xs">
                  Une fois soumis, le compte rendu part au contrôle et n’est plus modifiable —
                  sauf s’il vous est renvoyé avec un motif.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setError(null);
                    // On enregistre AVANT de soumettre : sans cela, la dernière
                    // frappe non sauvegardée partirait au contrôle sans y figurer.
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
                  Soumettre au contrôle
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
