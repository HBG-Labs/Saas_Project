import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import {
  InvoicesSectionTabs,
  listReceivedInvoices,
  ReceivedInvoiceFiltersBar,
  ReceivedInvoicesTable,
  type ReceivedInvoiceFilters as Filters,
  type ReceivedInvoiceSort,
} from '@/features/einvoicing';
import { useCurrentOrganization } from '@/features/organizations';
import { qk } from '@/lib/query-keys';
import { useDocumentTitle } from '@/lib/use-document-title';

const RECEIVED_INVOICES_PER_PAGE = 25;

export default function ReceivedInvoicesPage() {
  useDocumentTitle('Factures reçues');

  const { organization } = useCurrentOrganization();
  const [filters, setFilters] = useState<Filters>({ page: 0 });

  const query = useQuery({
    queryKey: qk.einvoicing.receivedInvoices(organization?.id ?? 'none', filters),
    queryFn: () => listReceivedInvoices(organization?.id ?? '', filters),
    enabled: Boolean(organization?.id),
  });
  const total = query.data?.total ?? 0;
  const page = filters.page ?? 0;
  const hasNextPage = useMemo(
    () => (page + 1) * RECEIVED_INVOICES_PER_PAGE < total,
    [page, total],
  );

  const sort: ReceivedInvoiceSort | undefined = filters.sortBy
    ? { column: filters.sortBy, direction: filters.sortDirection ?? 'desc' }
    : undefined;

  // Changer de tri revient à la première page : la page courante d'un tri
  // n'a aucune raison de rester pertinente dans un autre ordre.
  const handleSortChange = (next: ReceivedInvoiceSort) =>
    setFilters({ ...filters, sortBy: next.column, sortDirection: next.direction, page: 0 });

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <PageHeader
        title="Factures reçues"
        description="Les factures électroniques de vos fournisseurs, relevées auprès de SUPER PDP."
      />
      <InvoicesSectionTabs />

      <ReceivedInvoiceFiltersBar value={filters} onChange={setFilters} />

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <ListSkeleton rows={6} />
      ) : (
        <>
          <ReceivedInvoicesTable
            rows={query.data.rows}
            sort={sort}
            onSortChange={handleSortChange}
          />

          {(page > 0 || hasNextPage) && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setFilters({ ...filters, page: page - 1 })}
              >
                Précédent
              </Button>
              <span className="text-muted-foreground text-xs">Page {page + 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage}
                onClick={() => setFilters({ ...filters, page: page + 1 })}
              >
                Suivant
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
