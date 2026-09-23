import { ChevronRight, Plus } from 'lucide-react';
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
import { useCurrentOrganization } from '@/features/organizations';
import { toEuros, useQuotesWithTotals } from '@/features/quotes';
import { formatDate } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { QuoteStatus } from '@/types/database';

/**
 * Ce que devient un devis une fois « Valider & Enregistrer » cliqué sur
 * `QuotesPage` : jusqu'ici, nulle part. `useQuote` (le détail d'un devis) et
 * `useQuotes` (sa liste) existaient déjà dans la couche de données, mais
 * aucune page ne les consommait pour AFFICHER un devis après coup — seul
 * `AnalyticsPage` lisait la liste, pour un total, jamais pour la parcourir.
 * Retrouver « DEV-0003 » plus tard n'était donc possible qu'en retéléchargeant
 * le PDF au moment même de l'enregistrement.
 */
const STATUS_CONFIG: Record<
  QuoteStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  draft: { label: 'Brouillon', variant: 'neutral' },
  sent: { label: 'Envoyé', variant: 'info' },
  accepted: { label: 'Accepté', variant: 'success' },
  refused: { label: 'Refusé', variant: 'error' },
  expired: { label: 'Expiré', variant: 'warning' },
};

export default function QuoteHistoryPage() {
  useDocumentTitle('Historique des devis');

  const { organization } = useCurrentOrganization();
  const quotesQuery = useQuotesWithTotals(organization?.id ?? null);
  const quotes = quotesQuery.data ?? [];

  return (
    <PageShell width="4xl">
      <PageHeader
        title="Historique des devis"
        description="Tous les devis enregistrés par votre organisation, avec leur statut et leur montant."
        actions={
          <Button asChild variant="primary" className="gap-2">
            <Link to={ROUTES.quotes}>
              <Plus className="size-4" aria-hidden="true" />
              Nouveau devis
            </Link>
          </Button>
        }
      />
      <SalesNavTabs />

      {quotesQuery.isError ? (
        <ErrorState error={quotesQuery.error} onRetry={() => void quotesQuery.refetch()} />
      ) : quotesQuery.isPending ? (
        <div className="space-y-2.5" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <DataView
          items={quotes}
          getKey={(quote) => quote.id}
          label="Historique des devis"
          breakpoint="md"
          columnCount={5}
          head={
            <>
              <TableHeaderCell>Référence</TableHeaderCell>
              <TableHeaderCell>Client</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell className="text-right">Montant TTC</TableHeaderCell>
            </>
          }
          empty={{
            illustration: <AtelierIllustration subject="quotes" />,
            title: 'Aucun devis enregistré',
            description:
              'Préparez votre premier devis : il restera consultable ici avec son statut et son montant.',
            action: (
              <Button asChild variant="primary">
                <Link to={ROUTES.quotes}>Créer un premier devis</Link>
              </Button>
            ),
          }}
          renderRow={(quote) => {
            const status = STATUS_CONFIG[quote.status];
            const totalTTC = quote.totals ? toEuros(quote.totals.total_cents) : null;

            return (
              <>
                <TableCell>
                  <Link
                    to={ROUTES.quoteDetail(quote.id)}
                    className="text-foreground hover:text-primary font-bold tabular-nums"
                  >
                    {quote.reference}
                  </Link>
                </TableCell>
                <TableCell>
                  <p className="text-foreground font-semibold">
                    {quote.customer_name || quote.title || 'Client non renseigné'}
                  </p>
                  {quote.site_name ? (
                    <p className="text-subtle-foreground mt-0.5">{quote.site_name}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(quote.created_at)}
                </TableCell>
                <TableAmountCell className="font-bold">
                  {totalTTC !== null ? `${totalTTC.toFixed(2)} €` : '—'}
                </TableAmountCell>
              </>
            );
          }}
          renderCard={(quote) => {
            const status = STATUS_CONFIG[quote.status];
            const totalTTC = quote.totals ? toEuros(quote.totals.total_cents) : null;

            return (
              <Link to={ROUTES.quoteDetail(quote.id)} className="group block min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground font-bold tabular-nums">
                        {quote.reference}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 truncate text-sm">
                      {quote.customer_name || quote.title || 'Client non renseigné'}
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
                    {formatDate(quote.created_at)}
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
