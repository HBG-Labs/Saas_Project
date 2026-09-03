import { Calculator, ChevronRight, FileText, Plus } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
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
const STATUS_CONFIG: Record<QuoteStatus, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
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
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
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

      {quotesQuery.isError ? (
        <ErrorState error={quotesQuery.error} onRetry={() => void quotesQuery.refetch()} />
      ) : quotesQuery.isPending ? (
        <div className="space-y-2.5" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun devis enregistré"
          description="Les devis que vous enregistrez depuis l’outil de chiffrage apparaîtront ici, consultables et téléchargeables à tout moment."
          action={
            <Button asChild variant="primary" className="gap-2">
              <Link to={ROUTES.quotes}>
                <Calculator className="size-4" aria-hidden="true" />
                Créer mon premier devis
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {quotes.map((quote) => {
            const status = STATUS_CONFIG[quote.status];
            const totalTTC = quote.totals ? toEuros(quote.totals.total_cents) : null;

            return (
              <li key={quote.id}>
                <Link
                  to={ROUTES.quoteDetail(quote.id)}
                  className="border-border bg-surface hover:border-primary/50 hover:bg-surface-hover group flex items-center gap-3 rounded-xl border p-4 transition-colors"
                >
                  <div className="bg-primary-subtle text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <FileText className="size-4.5" aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground font-mono text-sm font-bold">
                        {quote.reference}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
                      {quote.customer_name || quote.title || 'Client non renseigné'}
                      {quote.site_name ? ` — ${quote.site_name}` : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-foreground text-sm font-bold">
                      {totalTTC !== null ? `${totalTTC.toFixed(2)} €` : '—'}
                    </p>
                    <p className="text-subtle-foreground text-3xs">{formatDate(quote.created_at)}</p>
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
