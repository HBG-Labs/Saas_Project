import { LayoutGrid, LayoutList, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ToolCardSkeleton } from '@/components/ui/Skeleton';
import { isCategorySlug } from '@/config/categories';
import { ROUTES } from '@/config/routes';
import { useCatalogTools } from '@/features/catalog';
import { getTool } from '@/features/tools';
import { getUniversalTool } from '@/features/tools/calculators/universal';
import { ToolCard } from '@/features/tools/components/ToolCard';
import { useToolFavorites } from '@/features/tools/hooks/useToolFavorites';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { ToolWithCategory } from '@/types/domain';

function resolveFavoriteTool(slug: string, dbTools: ToolWithCategory[] = []) {
  const codeTool = getTool(slug);
  if (codeTool) {
    return {
      slug: codeTool.slug,
      title: codeTool.title,
      description: codeTool.description,
      category: isCategorySlug(codeTool.category) ? codeTool.category : ('general' as const),
      icon: codeTool.icon ?? 'wrench',
    };
  }

  const universalTool = getUniversalTool(slug);
  if (universalTool) {
    return {
      slug: universalTool.slug,
      title: universalTool.title,
      description: universalTool.description,
      category: isCategorySlug(universalTool.category) ? universalTool.category : ('general' as const),
      icon: universalTool.icon ?? 'wrench',
    };
  }

  const dbTool = dbTools.find((t) => t.slug === slug);
  if (dbTool) {
    const categorySlug = dbTool.category?.slug ?? 'general';
    return {
      slug: dbTool.slug,
      title: dbTool.name,
      description: dbTool.short_description ?? dbTool.description ?? '',
      category: isCategorySlug(categorySlug) ? categorySlug : ('general' as const),
      icon: dbTool.icon ?? 'wrench',
    };
  }

  return null;
}

/**
 * Favoris de l'utilisateur, servis par le hook unifié useToolFavorites.
 */
export default function FavoritesPage() {
  useDocumentTitle('Favoris — REZO360');

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'list';
    return (localStorage.getItem('rezo360:tools_view_mode') as 'grid' | 'list') || 'list';
  });

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('rezo360:tools_view_mode', mode);
    } catch {}
  };

  const { favorites, toggleFavorite, isLoading, error } = useToolFavorites();
  const catalogQuery = useCatalogTools();

  const favoriteCards = useMemo(() => {
    return favorites
      .map((slug) => resolveFavoriteTool(slug, catalogQuery.data ?? []))
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }, [favorites, catalogQuery.data]);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <PageHeader
          title="Favoris"
          description="Les outils que vous avez épinglés, accessibles en un clic."
          className="mb-0"
        />

        {favoriteCards.length > 0 && (
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 shadow-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleViewModeChange('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="Affichage en liste"
            >
              <LayoutList className="size-4" />
              <span className="hidden sm:inline">Liste</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('grid')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title="Affichage en grille"
            >
              <LayoutGrid className="size-4" />
              <span className="hidden sm:inline">Grille</span>
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ToolCardSkeleton />
          <ToolCardSkeleton />
          <ToolCardSkeleton />
        </div>
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void catalogQuery.refetch();
          }}
        />
      ) : favoriteCards.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Aucun favori pour l’instant"
          description="Parcourez le catalogue et cliquez sur l’étoile d’un outil pour le retrouver ici, sur tous vos appareils."
          action={
            <Button asChild size="sm">
              <Link to={ROUTES.tools}>Parcourir les outils</Link>
            </Button>
          }
        />
      ) : (
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
              : 'space-y-2 w-full',
          )}
        >
          {favoriteCards.map((tool) => (
            <ToolCard
              key={tool.slug}
              tool={tool}
              variant={viewMode}
              isFavorite
              onToggleFavorite={() => toggleFavorite(tool.slug)}
            />
          ))}
        </div>
      )}
    </>
  );
}

