import {
  ArrowLeftRight,
  Calculator,
  ChevronRight,
  CircleDot,
  Clock,
  Compass,
  FileText,
  Flashlight,
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
import { Dialog } from 'radix-ui';
import { Link, useSearchParams } from 'react-router';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ROUTES } from '@/config/routes';
import { UNIVERSAL_TOOLS } from '@/features/tools/calculators/universal';
import { ToolCard } from '@/features/tools';
import { FieldToolsPanel, type FieldToolType } from '@/features/tools/field/FieldToolsPanel';
import { useToolFavorites } from '@/features/tools/hooks/useToolFavorites';
import { useToolHistory } from '@/features/tools/hooks/useToolHistory';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useViewMode, VIEW_MODE_OPTIONS } from '@/lib/use-view-mode';

type FilterTab = 'all' | 'field' | 'calculators' | 'conversions' | 'notes' | 'favorites';

const FIELD_TOOL_SLUGS = [
  'flashlight',
  'magnifier',
  'compass',
  'level',
  'stopwatch',
  'voice-recorder',
];
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
  const { viewMode, setViewMode } = useViewMode('rezo360:tools_view_mode');
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
      <div className="border-border bg-surface mb-4 rounded-xl border p-2.5 shadow-xs sm:p-3">
        <div className="border-border mb-2 flex items-center justify-between gap-2 border-b pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="bg-surface-raised border-border text-foreground flex size-7 shrink-0 items-center justify-center rounded-lg border font-bold shadow-2xs">
              <Wrench className="text-primary size-3.5" />
            </div>
            <div className="flex min-w-0 items-center gap-1.5 truncate">
              <h2 className="text-foreground truncate text-xs font-bold">Instruments de Terrain</h2>
              <span className="bg-surface-raised text-muted-foreground text-3xs py-0.2 border-border shrink-0 rounded-full border px-1.5 font-bold">
                1-tap
              </span>
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
            className="text-3xs h-7 shrink-0 cursor-pointer gap-1 px-2.5 font-semibold"
          >
            <span>Ouvrir boîte</span>
            <ChevronRight className="size-3" />
          </Button>
        </div>

        {/* Grille compacte et sobre des 6 instruments de terrain */}
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
          <button
            type="button"
            onClick={() => openFieldInstrument('flashlight')}
            className="group bg-surface-raised/60 hover:bg-surface-raised border-border hover:border-primary/40 flex cursor-pointer flex-col items-center justify-center rounded-lg border px-1 py-2 text-center shadow-2xs transition-all active:scale-95"
          >
            <div className="bg-warning/10 text-warning group-hover:bg-warning group-hover:text-foreground mb-1 flex size-7 items-center justify-center rounded-lg shadow-2xs transition-colors sm:size-8">
              <Flashlight className="size-3.5 sm:size-4" />
            </div>
            <span className="text-3xs sm:text-2xs text-foreground max-w-full truncate font-bold">
              Lampe
            </span>
          </button>

          <button
            type="button"
            onClick={() => openFieldInstrument('magnifier')}
            className="group bg-surface-raised/60 hover:bg-surface-raised border-border hover:border-primary/40 flex cursor-pointer flex-col items-center justify-center rounded-lg border px-1 py-2 text-center shadow-2xs transition-all active:scale-95"
          >
            <div className="bg-primary/10 text-primary group-hover:bg-primary mb-1 flex size-7 items-center justify-center rounded-lg shadow-2xs transition-colors group-hover:text-white sm:size-8">
              <ZoomIn className="size-3.5 sm:size-4" />
            </div>
            <span className="text-3xs sm:text-2xs text-foreground max-w-full truncate font-bold">
              Loupe HD
            </span>
          </button>

          <button
            type="button"
            onClick={() => openFieldInstrument('level')}
            className="group bg-surface-raised/60 hover:bg-surface-raised border-border hover:border-primary/40 flex cursor-pointer flex-col items-center justify-center rounded-lg border px-1 py-2 text-center shadow-2xs transition-all active:scale-95"
          >
            <div className="bg-success/10 text-success group-hover:bg-success mb-1 flex size-7 items-center justify-center rounded-lg shadow-2xs transition-colors group-hover:text-white sm:size-8">
              <CircleDot className="size-3.5 sm:size-4" />
            </div>
            <span className="text-3xs sm:text-2xs text-foreground max-w-full truncate font-bold">
              Niveau
            </span>
          </button>

          <button
            type="button"
            onClick={() => openFieldInstrument('compass')}
            className="group bg-surface-raised/60 hover:bg-surface-raised border-border hover:border-primary/40 flex cursor-pointer flex-col items-center justify-center rounded-lg border px-1 py-2 text-center shadow-2xs transition-all active:scale-95"
          >
            <div className="bg-success/10 text-success group-hover:bg-success mb-1 flex size-7 items-center justify-center rounded-lg shadow-2xs transition-colors group-hover:text-white sm:size-8">
              <Compass className="size-3.5 sm:size-4" />
            </div>
            <span className="text-3xs sm:text-2xs text-foreground max-w-full truncate font-bold">
              Boussole
            </span>
          </button>

          <button
            type="button"
            onClick={() => openFieldInstrument('stopwatch')}
            className="group bg-surface-raised/60 hover:bg-surface-raised border-border hover:border-primary/40 flex cursor-pointer flex-col items-center justify-center rounded-lg border px-1 py-2 text-center shadow-2xs transition-all active:scale-95"
          >
            <div className="bg-primary/10 text-primary group-hover:bg-primary mb-1 flex size-7 items-center justify-center rounded-lg shadow-2xs transition-colors group-hover:text-white sm:size-8">
              <Timer className="size-3.5 sm:size-4" />
            </div>
            <span className="text-3xs sm:text-2xs text-foreground max-w-full truncate font-bold">
              Chrono
            </span>
          </button>

          <button
            type="button"
            onClick={() => openFieldInstrument('voice-recorder')}
            className="group bg-surface-raised/60 hover:bg-surface-raised border-border hover:border-primary/40 flex cursor-pointer flex-col items-center justify-center rounded-lg border px-1 py-2 text-center shadow-2xs transition-all active:scale-95"
          >
            <div className="bg-error/10 text-error group-hover:bg-error mb-1 flex size-7 items-center justify-center rounded-lg shadow-2xs transition-colors group-hover:text-white sm:size-8">
              <Mic className="size-3.5 sm:size-4" />
            </div>
            <span className="text-3xs sm:text-2xs text-foreground max-w-full truncate font-bold">
              Dictaphone
            </span>
          </button>
        </div>
      </div>

      <Dialog.Root open={showFieldModal} onOpenChange={setShowFieldModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
          <Dialog.Content className="border-border bg-surface shadow-overlay data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-bottom sm:data-[state=open]:zoom-in-95 fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] min-w-0 flex-col overflow-hidden rounded-t-2xl border-t focus-visible:outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-4xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border">
            <Dialog.Title className="sr-only">Instruments de terrain</Dialog.Title>
            <Dialog.Description className="sr-only">
              Choisissez et utilisez un instrument adapté à votre intervention.
            </Dialog.Description>
            <FieldToolsPanel
              initialTool={activeFieldModalTool}
              onClose={() => setShowFieldModal(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. BARRE DE RECHERCHE, HISTORIQUE ET ONGLETS                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                      className="text-subtle-foreground hover:text-foreground flex size-7 cursor-pointer items-center justify-center rounded"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  ),
                }
              : {})}
          />

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Bouton Historique des calculs */}
            <Button
              type="button"
              variant={showHistory ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowHistory((v) => !v)}
              className="cursor-pointer gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Clock className="size-4" />
              <span>Historique</span>
              {history.length > 0 && (
                <span className="bg-primary-foreground/20 dark:bg-primary-foreground/30 py-0.2 text-3xs rounded-full px-1.5 font-bold">
                  {history.length}
                </span>
              )}
            </Button>

            <SegmentedControl
              label="Mode d’affichage"
              value={viewMode}
              onValueChange={setViewMode}
              options={VIEW_MODE_OPTIONS}
            />
          </div>
        </div>

        {/* Volet Historique déroulant global */}
        {showHistory && (
          <Card className="border-border bg-surface animate-in fade-in-50 space-y-3 p-4 shadow-md duration-200">
            <div className="border-border flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Clock className="text-primary size-4" />
                <h2 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  Derniers calculs effectués
                </h2>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-3xs text-error flex cursor-pointer items-center gap-1 font-semibold hover:underline"
                >
                  <RotateCcw className="size-3" />
                  <span>Vider tout l'historique</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-xs">
                Aucun calcul récent. Utilisez les outils de calcul pour enregistrer automatiquement
                vos résultats.
              </p>
            ) : (
              <div className="grid max-h-72 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-surface-raised border-border flex flex-col justify-between gap-2 rounded-xl border p-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-primary text-2xs truncate font-bold tracking-wider uppercase">
                          {entry.toolName}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeHistoryEntry(entry.id)}
                          className="text-muted-foreground hover:text-error cursor-pointer px-1 text-xs"
                          title="Supprimer"
                        >
                          ×
                        </button>
                      </div>
                      <p className="text-foreground mt-1 font-mono text-sm font-extrabold">
                        {entry.result}
                      </p>
                      <p className="text-3xs text-muted-foreground mt-0.5 line-clamp-2">
                        {entry.summary}
                      </p>
                    </div>

                    <div className="border-border/60 text-3xs text-subtle-foreground flex items-center justify-between border-t pt-2">
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
              'min-h-touch flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition-all sm:h-9 sm:min-h-0',
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
              'min-h-touch flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition-all sm:h-9 sm:min-h-0',
              activeTab === 'field'
                ? 'border-success bg-success/10 text-success shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <Wrench className="text-success size-3.5" />
            <span>Instruments Terrain ({FIELD_TOOL_SLUGS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('calculators')}
            className={cn(
              'min-h-touch flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition-all sm:h-9 sm:min-h-0',
              activeTab === 'calculators'
                ? 'border-primary bg-primary/10 text-primary shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <Calculator className="text-primary size-3.5" />
            <span>Calculateurs ({CALC_TOOL_SLUGS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('conversions')}
            className={cn(
              'min-h-touch flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition-all sm:h-9 sm:min-h-0',
              activeTab === 'conversions'
                ? 'border-primary bg-primary/10 text-primary shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <ArrowLeftRight className="text-primary size-3.5" />
            <span>Conversions ({CONVERSION_TOOL_SLUGS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('notes')}
            className={cn(
              'min-h-touch flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition-all sm:h-9 sm:min-h-0',
              activeTab === 'notes'
                ? 'border-accent bg-accent/10 text-accent shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <FileText className="text-accent size-3.5" />
            <span>Notes & Mémos ({NOTES_TOOL_SLUGS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('favorites')}
            className={cn(
              'min-h-touch flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition-all sm:h-9 sm:min-h-0',
              activeTab === 'favorites'
                ? 'border-warning bg-warning/10 text-warning shadow-xs'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <Star
              className={cn('size-3.5', favoriteTools.length > 0 && 'text-warning fill-amber-500')}
            />
            <span>Favoris ({favoriteTools.length})</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. AFFICHAGE DES OUTILS                                       */}
      {/* ───────────────────────────────────────────────────────────── */}

      {/* Cas A : Navigation par défaut structurée par sections claires (tab === 'all' et query vide) */}
      {isBrowsingAll ? (
        <div className="space-y-6 sm:space-y-8">
          {/* Section Favoris si présents */}
          {favoriteTools.length > 0 && (
            <section className="space-y-2.5">
              <div className="border-border flex items-center justify-between border-b pb-1.5">
                <div className="flex items-center gap-2">
                  <Star className="text-warning size-3.5 fill-amber-500" />
                  <h2 className="text-foreground text-xs font-bold tracking-wider uppercase">
                    Vos Outils Favoris
                  </h2>
                </div>
                <span className="text-3xs text-muted-foreground font-semibold">
                  {favoriteTools.length} outil{favoriteTools.length > 1 ? 's' : ''}
                </span>
              </div>
              <div
                className={cn(
                  viewMode === 'grid'
                    ? 'grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                    : 'w-full space-y-2',
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
          <section className="space-y-2.5">
            <div className="border-border flex items-center justify-between border-b pb-1.5">
              <div className="flex items-center gap-2">
                <Calculator className="text-primary size-3.5" />
                <h2 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  Calculateurs d'Ingénierie & Formules Mathématiques
                </h2>
              </div>
              <span className="text-3xs text-muted-foreground font-semibold">
                {engineeringCalcTools.length} calculateurs
              </span>
            </div>
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  : 'w-full space-y-2',
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
          <section className="space-y-2.5">
            <div className="border-border flex items-center justify-between border-b pb-1.5">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="text-primary size-3.5" />
                <h2 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  Conversions & Mesures Universelles
                </h2>
              </div>
              <span className="text-3xs text-muted-foreground font-semibold">
                {conversionTools.length} outils
              </span>
            </div>
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  : 'w-full space-y-2',
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
          <section className="space-y-2.5">
            <div className="border-border flex items-center justify-between border-b pb-1.5">
              <div className="flex items-center gap-2">
                <Wrench className="text-success size-3.5" />
                <h2 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  Instruments Physiques de Terrain
                </h2>
              </div>
              <span className="text-3xs text-muted-foreground font-semibold">
                {fieldTools.length} instruments
              </span>
            </div>
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  : 'w-full space-y-2',
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
          <section className="space-y-2.5">
            <div className="border-border flex items-center justify-between border-b pb-1.5">
              <div className="flex items-center gap-2">
                <FileText className="text-accent size-3.5" />
                <h2 className="text-foreground text-xs font-bold tracking-wider uppercase">
                  Productivité & Prise de Notes de Chantier
                </h2>
              </div>
              <span className="text-3xs text-muted-foreground font-semibold">
                {notesTools.length} outils
              </span>
            </div>
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  : 'w-full space-y-2',
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
          <div className="border-border mb-3 flex items-center justify-between border-b pb-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary size-3.5" />
              <h2 className="text-foreground text-xs font-bold">
                {query ? `Résultats pour « ${query} »` : `Outils sélectionnés`}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xs text-muted-foreground font-semibold">
                {filteredTools.length} outil{filteredTools.length > 1 ? 's' : ''} trouvé
                {filteredTools.length > 1 ? 's' : ''}
              </span>
              {(query || activeTab !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    handleTabChange('all');
                  }}
                  className="text-3xs text-primary cursor-pointer font-semibold hover:underline"
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
                  ? 'grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  : 'w-full space-y-2',
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
              {...(activeTab === 'favorites' && query.trim() === ''
                ? { illustration: <AtelierIllustration subject="favorites" /> }
                : { icon: activeTab === 'favorites' ? Star : Search })}
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
