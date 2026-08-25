import { ArrowLeft, LayoutGrid, LayoutList, Wrench, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';
import { MetierSearchBar } from '@/features/metiers-tools/components/MetierSearchBar';
import { MetierToolCard } from '@/features/metiers-tools/components/MetierToolCard';
import { useMetierFavorites } from '@/features/metiers-tools/hooks/useMetierFavorites';
import { getTrade, listToolsForTrade } from '@/features/metiers-tools/registry';
import type { TradeSlug } from '@/features/metiers-tools/types';
import { FALLBACK_NAV_ICON, NAV_ICONS } from '@/components/layout/nav-icons';

export default function MetierTradePage() {
  const { tradeSlug } = useParams<{ tradeSlug: string }>();
  const trade = tradeSlug ? getTrade(tradeSlug) : undefined;

  useDocumentTitle(
    trade ? `${trade.name} — Outils Métiers REZO360` : 'Spécialité introuvable — REZO360',
  );

  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'list';
    return (localStorage.getItem('rezo360:metiers_view_mode') as 'grid' | 'list') || 'list';
  });

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('rezo360:metiers_view_mode', mode);
    } catch {}
  };

  const { isFavorite, toggleFavorite } = useMetierFavorites();

  const allTradeTools = useMemo(() => {
    if (!trade) return [];
    return listToolsForTrade(trade.slug as TradeSlug);
  }, [trade]);

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTradeTools;

    return allTradeTools.filter((t) => {
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.shortDescription && t.shortDescription.toLowerCase().includes(q)) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [allTradeTools, query]);

  if (!trade) {
    return (
      <>
        <PageHeader
          title="Spécialité introuvable"
          description={`Aucune catégorie métier ne correspond à « ${tradeSlug ?? ''} ».`}
        />
        <EmptyState
          icon={Wrench}
          title="Cette spécialité n’existe pas"
          description="Le catalogue des outils métiers reste accessible depuis l’accueil."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/metiers">Voir tous les métiers</Link>
            </Button>
          }
        />
      </>
    );
  }

  const Icon: LucideIcon = NAV_ICONS[trade.icon] ?? FALLBACK_NAV_ICON;

  return (
    <>
      <Link
        to="/metiers"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        <span>Tous les outils métiers</span>
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-2xs',
              trade.badgeColor,
            )}
            aria-hidden="true"
          >
            <Icon className="size-6" />
          </span>
          <div>
            <PageHeader
              title={trade.name}
              description={trade.description}
              className="mb-0"
            />
            <p className="text-xs font-semibold text-primary mt-1">
              {allTradeTools.length} outil{allTradeTools.length > 1 ? 's' : ''} spécialisé{allTradeTools.length > 1 ? 's' : ''} disponibles
            </p>
          </div>
        </div>

        {/* Sélecteur de vue (Liste / Grille) */}
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
      </div>

      <div className="mb-6">
        <MetierSearchBar
          query={query}
          onQueryChange={setQuery}
          {...(query ? { resultsCount: filteredTools.length } : {})}
          placeholder={`Rechercher dans les outils ${trade.shortName}...`}
        />
      </div>

      {filteredTools.length > 0 ? (
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'space-y-2 w-full',
          )}
        >
          {filteredTools.map((tool) => (
            <MetierToolCard
              key={tool.slug}
              tool={tool}
              variant={viewMode}
              isFavorite={isFavorite(tool.slug)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Wrench}
          title="Aucun outil trouvé"
          description={`Aucun outil de la spécialité « ${trade.name} » ne correspond à « ${query} ».`}
          action={
            <Button variant="outline" size="sm" onClick={() => setQuery('')}>
              Effacer la recherche
            </Button>
          }
        />
      )}
    </>
  );
}
