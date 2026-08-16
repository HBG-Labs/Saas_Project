import { Briefcase, LayoutGrid, LayoutList, Search, Wrench, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CATEGORY_METADATA } from '@/features/tools/catalog-metadata';
import { CategoryCard } from '@/features/tools/components/CategoryCard';
import { ToolCard } from '@/features/tools/components/ToolCard';
import { useCurrentIndustry } from '@/features/industries';
import {
  countOutsideIndustry,
  listTools,
  servesIndustry,
  sortByIndustryRelevance,
  type ToolCategorySlug,
} from '@/features/tools';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

type Filter = ToolCategorySlug | 'all';
type ViewMode = 'list' | 'grid';

const LEGACY_SLUG_MAP: Record<string, ToolCategorySlug> = {
  reseaux: 'networking',
  electricite: 'electrical',
  telecoms: 'telecom',
  fibre: 'fiber-optics',
};

export default function ToolsPage() {
  useDocumentTitle('Catalogue des outils');
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Catégorie lue depuis les paramètres d'URL (ex: ?category=fiber-optics ou ?cat=fibre)
  const rawParam = searchParams.get('category') ?? searchParams.get('cat');
  const resolvedSlug = rawParam ? (LEGACY_SLUG_MAP[rawParam] ?? rawParam) : null;
  const filter: Filter =
    resolvedSlug && CATEGORY_METADATA.some((c) => c.slug === resolvedSlug)
      ? (resolvedSlug as ToolCategorySlug)
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

  /*
    Le metier ORDONNE le catalogue, il ne le tronque pas par defaut.

    `/tools` est public : un visiteur sans compte n'a pas de metier, et lui
    servir un catalogue ampute n'aurait aucun sens. Une entreprise, elle, voit
    d'abord ce qui la concerne — mais garde tout le reste a portee d'un clic,
    parce que les corps de metier se recouvrent : l'entreprise qui utilise ce
    produit fait de la fibre ET de l'electricite.
  */
  const { code: industry, label: industryLabel, isResolved } = useCurrentIndustry();
  const [industryOnly, setIndustryOnly] = useState(false);

  const outsideCount = useMemo(
    () => (isResolved ? countOutsideIndustry(allTools, industry) : 0),
    [allTools, industry, isResolved],
  );

  const tools = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const filtered = allTools.filter((tool) => {
      const matchesCategory = filter === 'all' || tool.category === filter;
      if (!matchesCategory) return false;
      if (industryOnly && !servesIndustry(tool, industry)) return false;
      if (normalized === '') return true;

      return (
        tool.title.toLowerCase().includes(normalized) ||
        tool.description.toLowerCase().includes(normalized) ||
        tool.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
      );
    });

    // Tri prioritaire : Calculatrice Scientifique TOUJOURS en position #1
    const ordered = [...filtered].sort((a, b) => {
      if (a.slug === 'scientific-calculator') return -1;
      if (b.slug === 'scientific-calculator') return 1;
      return (a.order ?? 99) - (b.order ?? 99);
    });

    // Puis remontee des outils du metier, en tri STABLE : le classement
    // ci-dessus survit intact a l'interieur de chaque groupe.
    return isResolved ? sortByIndustryRelevance(ordered, industry) : ordered;
  }, [allTools, query, filter, industry, industryOnly, isResolved]);

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
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

              {/* Sélecteur de vue (Liste / Grille) */}
              <div className="flex items-center gap-1 bg-surface border border-border/80 rounded-lg p-1 shrink-0 self-start sm:self-auto shadow-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                    viewMode === 'list'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <LayoutList className="size-4" />
                  <span>Liste</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                    viewMode === 'grid'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <LayoutGrid className="size-4" />
                  <span>Grille</span>
                </button>
              </div>
            </div>

            {/*
              Restriction au metier : proposee, jamais imposee.

              Le bouton n'apparait que si l'organisation exerce un metier ET
              qu'il y a effectivement quelque chose a ecarter. Il annonce le
              nombre d'outils concernes : « masquer 3 outils » se decide, « voir
              moins » se subit.
            */}
            {isResolved && outsideCount > 0 ? (
              <button
                type="button"
                onClick={() => setIndustryOnly((only) => !only)}
                aria-pressed={industryOnly}
                className={cn(
                  'flex min-h-touch items-center gap-2 rounded-lg border px-3.5 text-xs font-medium transition-all cursor-pointer sm:min-h-9',
                  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                  industryOnly
                    ? 'border-primary bg-primary/10 text-primary font-semibold shadow-sm'
                    : 'border-border/70 bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                )}
              >
                <Briefcase className="size-4 shrink-0" aria-hidden="true" />
                {industryOnly
                  ? `Métier « ${industryLabel} » — afficher les ${outsideCount} autres outils`
                  : `Limiter au métier « ${industryLabel} » (${outsideCount} outils masqués)`}
              </button>
            ) : null}

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
                      'h-9 rounded-lg border px-3.5 text-xs font-medium transition-all cursor-pointer',
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
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                  : 'space-y-3 max-w-4xl',
              )}
            >
              {tools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} variant={viewMode} />
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
