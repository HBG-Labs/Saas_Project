import { Calculator, ChevronRight, FileText, ReceiptText } from 'lucide-react';
import { Link } from 'react-router';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { ErrorState } from '@/components/feedback/ErrorState';
import { SalesNavTabs } from '@/components/finance/SalesNavTabs';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataView } from '@/components/ui/DataView';
import { Skeleton } from '@/components/ui/Skeleton';
import { TableAmountCell, TableCell, TableHeaderCell } from '@/components/ui/Table';
import { ROUTES } from '@/config/routes';
import { toEuros, useInvoices } from '@/features/invoices';
import { useCurrentOrganization } from '@/features/organizations';
import { formatInvoiceDate, InvoicesSectionTabs } from '@/features/einvoicing';
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
    <PageShell width="4xl">
      <PageHeader
        title="Factures"
        description="Vos factures et avoirs, avec leur statut et leur montant."
        actions={
          <Button asChild variant="primary" className="gap-2">
            <Link to={ROUTES.quotesHistory}>
              <Calculator className="size-4" aria-hidden="true" />
              Facturer un devis
            </Link>
          </Button>
        }
      />
      <SalesNavTabs />
      <InvoicesSectionTabs />

      {invoicesQuery.isError ? (
        <ErrorState error={invoicesQuery.error} onRetry={() => void invoicesQuery.refetch()} />
      ) : invoicesQuery.isPending ? (
        <div className="space-y-2.5" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <DataView
          items={invoices}
          getKey={(invoice) => invoice.id}
          label="Liste des factures et avoirs"
          breakpoint="md"
          columnCount={5}
          head={
            <>
              <TableHeaderCell>Document</TableHeaderCell>
              <TableHeaderCell>Client</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell className="text-right">Montant TTC</TableHeaderCell>
            </>
          }
          empty={{
            illustration: <AtelierIllustration subject="invoices" />,
            title: 'Aucune facture',
            description:
              'Une facture se prépare à partir d’un devis accepté, avec ses lignes, son client et ses montants.',
            action: (
              <Button asChild variant="primary" className="gap-2">
                <Link to={ROUTES.quotesHistory}>
                  <Calculator className="size-4" aria-hidden="true" />
                  Choisir un devis
                </Link>
              </Button>
            ),
          }}
          renderRow={(invoice) => {
            const status = STATUS_CONFIG[invoice.status];
            const totalTTC = invoice.totals ? toEuros(invoice.totals.total_cents) : null;
            const estAvoir = invoice.document_type === 'credit_note';

            return (
              <>
                <TableCell>
                  <Link
                    to={ROUTES.invoiceDetail(invoice.id)}
                    className="text-foreground hover:text-primary inline-flex items-center gap-2 font-bold tabular-nums"
                  >
                    {estAvoir ? (
                      <ReceiptText className="text-warning size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <FileText className="text-primary size-4 shrink-0" aria-hidden="true" />
                    )}
                    {invoice.status === 'draft'
                      ? invoice.title || 'Facture à préparer'
                      : invoice.reference}
                  </Link>
                </TableCell>
                <TableCell>
                  <p className="text-foreground font-semibold">
                    {invoice.customer_name || invoice.title || 'Client non renseigné'}
                  </p>
                  {invoice.site_name ? (
                    <p className="text-subtle-foreground mt-0.5">{invoice.site_name}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={status.variant}>
                      {estAvoir && invoice.status === 'paid' ? 'Remboursé / imputé' : status.label}
                    </Badge>
                    {estAvoir ? <Badge variant="warning">Avoir</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatInvoiceDate(invoice.issued_at ?? invoice.created_at)}
                </TableCell>
                <TableAmountCell className="font-bold">
                  {totalTTC !== null ? `${totalTTC.toFixed(2)} €` : '—'}
                </TableAmountCell>
              </>
            );
          }}
          renderCard={(invoice) => {
            const status = STATUS_CONFIG[invoice.status];
            const totalTTC = invoice.totals ? toEuros(invoice.totals.total_cents) : null;
            const estAvoir = invoice.document_type === 'credit_note';

            return (
              <Link to={ROUTES.invoiceDetail(invoice.id)} className="group block min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground font-bold tabular-nums">
                        {invoice.status === 'draft'
                          ? invoice.title || 'Facture à préparer'
                          : invoice.reference}
                      </span>
                      <Badge variant={status.variant}>
                        {estAvoir && invoice.status === 'paid'
                          ? 'Remboursé / imputé'
                          : status.label}
                      </Badge>
                      {estAvoir ? <Badge variant="warning">Avoir</Badge> : null}
                    </div>
                    <p className="text-muted-foreground mt-1 truncate text-sm">
                      {invoice.customer_name || invoice.title || 'Client non renseigné'}
                    </p>
                  </div>
                  <ChevronRight
                    className="text-subtle-foreground group-hover:text-primary mt-1 size-4 shrink-0"
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <span className="text-foreground text-base font-bold tabular-nums">
                    {totalTTC !== null ? `${totalTTC.toFixed(2)} €` : '—'}
                  </span>
                  <span className="text-subtle-foreground text-xs tabular-nums">
                    {estAvoir ? 'À créditer · ' : ''}
                    {formatInvoiceDate(invoice.issued_at ?? invoice.created_at)}
                  </span>
                </div>
              </Link>
            );
          }}
        />
      )}
    </PageShell>
  );
}
