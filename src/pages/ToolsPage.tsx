import {
  Calculator,
  Clock,
  LayoutGrid,
  LayoutList,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Wrench,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/config/routes';
import {
  UNIVERSAL_TOOLS,
} from '@/features/tools/calculators/universal';
import { ToolCard } from '@/features/tools';
import { FieldToolsPanel } from '@/features/tools/field/FieldToolsPanel';
import { useToolFavorites } from '@/features/tools/hooks/useToolFavorites';
import { useToolHistory } from '@/features/tools/hooks/useToolHistory';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

type ViewMode = 'grid' | 'list';
type FilterTab = 'all' | 'field' | 'calculators' | 'favorites';

const FIELD_TOOL_SLUGS = ['flashlight', 'magnifier', 'compass', 'level', 'stopwatch', 'voice-recorder'];

export default function ToolsPage() {
  useDocumentTitle('Boîte à Outils Universelle — REZO360 Tools');
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showHistory, setShowHistory] = useState(false);
  const [showFieldPanel, setShowFieldPanel] = useState(false);

  const { isFavorite, toggleFavorite } = useToolFavorites();
  const { history, clearHistory, removeHistoryEntry } = useToolHistory();

  const tabParam = (searchParams.get('tab') as FilterTab) || 'all';
  const activeTab: FilterTab = ['all', 'field', 'calculators', 'favorites'].includes(tabParam)
    ? tabParam
    : 'all';

  const handleTabChange = (tab: FilterTab) => {
    if (tab === 'all') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const allTools = useMemo(() => {
    return UNIVERSAL_TOOLS;
  }, []);

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return allTools.filter((tool) => {
      // Filtrage par onglet
      if (activeTab === 'favorites' && !isFavorite(tool.slug)) return false;
      if (activeTab === 'field' && !FIELD_TOOL_SLUGS.includes(tool.slug)) return false;
      if (activeTab === 'calculators' && FIELD_TOOL_SLUGS.includes(tool.slug)) return false;

      // Filtrage par recherche
      if (normalized === '') return true;

      const inTitle = tool.title.toLowerCase().includes(normalized);
      const inDesc = tool.description.toLowerCase().includes(normalized);
      const inKeywords =
        tool.keywords?.some((k: string) => k.toLowerCase().includes(normalized)) ?? false;

      return inTitle || inDesc || inKeywords;
    });
  }, [allTools, activeTab, isFavorite, query]);

  const favoriteToolsCount = useMemo(
    () => allTools.filter((t) => isFavorite(t.slug)).length,
    [allTools, isFavorite],
  );

  const fieldToolsCount = useMemo(
    () => allTools.filter((t) => FIELD_TOOL_SLUGS.includes(t.slug)).length,
    [allTools],
  );

  return (
    <>
      <PageHeader
        title="Catalogue des outils d’ingénierie & calcul — REZO360 Tools"
        description="Boîte à outils de calculs et conversions pour techniciens et ingénieurs de terrain. Utile à tous les corps de métier."
      />

      <div className="mb-6 space-y-4">
        {/* Barre d'outils supérieure : Recherche + Historique + Vue */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Input
            label="Rechercher un outil"
            hideLabel
            placeholder="Rechercher un outil (nom, formule, unité, ex: pente, m², bar, litre)..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            leadingIcon={<Search />}
            className="max-w-xl"
            {...(query
              ? {
                  trailingSlot: (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Effacer la recherche"
                      className="text-subtle-foreground hover:text-foreground flex size-7 items-center justify-center rounded"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  ),
                }
              : {})}
          />

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Bouton d'accès direct au Volet Outils de Terrain */}
            <Button
              type="button"
              variant={showFieldPanel ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowFieldPanel((v) => !v)}
              className="gap-1.5 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20 cursor-pointer shadow-xs"
            >
              <Wrench className="size-4 text-amber-500" />
              <span>Volet Outils Terrain</span>
            </Button>

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
                <span className="rounded-full bg-primary-foreground/20 dark:bg-primary-foreground/30 px-1.5 py-0.2 text-3xs font-bold">
                  {history.length}
                </span>
              )}
            </Button>

            {/* Sélecteur de vue (Grille / Liste) */}
            <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
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
              <button
                type="button"
                onClick={() => setViewMode('list')}
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
            </div>
          </div>
        </div>

        {/* Modal / Volet Dépliant Outils de Terrain */}
        {showFieldPanel && (
          <div className="mb-4 animate-in fade-in-50 zoom-in-95 duration-200">
            <FieldToolsPanel isModal onClose={() => setShowFieldPanel(false)} />
          </div>
        )}

        {/* Volet Historique déroulant global */}
        {showHistory && (
          <Card className="border-border bg-surface p-4 space-y-3 shadow-md animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Derniers calculs effectués
                </h2>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-3xs text-error hover:underline cursor-pointer font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="size-3" />
                  <span>Vider tout l'historique</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Aucun calcul récent. Utilisez les outils de calcul pour enregistrer automatiquement vos résultats.
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
                          {entry.toolName}
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
                        to={ROUTES.tool(entry.toolSlug)}
                        className="text-primary font-bold hover:underline"
                      >
                        Ouvrir l'outil →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Onglets de filtrage */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleTabChange('all')}
            className={cn(
              'h-9 rounded-lg border px-3.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'all'
                ? 'border-primary bg-primary/10 text-primary shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <Sparkles className="size-3.5" />
            <span>Tous les outils ({allTools.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('field')}
            className={cn(
              'h-9 rounded-lg border px-3.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'field'
                ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <Wrench className="size-3.5 text-amber-500" />
            <span>Outils de Terrain ({fieldToolsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('calculators')}
            className={cn(
              'h-9 rounded-lg border px-3.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'calculators'
                ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <Calculator className="size-3.5 text-sky-500" />
            <span>Calculateurs ({allTools.length - fieldToolsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('favorites')}
            className={cn(
              'h-9 rounded-lg border px-3.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'favorites'
                ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <Star className={cn('size-3.5', favoriteToolsCount > 0 && 'fill-amber-500 text-amber-500')} />
            <span>Mes Favoris ({favoriteToolsCount})</span>
          </button>
        </div>
      </div>

      {/* Grille / Liste des outils */}
      {filteredTools.length > 0 ? (
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
              : 'space-y-3 max-w-4xl',
          )}
        >
          {filteredTools.map((tool) => (
            <ToolCard
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
          icon={activeTab === 'favorites' ? Star : Search}
          title={activeTab === 'favorites' ? 'Aucun favori enregistré' : 'Aucun outil trouvé'}
          description={
            activeTab === 'favorites'
              ? 'Cliquez sur l’étoile ⭐ d’un outil pour l’ajouter à vos favoris et y accéder rapidement.'
              : 'Aucun outil ne correspond à vos termes de recherche.'
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
              Voir tous les outils
            </Button>
          }
        />
      )}
    </>
  );
}
