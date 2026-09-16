import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import {
  ProspectFiltersBar,
  ProspectsTable,
  useProspects,
  type ProspectFilters as Filters,
} from '@/features/prospecting';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { ProspectStatus } from '@/types/database';

const PROSPECTS_PER_PAGE = 25;

export default function ProspectingListPage() {
  useDocumentTitle('Prospection — Liste');

  // Les cartes du tableau de bord (§14) lient vers cette page avec un filtre
  // déjà posé dans l'URL — lu une seule fois, à l'ouverture, jamais resynchronisé
  // ensuite : modifier les filtres à l'écran ne doit pas se battre avec l'URL.
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => {
    const status = searchParams.get('status');
    const minScore = searchParams.get('minScore');
    return {
      ...(status ? { status: status as ProspectStatus } : {}),
      ...(minScore ? { minScore: Number(minScore) } : {}),
      page: 0,
    };
  });

  const { data, isPending, error, refetch } = useProspects(filters);
  const total = data?.total ?? 0;
  const page = filters.page ?? 0;
  const hasNextPage = useMemo(() => (page + 1) * PROSPECTS_PER_PAGE < total, [page, total]);

  return (
    <div>
      <PageHeader
        title="Prospection"
        description={`${total} prospect${total !== 1 ? 's' : ''} correspondant${total !== 1 ? 's' : ''} aux filtres.`}
      />

      <div className="mb-4">
        <ProspectFiltersBar value={filters} onChange={setFilters} />
      </div>

      {isPending ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <ProspectsTable rows={data.rows} />

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
