import {
  ArrowLeftRight,
  Calculator,
  ChevronRight,
  CircleDot,
  Clock,
  Compass,
  FileText,
  Flashlight,
  LayoutGrid,
  LayoutList,
  Mic,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Timer,
  Wrench,
  X,
  ZoomIn,
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
import { FieldToolsPanel, type FieldToolType } from '@/features/tools/field/FieldToolsPanel';
import { useToolFavorites } from '@/features/tools/hooks/useToolFavorites';
import { useToolHistory } from '@/features/tools/hooks/useToolHistory';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

type ViewMode = 'grid' | 'list';
type FilterTab = 'all' | 'field' | 'calculators' | 'conversions' | 'notes' | 'favorites';

const FIELD_TOOL_SLUGS = ['flashlight', 'magnifier', 'compass', 'level', 'stopwatch', 'voice-recorder'];
const CONVERSION_TOOL_SLUGS = ['unit-converter', 'distance-calculator', 'time-calculator'];
const NOTES_TOOL_SLUGS = ['notepad', 'voice-recorder'];
const CALC_TOOL_SLUGS = [
  'scientific-calculator',
  'surface-calculator',
  'volume-calculator',
  'slope-calculator',
  'percentage-calculator',
  'power-calculator',
  'pressure-calculator',
  'flow-calculator',
  'ratio-calculator',
  'weight-calculator',
];

export default function ToolsPage() {
  useDocumentTitle('Boîte à Outils & Instruments — REZO360 Tools');
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showHistory, setShowHistory] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [activeFieldModalTool, setActiveFieldModalTool] = useState<FieldToolType>('flashlight');

  const { isFavorite, toggleFavorite } = useToolFavorites();
  const { history, clearHistory, removeHistoryEntry } = useToolHistory();

  const tabParam = (searchParams.get('tab') as FilterTab) || 'all';
  const activeTab: FilterTab = [
    'all',
    'field',
    'calculators',
    'conversions',
    'notes',
    'favorites',
  ].includes(tabParam)
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

  const allTools = useMemo(() => UNIVERSAL_TOOLS, []);

  // Outils filtrés par recherche ou onglet spécifique
  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return allTools.filter((tool) => {
      // Filtrage par onglet
      if (activeTab === 'favorites' && !isFavorite(tool.slug)) return false;
      if (activeTab === 'field' && !FIELD_TOOL_SLUGS.includes(tool.slug)) return false;
      if (activeTab === 'calculators' && !CALC_TOOL_SLUGS.includes(tool.slug)) return false;
      if (activeTab === 'conversions' && !CONVERSION_TOOL_SLUGS.includes(tool.slug)) return false;
      if (activeTab === 'notes' && !NOTES_TOOL_SLUGS.includes(tool.slug)) return false;

      // Filtrage par recherche
      if (normalized === '') return true;

      const inTitle = tool.title.toLowerCase().includes(normalized);
      const inDesc = tool.description.toLowerCase().includes(normalized);
      const inKeywords =
        tool.keywords?.some((k: string) => k.toLowerCase().includes(normalized)) ?? false;

      return inTitle || inDesc || inKeywords;
    });
  }, [allTools, activeTab, isFavorite, query]);

  // Groupes pour l'affichage structuré quand tab === 'all' et query === ''
  const favoriteTools = useMemo(
    () => allTools.filter((t) => isFavorite(t.slug)),
    [allTools, isFavorite],
  );

  const engineeringCalcTools = useMemo(
    () => allTools.filter((t) => CALC_TOOL_SLUGS.includes(t.slug)),
    [allTools],
  );

  const conversionTools = useMemo(
    () => allTools.filter((t) => CONVERSION_TOOL_SLUGS.includes(t.slug)),
    [allTools],
  );

  const notesTools = useMemo(
    () => allTools.filter((t) => NOTES_TOOL_SLUGS.includes(t.slug)),
    [allTools],
  );

  const fieldTools = useMemo(
    () => allTools.filter((t) => FIELD_TOOL_SLUGS.includes(t.slug)),
    [allTools],
  );

  const openFieldInstrument = (toolId: FieldToolType) => {
    setActiveFieldModalTool(toolId);
    setShowFieldModal(true);
  };

  const isBrowsingAll = activeTab === 'all' && query.trim() === '';

  return (
    <>
      <PageHeader
        title="Catalogue des outils & instruments de terrain — REZO360 Tools"
        description="Ceinture d'outils numériques pour techniciens et ingénieurs : capteurs physiques de terrain, calculateurs et fiches de calculs rapides."
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. CEINTURE D'ACTION RAPIDE : LES 6 INSTRUMENTS DE TERRAIN   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-surface to-amber-500/5 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 pb-3 border-b border-amber-500/20">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold shadow-xs">
              <Wrench className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">Ceinture d'Instruments de Terrain</h2>
                <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-3xs px-2 py-0.5 border border-amber-500/30">
                  Accès 1-tap
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Capteurs et outils physiques de votre smartphone pour interventions rapides.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveFieldModalTool('flashlight');
              setShowFieldModal(true);
            }}
            className="text-xs font-bold gap-1.5 self-start sm:self-auto bg-surface/80 hover:bg-surface border-amber-500/30 text-amber-700 dark:text-amber-300 shadow-xs cursor-pointer"
          >
            <span>Ouvrir la boîte à outils</span>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>

        {/* Grille tactile des 6 instruments de terrain */}
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-2.5">
          <button
            type="button"
            onClick={() => openFieldInstrument('flashlight')}
            className="group flex flex-col items-center justify-center p-3 rounded-xl bg-surface border border-border hover:border-amber-500/50 hover:bg-amber-500/10 transition-all cursor-pointer shadow-xs active:scale-95 text-center"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shadow-xs mb-2">
              <Flashlight className="size-5" />
            </div>
            <span className="text-xs font-bold text-foreground">Lampe Torche</span>
            <span className="text-3xs text-muted-foreground mt-0.5">6500K & SOS</span>
          </button>

          <button
            type="button"
            onClick={() => openFieldInstrument('magnifier')}
            className="group flex flex-col items-center justify-center p-3 rounded-xl bg-surface border border-border hover:border-sky-500/50 hover:bg-sky-500/10 transition-all cursor-pointer shadow-xs active:scale-95 text-center"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition-colors shadow-xs mb-2">
              <ZoomIn className="size-5" />
            </div>
            <span className="text-xs font-bold text-foreground">Loupe HD</span>
            <span className="text-3xs text-muted-foreground mt-0.5">Zoom 12x & Gel</span>
          </button>

          <button
            type="button"
            onClick={() => openFieldInstrument('level')}
            className="group flex flex-col items-center justify-center p-3 rounded-xl bg-surface border border-border hover:border-teal-500/50 hover:bg-teal-500/10 transition-all cursor-pointer shadow-xs active:scale-95 text-center"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 group-hover:bg-teal-500 group-hover:text-white transition-colors shadow-xs mb-2">
              <CircleDot className="size-5" />
            </div>
            <span className="text-xs font-bold text-foreground">Niveau à Bulle</span>
            <span className="text-3xs text-muted-foreground mt-0.5">2D & Pente mm/m</span>
          </button>

          <button
            type="button"
            onClick={() => openFieldInstrument('compass')}
            className="group flex flex-col items-center justify-center p-3 rounded-xl bg-surface border border-border hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all cursor-pointer shadow-xs active:scale-95 text-center"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-xs mb-2">
              <Compass className="size-5" />
            </div>
            <span className="text-xs font-bold text-foreground">Boussole & Cap</span>
            <span className="text-3xs text-muted-foreground mt-0.5">Azimut & GPS</span>
          </button>

          <button
            type="button"
            onClick={() => openFieldInstrument('stopwatch')}
            className="group flex flex-col items-center justify-center p-3 rounded-xl bg-surface border border-border hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all cursor-pointer shadow-xs active:scale-95 text-center"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors shadow-xs mb-2">
              <Timer className="size-5" />
            </div>
            <span className="text-xs font-bold text-foreground">Chronomètre</span>
            <span className="text-3xs text-muted-foreground mt-0.5">1/100s & Purge</span>
          </button>

          <button
            type="button"
            onClick={() => openFieldInstrument('voice-recorder')}
            className="group flex flex-col items-center justify-center p-3 rounded-xl bg-surface border border-border hover:border-rose-500/50 hover:bg-rose-500/10 transition-all cursor-pointer shadow-xs active:scale-95 text-center"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors shadow-xs mb-2">
              <Mic className="size-5" />
            </div>
            <span className="text-xs font-bold text-foreground">Dictaphone</span>
            <span className="text-3xs text-muted-foreground mt-0.5">Mémos Vocaux</span>
          </button>
        </div>
      </div>

      {/* Modal / Volet Dépliant Outils de Terrain */}
      {showFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50 duration-200">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-surface border border-border shadow-overlay">
            <FieldToolsPanel
              initialTool={activeFieldModalTool}
              isModal
              onClose={() => setShowFieldModal(false)}
            />
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. BARRE DE RECHERCHE, HISTORIQUE ET ONGLETS                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="mb-6 space-y-4">
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
                      className="text-subtle-foreground hover:text-foreground flex size-7 items-center justify-center rounded cursor-pointer"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  ),
                }
              : {})}
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
                ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <Wrench className="size-3.5 text-teal-500" />
            <span>Instruments Terrain ({FIELD_TOOL_SLUGS.length})</span>
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
            <span>Calculateurs ({CALC_TOOL_SLUGS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('conversions')}
            className={cn(
              'h-9 rounded-lg border px-3.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'conversions'
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <ArrowLeftRight className="size-3.5 text-indigo-500" />
            <span>Conversions ({CONVERSION_TOOL_SLUGS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('notes')}
            className={cn(
              'h-9 rounded-lg border px-3.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
              activeTab === 'notes'
                ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <FileText className="size-3.5 text-purple-500" />
            <span>Notes & Mémos ({NOTES_TOOL_SLUGS.length})</span>
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
            <Star className={cn('size-3.5', favoriteTools.length > 0 && 'fill-amber-500 text-amber-500')} />
            <span>Favoris ({favoriteTools.length})</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. AFFICHAGE DES OUTILS                                       */}
      {/* ───────────────────────────────────────────────────────────── */}

      {/* Cas A : Navigation par défaut structurée par sections claires (tab === 'all' et query vide) */}
      {isBrowsingAll ? (
        <div className="space-y-10">
          {/* Section Favoris si présents */}
          {favoriteTools.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Star className="size-4 text-amber-500 fill-amber-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Vos Outils Favoris
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground font-semibold">
                  {favoriteTools.length} outil{favoriteTools.length > 1 ? 's' : ''}
                </span>
              </div>
              <div
                className={cn(
                  viewMode === 'grid'
                    ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                    : 'space-y-3 max-w-4xl',
                )}
              >
                {favoriteTools.map((tool) => (
                  <ToolCard
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

          {/* Section Calculateurs & Formules d'Ingénierie */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Calculator className="size-4 text-sky-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Calculateurs d'Ingénierie & Formules Mathématiques
                </h2>
              </div>
              <span className="text-xs text-muted-foreground font-semibold">
                {engineeringCalcTools.length} calculateurs
              </span>
            </div>
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                  : 'space-y-3 max-w-4xl',
              )}
            >
              {engineeringCalcTools.map((tool) => (
                <ToolCard
                  key={`calc-${tool.slug}`}
                  tool={tool}
                  variant={viewMode}
                  isFavorite={isFavorite(tool.slug)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </section>

          {/* Section Conversions & Mesures */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="size-4 text-indigo-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Conversions & Mesures Universelles
                </h2>
              </div>
              <span className="text-xs text-muted-foreground font-semibold">
                {conversionTools.length} outils
              </span>
            </div>
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                  : 'space-y-3 max-w-4xl',
              )}
            >
              {conversionTools.map((tool) => (
                <ToolCard
                  key={`conv-${tool.slug}`}
                  tool={tool}
                  variant={viewMode}
                  isFavorite={isFavorite(tool.slug)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </section>

          {/* Section Instruments de Terrain */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Wrench className="size-4 text-teal-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Instruments Physiques de Terrain
                </h2>
              </div>
              <span className="text-xs text-muted-foreground font-semibold">
                {fieldTools.length} instruments
              </span>
            </div>
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                  : 'space-y-3 max-w-4xl',
              )}
            >
              {fieldTools.map((tool) => (
                <ToolCard
                  key={`field-${tool.slug}`}
                  tool={tool}
                  variant={viewMode}
                  isFavorite={isFavorite(tool.slug)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </section>

          {/* Section Notes & Mémos */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-purple-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Productivité & Prise de Notes de Chantier
                </h2>
              </div>
              <span className="text-xs text-muted-foreground font-semibold">
                {notesTools.length} outils
              </span>
            </div>
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                  : 'space-y-3 max-w-4xl',
              )}
            >
              {notesTools.map((tool) => (
                <ToolCard
                  key={`notes-${tool.slug}`}
                  tool={tool}
                  variant={viewMode}
                  isFavorite={isFavorite(tool.slug)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </section>
        </div>
      ) : (
        /* Cas B : Recherche active ou onglet de filtre spécifique sélectionné */
        <div>
          {/* En-tête des résultats filtrés */}
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                {query ? `Résultats pour « ${query} »` : `Outils sélectionnés`}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-semibold">
                {filteredTools.length} outil{filteredTools.length > 1 ? 's' : ''} trouvé{filteredTools.length > 1 ? 's' : ''}
              </span>
              {(query || activeTab !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    handleTabChange('all');
                  }}
                  className="text-xs text-primary hover:underline cursor-pointer font-semibold"
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
                  : 'Aucun outil ne correspond à vos critères de recherche.'
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
        </div>
      )}
    </>
  );
}
