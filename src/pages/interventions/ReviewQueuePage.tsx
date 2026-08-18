import { CheckCircle2, ClipboardCheck, Search, XCircle, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { ROUTES } from '@/config/routes';
import {
  useReportsPendingReview,
  useReportStatusCounts,
  useReviewReport,
} from '@/features/interventions';
import {
  canReviewReport,
  memberDisplayName,
  useCurrentOrganization,
  usePermission,
} from '@/features/organizations';
import { useAuth } from '@/features/auth';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * File de contrôle des comptes rendus.
 *
 * Ordonnée du plus ancien au plus récent — c'est celui qui attend depuis le plus
 * longtemps qui bloque une facturation. Un tri par date décroissante ferait
 * traiter les derniers arrivés d'abord et vieillir indéfiniment les premiers.
 */
export default function ReviewQueuePage() {
  useDocumentTitle('Contrôle & Rapports');

  const { organization } = useCurrentOrganization();
  const reports = useReportsPendingReview(organization?.id ?? null);
  const counts = useReportStatusCounts(organization?.id ?? null);
  const { user } = useAuth();
  const { role } = usePermission();
  const { approve, reject } = useReviewReport();
  const [error, setError] = useState<unknown>(null);
  const [search, setSearch] = useState('');

  // `?? []` produit un tableau NEUF à chaque rendu quand la requête n'a pas
  // encore répondu. Le `useMemo` ci-dessous voyait donc sa dépendance changer
  // en permanence et recalculait le filtrage à chaque frappe, y compris quand
  // rien n'avait bougé.
  const rawList = useMemo(() => reports.data ?? [], [reports.data]);

  const list = useMemo(() => {
    if (!search.trim()) return rawList;
    const q = search.toLowerCase().trim();
    return rawList.filter((r) => {
      const ref = r.intervention?.mission?.reference?.toLowerCase() ?? '';
      const title = r.intervention?.mission?.title?.toLowerCase() ?? '';
      const tech = r.intervention?.technician
        ? memberDisplayName(r.intervention.technician).toLowerCase()
        : '';
      const desc = r.work_description?.toLowerCase() ?? '';
      return ref.includes(q) || title.includes(q) || tech.includes(q) || desc.includes(q);
    });
  }, [rawList, search]);

  const isTechnicianOnly = role === 'technician';

  const byStatus: Record<string, number> = counts.data ?? {};
  const drafts = byStatus['draft'] ?? 0;
  const rejected = byStatus['rejected'] ?? 0;
  const approved = byStatus['approved'] ?? 0;

  const emptyExplanation =
    drafts + rejected + approved === 0
      ? 'Aucun compte rendu dans cette entreprise pour l’instant. Ils apparaîtront ici une fois rédigés puis soumis — ce qui suppose la mission terminée.'
      : [
          drafts > 0
            ? `${drafts} compte${drafts > 1 ? 's' : ''} rendu${drafts > 1 ? 's' : ''} en cours de rédaction`
            : null,
          rejected > 0
            ? `${rejected} renvoyé${rejected > 1 ? 's' : ''} pour correction`
            : null,
          approved > 0 ? `${approved} déjà validé${approved > 1 ? 's' : ''}` : null,
        ]
          .filter((part) => part !== null)
          .join(', ') +
        '. Un compte rendu rejoint cette file une fois soumis, la mission terminée.';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contrôle & Rapports"
        description="Les comptes rendus soumis attendent votre validation. Vous pouvez valider ou refuser en motivant — le contenu appartient à son auteur."
      />

      {isTechnicianOnly && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center justify-between gap-3 text-xs text-foreground">
          <div className="flex items-center gap-2.5">
            <FileText className="size-4 shrink-0 text-primary" />
            <span>
              <strong>Espace Technicien :</strong> Cette file est dédiée au contrôle par les responsables. Pour rédiger ou consulter vos comptes rendus, ouvrez vos missions assignées.
            </span>
          </div>
          <Button asChild variant="outline" size="sm" className="text-3xs h-7 shrink-0">
            <Link to={ROUTES.missions}>Mes missions</Link>
          </Button>
        </div>
      )}

      {/* Barre de stats & recherche */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border">
        <div className="flex items-center gap-2 flex-wrap text-2xs font-semibold">
          <Badge variant="primary" className="text-3xs">
            {rawList.length} en attente de contrôle
          </Badge>
          {drafts > 0 && (
            <Badge variant="outline" className="text-3xs">
              {drafts} en rédaction
            </Badge>
          )}
          {approved > 0 && (
            <Badge variant="success" className="text-3xs">
              {approved} validé{approved > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {rawList.length > 0 && (
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrer par mission, technicien..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-surface text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

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
          description={emptyExplanation}
        />
      ) : (
        <ul className="space-y-3">
          {list.map((report) => (
            <li key={report.id}>
              <Card>
                <CardContent className="space-y-3 pt-5">
                  {/*
                    La carte se nomme.

                    Elle n'offrait qu'un lien « Voir l'intervention » : une file
                    de dix comptes rendus présentait dix cartes identiques, et
                    il fallait toutes les ouvrir pour savoir laquelle on
                    regardait.

                    Mission et auteur peuvent manquer — un chef d'équipe
                    contrôle sans détenir `mission.view_all`. On le dit alors,
                    plutôt que d'afficher un vide.
                  */}
                  <div className="flex flex-wrap items-center gap-2">
                    {report.intervention?.mission != null ? (
                      <Badge variant="outline">{report.intervention.mission.reference}</Badge>
                    ) : null}

                    <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                      {report.intervention?.mission?.title ?? 'Mission non consultable'}
                    </span>

                    <span className="text-subtle-foreground shrink-0 font-mono text-xs tabular-nums">
                      {report.submitted_at !== null
                        ? new Date(report.submitted_at).toLocaleDateString('fr-FR')
                        : '—'}
                    </span>
                  </div>

                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span>
                      Par{' '}
                      {report.intervention?.technician != null
                        ? memberDisplayName(report.intervention.technician)
                        : 'auteur non consultable'}
                    </span>

                    <Link
                      to={ROUTES.intervention(report.intervention_id)}
                      className="text-primary hover:underline"
                    >
                      Voir l’intervention
                    </Link>
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

                  {/*
                    Les deux commandes se partagent la largeur sur téléphone :
                    valider ou refuser se fait souvent depuis un véhicule, d'un
                    pouce. La règle porte sur le conteneur pour couvrir aussi le
                    déclencheur de `RejectDialog`, qui n'est pas rendu ici.
                  */}
                  {/*
                    Séparation des pouvoirs, reproduite ici.

                    `enforce_report_review_separation` refuse qu'un intervenant
                    valide son propre compte rendu — y compris s'il est
                    propriétaire de l'entreprise, cas courant chez un artisan qui
                    intervient lui-même. Afficher les boutons puis renvoyer un
                    refus ferait passer une règle voulue pour une panne.
                  */}
                  {!canReviewReport({
                    role,
                    reviewerUserId: user?.id ?? null,
                    technicianUserId: report.intervention?.technician?.user_id ?? null,
                  }) ? (
                    <p className="text-muted-foreground border-border rounded-md border border-dashed p-2.5 text-xs">
                      {report.intervention?.technician?.user_id === user?.id
                        ? 'Vous avez réalisé cette intervention : son contrôle revient à quelqu’un d’autre. C’est ce qui donne sa valeur au compte rendu.'
                        : 'Votre rôle ne permet pas de contrôler les comptes rendus.'}
                    </p>
                  ) : (
                  <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setError(null);
                        approve.mutate(report.id, {
                          onError: (mutationError) => {
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
                  )}
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
