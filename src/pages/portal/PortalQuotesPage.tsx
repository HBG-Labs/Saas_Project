import { ChevronRight, FileText } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  formatDateFr,
  formatEuros,
  PortalPageHeader,
  StatusBadge,
  usePortalQuotes,
} from '@/features/portal';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function PortalQuotesPage() {
  useDocumentTitle('Mes devis — Espace client');
  const quotes = usePortalQuotes();
  const list = quotes.data ?? [];
  const pendingCount = list.filter((quote) => quote.status === 'sent').length;

  return (
    <div>
      <PortalPageHeader
        title="Mes devis"
        description="Consultez le détail de vos propositions et répondez aux devis encore en attente."
        icon={FileText}
        tone="info"
        summary={
          quotes.isSuccess ? (
            <Badge variant={pendingCount > 0 ? 'warning' : 'neutral'} size="button">
              {pendingCount > 0
                ? `${pendingCount} réponse${pendingCount > 1 ? 's' : ''} attendue${pendingCount > 1 ? 's' : ''}`
                : `${list.length} devis`}
            </Badge>
          ) : null
        }
      />

      {quotes.isPending ? (
        <ListSkeleton />
      ) : quotes.isError ? (
        <ErrorState
          error={quotes.error}
          onRetry={() => {
            void quotes.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun devis"
          description="Les devis qui vous seront envoyés apparaîtront ici."
        />
      ) : (
        <ul className="space-y-3">
          {list.map((q) => (
            <li key={q.id}>
              <Link
                to={ROUTES.portalQuote(q.id)}
                className="border-border bg-surface hover:border-primary/40 group block rounded-2xl border p-4 shadow-xs transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0"
              >
                <div className="flex items-start gap-3">
                  <span className="bg-info-subtle text-info inline-flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <FileText className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-foreground line-clamp-2 text-sm font-semibold">
                        {q.title ?? 'Devis'}
                      </p>
                      <StatusBadge status={q.status} kind="quote" />
                    </div>
                    <p className="text-muted-foreground mt-1 font-mono text-xs">{q.reference}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Émis le {formatDateFr(q.created_at)}
                      {q.valid_until ? ` · valable jusqu’au ${formatDateFr(q.valid_until)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="border-border mt-3 flex items-end justify-between gap-3 border-t pt-3">
                  <div>
                    <p className="text-foreground text-lg font-bold tabular-nums">
                      {formatEuros(q.total_cents)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      TTC · {formatEuros(q.subtotal_cents)} HT
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {q.status === 'sent' ? (
                      <span className="text-primary text-xs font-semibold">
                        Consulter et répondre
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs font-medium">Consulter</span>
                    )}
                    <ChevronRight
                      className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
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
