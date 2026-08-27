import { Clock, LayoutGrid, LayoutList, RotateCcw, Sparkles, Star, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';
import { MetierSearchBar } from '@/features/metiers-tools/components/MetierSearchBar';
import { MetierToolCard } from '@/features/metiers-tools/components/MetierToolCard';
import { MetierTradeCard } from '@/features/metiers-tools/components/MetierTradeCard';
import { MetierTradeFilterTabs } from '@/features/metiers-tools/components/MetierTradeFilterTabs';
import { useMetierFavorites } from '@/features/metiers-tools/hooks/useMetierFavorites';
import { useMetierHistory } from '@/features/metiers-tools/hooks/useMetierHistory';
import { ALL_METIER_TOOLS, TRADES } from '@/features/metiers-tools/registry';
import type { TradeSlug } from '@/features/metiers-tools/types';

export default function MetiersHomePage() {
  useDocumentTitle('Outils Métiers & Calculateurs Techniques — REZO360');

  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);

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

  const tradeParam = searchParams.get('trade') as TradeSlug | 'all' | 'favorites';
  const activeTab: TradeSlug | 'all' | 'favorites' = [
    'all',
    'btp',
    'plomberie',
    'electricite',
    'espaces-verts',
    'fibre-optique',
    'reseaux',
    'favorites',
  ].includes(tradeParam)
    ? tradeParam
    : 'all';

  const handleTabChange = (tab: TradeSlug | 'all' | 'favorites') => {
    if (tab === 'all') {
      searchParams.delete('trade');
    } else {
      searchParams.set('trade', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const { favorites, isFavorite, toggleFavorite } = useMetierFavorites();
  const { history, clearHistory, removeHistoryEntry } = useMetierHistory();

  // Filtrage des outils selon la recherche et l'onglet actif
  const filteredTools = useMemo(() => {
    let list = ALL_METIER_TOOLS;

    if (activeTab === 'favorites') {
      list = list.filter((t) => favorites.includes(t.slug));
    } else if (activeTab !== 'all') {
      list = list.filter((t) => t.tradeSlug === activeTab);
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;

    return list.filter((t) => {
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.shortDescription && t.shortDescription.toLowerCase().includes(q)) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.tradeSlug.toLowerCase().includes(q)
      );
    });
  }, [activeTab, query, favorites]);

  const isBrowsingAll = activeTab === 'all' && !query;

  return (
    <>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. EN-TÊTE PRINCIPAL                                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader
          title="🧰 Outils Métiers"
          description="Les outils techniques essentiels pour les professionnels du terrain."
          className="mb-0"
        />

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Bouton Historique des calculs */}
          <Button
            type="button"
            variant={showHistory ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setShowHistory((v) => !v)}
            className="gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
          >
            <Clock className="size-4" />
            <span>Historique</span>
            {history.length > 0 && (
              <span className="rounded-full bg-primary-foreground/20 px-1.5 py-0.2 text-3xs font-bold">
                {history.length}
              </span>
            )}
          </Button>

          {/* Sélecteur de vue (Liste / Grille) */}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 shadow-xs">
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
      </div>

      {/* Volet Historique déroulant */}
      {showHistory && (
        <Card className="border-border bg-surface p-4 mb-6 space-y-3 shadow-md animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Derniers calculs métiers enregistrés
              </h2>
            </div>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="text-3xs text-error hover:underline cursor-pointer font-semibold flex items-center gap-1"
              >
                <RotateCcw className="size-3" />
                <span>Vider l’historique</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucun calcul métier récent. Utilisez les calculateurs ci-dessous pour enregistrer automatiquement vos résultats.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col justify-between p-3 rounded-xl bg-surface-raised border border-border text-xs gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-primary text-2xs uppercase tracking-wider truncate">
                        {entry.toolTitle}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeHistoryEntry(entry.id)}
                        className="text-muted-foreground hover:text-error text-xs px-1 cursor-pointer"
                        title="Supprimer"
                      >
                        ×
                      </button>
                    </div>
                    <p className="font-mono font-extrabold text-foreground text-sm mt-1">
                      {entry.result}
                    </p>
                    <p className="text-3xs text-muted-foreground mt-0.5 line-clamp-2">
                      {entry.summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-3xs text-subtle-foreground">
                    <span>
                      {new Date(entry.timestamp).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <Link
                      to={`/metiers/${entry.tradeSlug}/${entry.toolSlug}`}
                      className="text-primary font-bold hover:underline"
                    >
                      Ouvrir l’outil →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. LES 6 CATÉGORIES DE MÉTIERS (CARTES DE PRÉSENTATION)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isBrowsingAll && (
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Les 6 Spécialités Métiers
            </h2>
            <span className="text-3xs text-muted-foreground font-semibold">
              36 calculateurs spécialisés
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {TRADES.map((trade) => (
              <MetierTradeCard key={trade.slug} trade={trade} />
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. BARRE DE RECHERCHE & FILTRES RAPIDES                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="mb-6 space-y-3">
        <MetierSearchBar
          query={query}
          onQueryChange={setQuery}
          {...(query ? { resultsCount: filteredTools.length } : {})}
        />

        <MetierTradeFilterTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          favoritesCount={favorites.length}
          totalToolsCount={ALL_METIER_TOOLS.length}
        />
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. AFFICHAGE DES OUTILS MÉTIERS                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isBrowsingAll ? (
        <div className="space-y-8">
          {/* Section Favoris si présents */}
          {favorites.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <div className="flex items-center gap-2">
                  <Star className="size-4 text-amber-500 fill-amber-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Vos Outils Métiers Favoris
                  </h2>
                </div>
                <span className="text-3xs text-muted-foreground font-semibold">
                  {favorites.length} outil{favorites.length > 1 ? 's' : ''}
                </span>
              </div>

              <div
                className={cn(
                  viewMode === 'grid'
                    ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    : 'space-y-2 w-full',
                )}
              >
                {ALL_METIER_TOOLS.filter((t) => favorites.includes(t.slug)).map((tool) => (
                  <MetierToolCard
                    key={`fav-${tool.slug}`}
                    tool={tool}
                    variant={viewMode}
                    isFavorite={true}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Les 6 sections métiers */}
          {TRADES.map((trade) => {
            const tradeTools = ALL_METIER_TOOLS.filter((t) => t.tradeSlug === trade.slug);

            return (
              <section key={trade.slug} className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('flex size-6 items-center justify-center rounded-md text-xs font-bold', trade.badgeColor)}>
                      {trade.shortName[0]}
                    </span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {trade.name}
                    </h2>
                  </div>
                  <Link
                    to={`/metiers/${trade.slug}`}
                    className="text-3xs text-primary font-bold hover:underline"
                  >
                    Voir la catégorie ({tradeTools.length}) →
                  </Link>
                </div>

                <div
                  className={cn(
                    viewMode === 'grid'
                      ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'space-y-2 w-full',
                  )}
                >
                  {tradeTools.map((tool) => (
                    <MetierToolCard
                      key={tool.slug}
                      tool={tool}
                      variant={viewMode}
                      isFavorite={isFavorite(tool.slug)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* Affichage filtré ou recherché */
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-xs font-bold text-foreground">
                {query
                  ? `Résultats pour « ${query} »`
                  : activeTab === 'favorites'
                    ? 'Outils favoris'
                    : `Outils ${TRADES.find((t) => t.slug === activeTab)?.name ?? ''}`}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xs text-muted-foreground font-semibold">
                {filteredTools.length} outil{filteredTools.length > 1 ? 's' : ''}
              </span>
              {(query || activeTab !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    handleTabChange('all');
                  }}
                  className="text-3xs text-primary hover:underline cursor-pointer font-semibold"
                >
                  Réinitialiser
                </button>
              )}
            </div>
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
              icon={activeTab === 'favorites' ? Star : Wrench}
              title={activeTab === 'favorites' ? 'Aucun favori métier' : 'Aucun outil métier trouvé'}
              description={
                activeTab === 'favorites'
                  ? 'Cliquez sur l’étoile ⭐ d’un outil métier pour l’ajouter à vos favoris et le retrouver ici instantanément.'
                  : 'Aucun outil métier ne correspond à votre recherche.'
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    handleTabChange('all');
                  }}
                >
                  Voir tous les outils métiers
                </Button>
              }
            />
          )}
        </div>
      )}
    </>
  );
}
