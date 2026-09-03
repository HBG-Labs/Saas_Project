import { useState } from 'react';
import { ArrowLeft, Ban, CheckCircle2, Download, Send, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { toEuros, useDeleteQuote, useQuote, useUpdateQuote } from '@/features/quotes';
import { formatDate } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { QuoteStatus } from '@/types/database';

const STATUS_CONFIG: Record<QuoteStatus, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
  draft: { label: 'Brouillon', variant: 'neutral' },
  sent: { label: 'Envoyé', variant: 'info' },
  accepted: { label: 'Accepté', variant: 'success' },
  refused: { label: 'Refusé', variant: 'error' },
  expired: { label: 'Expiré', variant: 'warning' },
};

export default function QuoteDetailPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const canManage = can(PERMISSIONS.quoteManage);

  const quoteQuery = useQuote(quoteId);
  const quote = quoteQuery.data ?? null;

  const updateQuote = useUpdateQuote(quoteId ?? '');
  const deleteQuote = useDeleteQuote();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useDocumentTitle(quote ? `Devis ${quote.reference}` : 'Devis');

  const handleDelete = () => {
    if (quoteId === undefined) return;
    deleteQuote.mutate(quoteId, {
      onSuccess: () => {
        void navigate(ROUTES.quotesHistory);
      },
    });
  };

  if (quoteQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <PageHeader title="Devis" />
        <ErrorState error={quoteQuery.error} onRetry={() => void quoteQuery.refetch()} />
      </div>
    );
  }

  if (quoteQuery.isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12" aria-hidden="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (quote === null) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <PageHeader title="Devis introuvable" />
        <ErrorState
          error={new Error('Ce devis n’existe pas ou a été supprimé.')}
          title="Devis introuvable"
        />
      </div>
    );
  }

  const status = STATUS_CONFIG[quote.status];
  const totalHT = quote.totals ? toEuros(quote.totals.subtotal_cents) : 0;
  const totalVAT = quote.totals ? toEuros(quote.totals.vat_cents) : 0;
  const totalTTC = quote.totals ? toEuros(quote.totals.total_cents) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <Link
        to={ROUTES.quotesHistory}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Historique des devis
      </Link>

      <PageHeader
        title={quote.reference}
        description={quote.customer_name || quote.title || 'Client non renseigné'}
        actions={
          <>
            <Badge variant={status.variant} className="self-center">
              {status.label}
            </Badge>
            <Button variant="outline" className="gap-2" onClick={() => window.print()}>
              <Download className="size-4" aria-hidden="true" />
              PDF
            </Button>
          </>
        }
      />

      {/*
        MODIFIER LE STATUT NE MODIFIE JAMAIS LES LIGNES.

        Un devis accepté est un engagement pris avec le client sur des montants
        précis : rouvrir ses lignes après coup permettrait de faire dire au
        document accepté autre chose que ce qui a été signé. Seul l'EN-TÊTE
        (le statut) évolue ; le détail chiffré reste ce qu'il était au moment
        de l'enregistrement.
      */}
      {canManage && quote.status !== 'accepted' && quote.status !== 'refused' && (
        <div className="border-border bg-surface-subtle/50 flex flex-wrap items-center gap-2 rounded-xl border p-3">
          <span className="text-muted-foreground text-xs font-medium">Faire évoluer le statut :</span>

          {quote.status === 'draft' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={updateQuote.isPending}
              onClick={() => updateQuote.mutate({ status: 'sent' })}
            >
              <Send className="size-3.5" aria-hidden="true" />
              Marquer comme envoyé
            </Button>
          )}

          {quote.status === 'sent' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="border-success/40 text-success hover:bg-success/10 gap-1.5 text-xs"
                disabled={updateQuote.isPending}
                onClick={() => updateQuote.mutate({ status: 'accepted' })}
              >
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Marquer comme accepté
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-error/40 text-error hover:bg-error/10 gap-1.5 text-xs"
                disabled={updateQuote.isPending}
                onClick={() => updateQuote.mutate({ status: 'refused' })}
              >
                <Ban className="size-3.5" aria-hidden="true" />
                Marquer comme refusé
              </Button>
            </>
          )}
        </div>
      )}

      {/*
        ZONE IMPRIMABLE : COULEURS EN DUR VOLONTAIRES.

        Même raison que sur `QuotesPage` : ce document part chez le client, à
        l'impression ou en PDF. Il reste noir sur blanc quel que soit le thème
        de l'application.
      */}
      <div
        id="quote-printable-area"
        className="rounded-xl border border-slate-300 bg-white p-6 text-slate-900 shadow-2xl space-y-6 font-sans sm:p-8"
      >
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-blue-900">
              {organization?.name ?? 'REZO360 Pro'}
            </h2>
            {organization?.legal_name && organization.legal_name !== organization.name && (
              <p className="text-xs font-semibold text-slate-600">{organization.legal_name}</p>
            )}
            <p className="mt-1 text-2xs text-slate-500">
              {organization?.registration_number ? `SIRET : ${organization.registration_number}` : ''}
              {organization?.registration_number && organization?.vat_number ? ' • ' : ''}
              {organization?.vat_number ? `TVA : ${organization.vat_number}` : ''}
            </p>
          </div>

          <div className="text-right">
            <span className="inline-block rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-900">
              DEVIS N° {quote.reference}
            </span>
            <p className="mt-1 text-2xs text-slate-500">Émis le : {formatDate(quote.created_at)}</p>
            {quote.valid_until && (
              <p className="text-2xs text-slate-500">Valide jusqu’au : {formatDate(quote.valid_until)}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
          <div>
            <p className="text-3xs font-bold tracking-wider text-slate-500 uppercase">Destinataire client</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {quote.customer_name || 'Client non spécifié'}
            </p>
          </div>
          <div>
            <p className="text-3xs font-bold tracking-wider text-slate-500 uppercase">Site d’intervention</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {quote.site_name || 'Site principal'}
            </p>
          </div>
        </div>

        <div className="scroll-x">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 font-semibold text-slate-700">
                <th className="px-3 py-2.5">Désignation de la prestation</th>
                <th className="px-2 py-2.5 text-center">Qté</th>
                <th className="px-2 py-2.5 text-center">Unité</th>
                <th className="px-3 py-2.5 text-right">P.U HT</th>
                <th className="px-3 py-2.5 text-right">Total HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {quote.items.map((item) => {
                const priceEuros = toEuros(item.unit_price_cents);
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2.5 font-medium text-slate-900">{item.description}</td>
                    <td className="px-2 py-2.5 text-center">{item.quantity}</td>
                    <td className="px-2 py-2.5 text-center text-slate-500">{item.unit}</td>
                    <td className="px-3 py-2.5 text-right">{priceEuros.toFixed(2)} €</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                      {(item.quantity * priceEuros).toFixed(2)} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-end justify-between gap-4 border-t border-slate-300 pt-4 sm:flex-row">
          <div className="space-y-1 text-3xs text-slate-500">
            <p>
              <strong>Conditions de règlement :</strong> Paiement à 30 jours à compter de la réception.
            </p>
            <p>
              <strong>Mode de paiement :</strong> Virement bancaire / Carte bancaire Pro.
            </p>
          </div>

          <div className="w-full space-y-1.5 border-t border-slate-200 pt-3 text-right text-xs sm:w-56 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
            <div className="flex justify-between text-slate-600">
              <span>Total HT :</span>
              <span className="font-semibold text-slate-900">{totalHT.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>TVA ({quote.vat_rate}%) :</span>
              <span>{totalVAT.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold text-blue-900">
              <span>TOTAL TTC :</span>
              <span className="text-base text-blue-900">{totalTTC.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </div>

      {canManage && (
        <Card className="border-error/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-foreground text-xs font-semibold">Supprimer ce devis</p>
              <p className="text-muted-foreground text-3xs">
                Le devis et ses lignes sont définitivement retirés. Cette action est irréversible.
              </p>
            </div>
            <Button
              variant="danger-outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Supprimer
            </Button>
          </CardContent>
        </Card>
      )}

      <Modal
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="Supprimer ce devis ?"
        description={`Le devis ${quote.reference} et ses lignes seront définitivement supprimés.`}
      >
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
            Annuler
          </Button>
          <Button
            variant="danger-outline"
            disabled={deleteQuote.isPending}
            onClick={handleDelete}
            className="gap-1.5"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {deleteQuote.isPending ? 'Suppression…' : 'Supprimer définitivement'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
