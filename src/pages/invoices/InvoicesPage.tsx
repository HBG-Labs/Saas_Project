import { Calculator, ChevronRight, FileText, ReceiptText } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { toEuros, useInvoices } from '@/features/invoices';
import { useCurrentOrganization } from '@/features/organizations';
import { formatInvoiceDate } from '@/features/einvoicing';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { InvoiceStatus } from '@/types/database';

/**
 * Les factures de l'organisation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE PAGE NE DIT PAS ENCORE
 *
 * Rien sur le règlement. Une facture dont l'échéance est passée n'est PAS
 * affichée comme impayée : REZO360 n'a aujourd'hui aucune preuve du paiement ni
 * du non-paiement, et annoncer « Impayée » à propos d'un client qui a viré la
 * somme la veille est une faute vis-à-vis de l'utilisateur comme de son client.
 *
 * Le suivi des règlements viendra avec ses propres colonnes et son bouton
 * « Marquer comme payée ». D'ici là, la page se tait sur ce qu'elle ignore.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  draft: { label: 'Brouillon', variant: 'neutral' },
  issued: { label: 'Émise', variant: 'info' },
  sent: { label: 'Envoyée', variant: 'info' },
  paid: { label: 'Payée', variant: 'success' },
  cancelled: { label: 'Annulée', variant: 'error' },
};

export default function InvoicesPage() {
  useDocumentTitle('Factures');

  const { organization } = useCurrentOrganization();
  const invoicesQuery = useInvoices(organization?.id ?? null);
  const invoices = invoicesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <PageHeader
        title="Factures"
        description="Vos factures et avoirs, avec leur statut et leur montant."
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to={ROUTES.quotesHistory}>
              <Calculator className="size-4" aria-hidden="true" />
              Facturer un devis
            </Link>
          </Button>
        }
      />

      {invoicesQuery.isError ? (
        <ErrorState error={invoicesQuery.error} onRetry={() => void invoicesQuery.refetch()} />
      ) : invoicesQuery.isPending ? (
        <div className="space-y-2.5" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Aucune facture"
          description="Une facture se crée aujourd’hui à partir d’un devis accepté : elle en reprend les lignes, le client et les montants."
          action={
            <Button asChild variant="primary" className="gap-2">
              <Link to={ROUTES.quotesHistory}>
                <Calculator className="size-4" aria-hidden="true" />
                Choisir un devis à facturer
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {invoices.map((invoice) => {
            const status = STATUS_CONFIG[invoice.status];
            const totalTTC = invoice.totals ? toEuros(invoice.totals.total_cents) : null;
            const estAvoir = invoice.document_type === 'credit_note';

            return (
              <li key={invoice.id}>
                <Link
                  to={ROUTES.invoiceDetail(invoice.id)}
                  className="border-border bg-surface hover:border-primary/50 hover:bg-surface-hover group flex items-center gap-3 rounded-xl border p-4 transition-colors"
                >
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                      estAvoir ? 'bg-warning/10 text-warning' : 'bg-primary-subtle text-primary'
                    }`}
                  >
                    {estAvoir ? (
                      <ReceiptText className="size-4.5" aria-hidden="true" />
                    ) : (
                      <FileText className="size-4.5" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground font-mono text-sm font-bold">
                        {invoice.status === 'draft'
                          ? invoice.title || 'Facture à préparer'
                          : invoice.reference}
                      </span>
                      <Badge variant={status.variant}>
                        {estAvoir && invoice.status === 'paid'
                          ? 'Remboursé / imputé'
                          : status.label}
                      </Badge>
                      {estAvoir && <Badge variant="warning">Avoir</Badge>}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {invoice.customer_name || invoice.title || 'Client non renseigné'}
                      {invoice.site_name ? ` — ${invoice.site_name}` : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-foreground text-sm font-bold tabular-nums">
                      {totalTTC !== null ? `${totalTTC.toFixed(2)} €` : '—'}
                    </p>
                    <p className="text-subtle-foreground text-3xs">
                      {estAvoir && <span>À créditer · </span>}
                      {/* Un brouillon n'a pas de date d'émission : on montre alors
                          celle de création, seule date qui existe. */}
                      {formatInvoiceDate(invoice.issued_at ?? invoice.created_at)}
                    </p>
                  </div>

                  <ChevronRight
                    className="text-subtle-foreground group-hover:text-primary size-4 shrink-0 transition-colors"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
