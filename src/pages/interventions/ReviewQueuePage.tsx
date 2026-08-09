import { CheckCircle2, ClipboardCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { ROUTES } from '@/config/routes';
import { useReportsPendingReview, useReviewReport } from '@/features/interventions';
import { useCurrentOrganization } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * File de contrôle des comptes rendus.
 *
 * Ordonnée du plus ancien au plus récent — c'est celui qui attend depuis le plus
 * longtemps qui bloque une facturation. Un tri par date décroissante ferait
 * traiter les derniers arrivés d'abord et vieillir indéfiniment les premiers.
 */
export default function ReviewQueuePage() {
  useDocumentTitle('Contrôle');

  const { organization } = useCurrentOrganization();
  const reports = useReportsPendingReview(organization?.id ?? null);
  const { approve, reject } = useReviewReport();
  const [error, setError] = useState<unknown>(null);

  const list = reports.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contrôle"
        description="Les comptes rendus soumis attendent votre validation. Vous pouvez valider ou refuser en motivant — le contenu appartient à son auteur."
      />

      <FormError error={error} />

      {reports.isPending ? (
        <ListSkeleton />
      ) : reports.isError ? (
        <ErrorState
          error={reports.error}
          onRetry={() => {
            void reports.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Rien à contrôler"
          description="Aucun compte rendu n’attend de validation. Ils apparaîtront ici dès qu’un intervenant en soumettra un."
        />
      ) : (
        <ul className="space-y-3">
          {list.map((report) => (
            <li key={report.id}>
              <Card>
                <CardContent className="space-y-3 pt-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      to={ROUTES.intervention(report.intervention_id)}
                      className="text-primary text-sm font-medium hover:underline"
                    >
                      Voir l’intervention
                    </Link>
                    <span className="text-subtle-foreground font-mono text-xs tabular-nums">
                      Soumis le{' '}
                      {report.submitted_at !== null
                        ? new Date(report.submitted_at).toLocaleDateString('fr-FR')
                        : '—'}
                    </span>
                  </div>

                  {report.work_description !== null ? (
                    <p className="text-foreground line-clamp-4 text-sm whitespace-pre-line">
                      {report.work_description}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      Aucune description saisie.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setError(null);
                        approve.mutate(report.id, {
                          onError: (mutationError) => {
                            // Le refus le plus fréquent : c'est SON propre
                            // compte rendu. Le message du serveur le dit
                            // explicitement, et doit rester lisible.
                            setError(mutationError);
                          },
                        });
                      }}
                      disabled={approve.isPending}
                    >
                      <CheckCircle2 className="size-4" />
                      Valider
                    </Button>

                    <RejectDialog
                      onReject={(reason) => {
                        setError(null);
                        reject.mutate(
                          { reportId: report.id, reason },
                          {
                            onError: (mutationError) => {
                              setError(mutationError);
                            },
                          },
                        );
                      }}
                      busy={reject.isPending}
                    />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Refus motivé.
 *
 * Le motif est obligatoire et d'au moins cinq caractères — contrainte CHECK en
 * base. La vérifier ici évite un aller-retour pour un champ vide, et surtout
 * rappelle à quoi il sert : c'est ce que l'intervenant lira pour corriger.
 */
function RejectDialog({
  onReject,
  busy,
}: {
  onReject: (reason: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Refuser le compte rendu"
      description="Le motif sera transmis à l’intervenant, qui pourra corriger et resoumettre."
      trigger={
        <Button variant="outline" size="sm">
          <XCircle className="size-4" />
          Refuser
        </Button>
      }
    >
      <div className="space-y-4">
        <Textarea
          label="Motif du refus"
          rows={3}
          placeholder="Photos manquantes sur le raccordement, mesures d’atténuation absentes…"
          hint="Cinq caractères minimum. C’est ce que l’intervenant lira pour corriger."
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
            }}
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            disabled={reason.trim().length < 5 || busy}
            onClick={() => {
              onReject(reason.trim());
              setReason('');
              setOpen(false);
            }}
          >
            Refuser
          </Button>
        </div>
      </div>
    </Modal>
  );
}
