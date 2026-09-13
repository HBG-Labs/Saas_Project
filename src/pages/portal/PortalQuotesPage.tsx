import { ChevronRight, FileText } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { formatDateFr, formatEuros, PortalPageHeader, StatusBadge, usePortalQuotes } from '@/features/portal';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function PortalQuotesPage() {
  useDocumentTitle('Mes devis — Espace client');
  const quotes = usePortalQuotes();

  return (
    <div>
      <PortalPageHeader title="Mes devis" description="Les devis qui vous ont été adressés." />

      {quotes.isPending ? (
        <ListSkeleton />
      ) : quotes.isError ? (
        <ErrorState
          error={quotes.error}
          onRetry={() => {
            void quotes.refetch();
          }}
        />
      ) : (quotes.data ?? []).length === 0 ? (
        <EmptyState icon={FileText} title="Aucun devis" description="Les devis qui vous seront envoyés apparaîtront ici." />
      ) : (
        <ul className="space-y-2">
          {(quotes.data ?? []).map((q) => (
            <li key={q.id}>
              <Link
                to={ROUTES.portalQuote(q.id)}
                className="border-border bg-surface hover:border-primary/40 block rounded-2xl border p-3 shadow-xs transition-all hover:shadow-md sm:p-4"
              >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="bg-info-subtle text-info hidden size-10 shrink-0 items-center justify-center rounded-xl sm:inline-flex">
                  <FileText className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-foreground text-sm font-semibold">{q.title ?? 'Devis'}</p>
                    <Badge variant="outline" className="font-mono">
                      {q.reference}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Émis le {formatDateFr(q.created_at)}
                    {q.valid_until ? ` · valable jusqu’au ${formatDateFr(q.valid_until)}` : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={q.status} kind="quote" />
                    {q.status === 'sent' ? (
                      <span className="text-primary text-xs font-semibold">Consulter et répondre</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-foreground text-lg font-bold">{formatEuros(q.total_cents)}</p>
                    <p className="text-muted-foreground text-xs">TTC · {formatEuros(q.subtotal_cents)} HT</p>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                </div>
              </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
