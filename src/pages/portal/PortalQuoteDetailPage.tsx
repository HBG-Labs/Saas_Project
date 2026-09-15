import { ArrowLeft, Ban, CheckCircle2, FileText } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  FileOpenButton,
  formatDateFr,
  formatEuros,
  PortalPageHeader,
  StatusBadge,
  usePortalQuote,
  useRespondPortalQuote,
} from '@/features/portal';
import { useDocumentTitle } from '@/lib/use-document-title';

const quantite = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/**
 * Détail d'un devis vu par le client, avec sa réponse.
 *
 * Accepter ou refuser passe par `portal_respond_quote` : la base vérifie que
 * le devis est bien à lui, encore « envoyé », non expiré — et journalise. La
 * page ne fait que demander confirmation avant d'envoyer la décision.
 */
export default function PortalQuoteDetailPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const quote = usePortalQuote(quoteId);
  const respond = useRespondPortalQuote();
  const [decision, setDecision] = useState<'accepted' | 'refused' | null>(null);
  const [error, setError] = useState<unknown>(null);
  useDocumentTitle(quote.data ? `Devis ${quote.data.reference}` : 'Devis');

  if (quote.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (quote.isError) {
    return (
      <ErrorState
        error={quote.error}
        onRetry={() => {
          void quote.refetch();
        }}
      />
    );
  }
  if (quote.data === null) {
    return (
      <EmptyState
        icon={FileText}
        title="Devis introuvable"
        description="Ce devis n’existe pas ou n’est pas visible dans votre espace."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.portalQuotes}>Retour aux devis</Link>
          </Button>
        }
      />
    );
  }

  const q = quote.data;
  const expire =
    q.valid_until !== null && new Date(q.valid_until) < new Date(new Date().toDateString());
  const peutRepondre = q.status === 'sent' && !expire;

  const confirmer = () => {
    if (decision === null) return;
    setError(null);
    respond.mutate(
      { quoteId: q.id, decision },
      {
        onSuccess: () => {
          setDecision(null);
        },
        onError: (e) => {
          setError(e);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={ROUTES.portalQuotes}>
          <ArrowLeft className="size-4" />
          Devis
        </Link>
      </Button>

      <PortalPageHeader
        title={q.title ?? `Devis ${q.reference}`}
        description={q.reference}
        icon={FileText}
        tone="info"
        summary={
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
            <StatusBadge status={q.status} kind="quote" />
            <p className="text-foreground text-lg font-bold tabular-nums sm:text-xl">
              {formatEuros(q.total_cents)}
            </p>
          </div>
        }
      />

      <div className="border-border bg-surface-sunken/50 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2.5 text-xs">
        <span className="text-muted-foreground">Émis le {formatDateFr(q.created_at)}</span>
        {q.valid_until ? (
          <span className="text-muted-foreground">
            · Valable jusqu’au {formatDateFr(q.valid_until)}
          </span>
        ) : null}
        {q.site_name ? <span className="text-muted-foreground">· {q.site_name}</span> : null}
        {expire && q.status === 'sent' ? (
          <Badge variant="warning" className="sm:ml-auto">
            Date de validité dépassée
          </Badge>
        ) : null}
      </div>

      {q.pdf_path ? (
        <FileOpenButton bucket="quote-documents" path={q.pdf_path} label="Télécharger le PDF" />
      ) : null}

      {/* Réponse : la seule décision que le portail permet, et elle est confirmée. */}
      {peutRepondre ? (
        <Card className="border-primary/30 bg-primary-subtle/40 rounded-2xl">
          <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm sm:max-w-xl">
              <p className="text-foreground font-semibold">Ce devis attend votre réponse</p>
              <p className="text-muted-foreground text-xs">
                Votre décision est transmise immédiatement à l’entreprise. Pour une question ou une
                modification, utilisez plutôt la messagerie.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex">
              <Button
                variant="outline"
                size="sm"
                className="border-error/40 text-error hover:bg-error/10 w-full sm:w-auto"
                onClick={() => {
                  setDecision('refused');
                }}
              >
                <Ban className="size-4" />
                Refuser
              </Button>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setDecision('accepted');
                }}
              >
                <CheckCircle2 className="size-4" />
                Accepter le devis
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : q.client_responded_at !== null ? (
        <p className="text-muted-foreground text-xs">
          Vous avez {q.status === 'accepted' ? 'accepté' : 'refusé'} ce devis le{' '}
          {formatDateFr(q.client_responded_at, true)}.
        </p>
      ) : null}

      <Card className="overflow-hidden rounded-2xl">
        <CardHeader className="border-border bg-surface-sunken/40 border-b">
          <CardTitle className="text-sm">Détail des prestations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Téléphone : cartes ; écran large : tableau. */}
          <ul className="divide-border divide-y md:hidden">
            {q.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="text-foreground">{item.description}</p>
                  <p className="text-muted-foreground text-xs">
                    {quantite.format(item.quantity)} {item.unit} ×{' '}
                    {formatEuros(item.unit_price_cents)}
                  </p>
                </div>
                <span className="text-foreground shrink-0 font-semibold">
                  {formatEuros(item.line_total_cents)}
                </span>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken/60 text-muted-foreground text-xs">
                <tr>
                  <th className="rounded-l-lg px-3 py-2 text-left font-medium">Désignation</th>
                  <th className="px-3 py-2 text-right font-medium">Quantité</th>
                  <th className="px-3 py-2 text-right font-medium">Prix unitaire HT</th>
                  <th className="rounded-r-lg px-3 py-2 text-right font-medium">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {q.items.map((item) => (
                  <tr key={item.id}>
                    <td className="text-foreground px-3 py-2.5">{item.description}</td>
                    <td className="text-muted-foreground px-3 py-2.5 text-right">
                      {quantite.format(item.quantity)} {item.unit}
                    </td>
                    <td className="text-muted-foreground px-3 py-2.5 text-right">
                      {formatEuros(item.unit_price_cents)}
                    </td>
                    <td className="text-foreground px-3 py-2.5 text-right font-semibold">
                      {formatEuros(item.line_total_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="bg-surface-sunken/60 ml-auto w-full max-w-xs space-y-1.5 rounded-xl p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total HT</dt>
              <dd className="text-foreground">{formatEuros(q.subtotal_cents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">TVA ({q.vat_rate} %)</dt>
              <dd className="text-foreground">{formatEuros(q.vat_cents)}</dd>
            </div>
            <div className="flex justify-between text-base font-bold">
              <dt className="text-foreground">Total TTC</dt>
              <dd className="text-foreground">{formatEuros(q.total_cents)}</dd>
            </div>
          </dl>

          {q.notes ? (
            <p className="text-muted-foreground border-border border-t pt-3 text-xs whitespace-pre-wrap">
              {q.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Modal
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        title={decision === 'accepted' ? 'Accepter ce devis ?' : 'Refuser ce devis ?'}
        description={
          decision === 'accepted'
            ? `Vous acceptez le devis ${q.reference} pour ${formatEuros(q.total_cents)} TTC. L’entreprise en sera informée.`
            : `Vous refusez le devis ${q.reference}. L’entreprise en sera informée ; vous pourrez toujours lui écrire.`
        }
      >
        <FormError error={error} />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setDecision(null);
            }}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            variant={decision === 'accepted' ? 'primary' : 'danger-outline'}
            disabled={respond.isPending}
            isLoading={respond.isPending}
            loadingLabel="Envoi de votre réponse"
            onClick={confirmer}
            className="w-full sm:w-auto"
          >
            {respond.isPending
              ? 'Envoi…'
              : decision === 'accepted'
                ? 'Confirmer l’acceptation'
                : 'Confirmer le refus'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
