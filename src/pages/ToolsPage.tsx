import { Search, Wrench, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CATEGORY_METADATA } from '@/features/tools/catalog-metadata';
import { CategoryCard } from '@/features/tools/components/CategoryCard';
import { ToolCard } from '@/features/tools/components/ToolCard';
import { listTools, type ToolCategorySlug } from '@/features/tools';
import { cn } from '@/lib/cn';

type Filter = ToolCategorySlug | 'all';

/**
 * Catalogue des outils.
 *
 * La recherche et le filtrage s'appliquent au registry, pas à une liste écrite
 * en dur : dès qu'un dossier sera ajouté dans `src/tools/`, l'outil apparaîtra
 * ici sans modification de cette page.
 */
export default function ToolsPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const allTools = listTools();

  const tools = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return allTools.filter((tool) => {
      const matchesCategory = filter === 'all' || tool.category === filter;
      if (!matchesCategory) return false;
      if (normalized === '') return true;

      // La recherche couvre aussi les mots-clés : un technicien cherchera
      // « atténuation » sans connaître le titre exact de l'outil.
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
        title="Outils"
        description="Calculatrices et convertisseurs pour la fibre, les réseaux et l’électricité."
      />

      {hasTools ? (
        <>
          <div className="mb-6 space-y-3">
            <Input
              label="Rechercher un outil"
              hideLabel
              placeholder="Rechercher un outil…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              leadingIcon={<Search />}
              className="max-w-md"
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

            {/* Filtres en boutons plutôt qu'en liste déroulante : les 5 options
                tiennent à l'écran et restent atteignables en un seul geste. */}
            <div role="group" aria-label="Filtrer par catégorie" className="flex flex-wrap gap-1.5">
              {(['all', ...CATEGORY_METADATA.map((c) => c.slug)] as Filter[]).map((value) => {
                const label =
                  value === 'all'
                    ? 'Toutes'
                    : (CATEGORY_METADATA.find((c) => c.slug === value)?.name ?? value);
                const isActive = filter === value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setFilter(value);
                    }}
                    aria-pressed={isActive}
                    className={cn(
                      'h-8 rounded-md border px-3 text-xs font-medium transition-colors',
                      'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                      isActive
                        ? 'border-primary bg-primary-subtle text-primary'
                        : 'border-border text-muted-foreground hover:bg-surface-hover',
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
              title="Aucun résultat"
              description="Aucun outil ne correspond à votre recherche. Essayez un autre terme ou changez de catégorie."
              action={
                isFiltering ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                    }}
                  >
                    Réinitialiser les filtres
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
            description="Aucun outil n’est encore publié. Les quatre catégories ci-dessous sont prêtes à les accueillir, et chaque outil sera disponible dès sa mise en service."
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
