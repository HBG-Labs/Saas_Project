import { Search, Wrench, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CATEGORY_METADATA } from '@/features/tools/catalog-metadata';
import { CategoryCard } from '@/features/tools/components/CategoryCard';
import { ToolCard } from '@/features/tools/components/ToolCard';
import { listTools, type ToolCategorySlug } from '@/features/tools';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

type Filter = ToolCategorySlug | 'all';

export default function ToolsPage() {
  useDocumentTitle('Catalogue des outils');
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  // Catégorie lue depuis les paramètres d'URL (ex: ?category=fiber-optics)
  const categoryParam = searchParams.get('category') as ToolCategorySlug | null;
  const filter: Filter = categoryParam && CATEGORY_METADATA.some((c) => c.slug === categoryParam)
    ? categoryParam
    : 'all';

  const handleFilterChange = (newFilter: Filter) => {
    if (newFilter === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', newFilter);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const allTools = listTools();

  const tools = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return allTools.filter((tool) => {
      const matchesCategory = filter === 'all' || tool.category === filter;
      if (!matchesCategory) return false;
      if (normalized === '') return true;

      return (
        tool.title.toLowerCase().includes(normalized) ||
        tool.description.toLowerCase().includes(normalized) ||
        tool.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
      );
    });
  }, [allTools, query, filter]);

  const hasTools = allTools.length > 0;
  const isFiltering = query.trim() !== '' || filter !== 'all';

  return (
    <>
      <PageHeader
        title="Catalogue des outils d’ingénierie"
        description="Calculatrices, convertisseurs et bilans certifiés pour la fibre optique, les réseaux et l’électricité."
      />

      {hasTools ? (
        <>
          <div className="mb-8 space-y-4">
            <Input
              label="Rechercher un outil"
              hideLabel
              placeholder="Rechercher un outil par nom, mot-clé ou norme (ex: atténuation, CIDR)..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              leadingIcon={<Search />}
              className="max-w-xl"
              {...(query
                ? {
                    trailingSlot: (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('');
                        }}
                        aria-label="Effacer la recherche"
                        className="text-subtle-foreground hover:text-foreground flex size-7 items-center justify-center rounded"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    ),
                  }
                : {})}
            />

            {/* Boutons de catégories synchronisés avec l'URL */}
            <div role="group" aria-label="Filtrer par domaine" className="flex flex-wrap gap-2">
              {(['all', ...CATEGORY_METADATA.map((c) => c.slug)] as Filter[]).map((value) => {
                const label =
                  value === 'all'
                    ? 'Toutes les catégories'
                    : (CATEGORY_METADATA.find((c) => c.slug === value)?.name ?? value);
                const isActive = filter === value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      handleFilterChange(value);
                    }}
                    aria-pressed={isActive}
                    className={cn(
                      'h-9 rounded-lg border px-3.5 text-xs font-medium transition-all',
                      'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                      isActive
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-sm'
                        : 'border-border/70 bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {tools.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="Aucun outil trouvé"
              description="Aucune calculatrice ne correspond à vos critères de recherche actuels."
              action={
                isFiltering ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery('');
                      handleFilterChange('all');
                    }}
                  >
                    Réinitialiser tous les filtres
                  </Button>
                ) : undefined
              }
            />
          )}
        </>
      ) : (
        <>
          <EmptyState
            icon={Wrench}
            title="Le catalogue se construit"
            description="Aucun outil n’est encore publié. Les catégories ci-dessous sont prêtes à les accueillir, et chaque outil sera disponible dès sa mise en service."
            className="mb-8"
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORY_METADATA.map((category) => (
              <CategoryCard key={category.slug} category={category} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
