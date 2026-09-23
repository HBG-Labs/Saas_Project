import { CircleDot, Compass, Flashlight, Mic, Timer, Wrench, X, ZoomIn } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { cn } from '@/lib/cn';

const FlashlightTool = lazy(() => import('./flashlight/FlashlightTool'));
const MagnifierTool = lazy(() => import('./magnifier/MagnifierTool'));
const CompassTool = lazy(() => import('./compass/CompassTool'));
const LevelTool = lazy(() => import('./level/LevelTool'));
const StopwatchTool = lazy(() => import('./stopwatch/StopwatchTool'));
const VoiceRecorderTool = lazy(() => import('./voice-recorder/VoiceRecorderTool'));

export type FieldToolType =
  'flashlight' | 'magnifier' | 'compass' | 'level' | 'stopwatch' | 'voice-recorder';

interface FieldToolsPanelProps {
  initialTool?: FieldToolType;
  onClose?: () => void;
  isModal?: boolean;
}

const FIELD_TOOLS_TABS: {
  id: FieldToolType;
  label: string;
  shortLabel: string;
  icon: typeof Flashlight;
  tint: string;
}[] = [
  {
    id: 'flashlight',
    label: 'Lampe Torche',
    shortLabel: 'Lampe',
    icon: Flashlight,
    tint: 'text-warning bg-warning/10 border-warning/30',
  },
  {
    id: 'magnifier',
    label: 'Loupe HD',
    shortLabel: 'Loupe',
    icon: ZoomIn,
    tint: 'text-primary bg-primary/10 border-primary/30',
  },
  {
    id: 'compass',
    label: 'Boussole & Cap',
    shortLabel: 'Boussole',
    icon: Compass,
    tint: 'text-success bg-success/10 border-success/30',
  },
  {
    id: 'level',
    label: 'Niveau à Bulle',
    shortLabel: 'Niveau',
    icon: CircleDot,
    tint: 'text-success bg-success/10 border-success/30',
  },
  {
    id: 'stopwatch',
    label: 'Chronomètre & Minuteur',
    shortLabel: 'Chrono',
    icon: Timer,
    tint: 'text-primary bg-primary/10 border-primary/30',
  },
  {
    id: 'voice-recorder',
    label: 'Dictaphone & Mémos',
    shortLabel: 'Dictaphone',
    icon: Mic,
    tint: 'text-error bg-error/10 border-error/30',
  },
];

export function FieldToolsPanel({
  initialTool = 'flashlight',
  onClose,
  isModal = false,
}: FieldToolsPanelProps) {
  const [activeTool, setActiveTool] = useState<FieldToolType>(initialTool);
  const activeToolLabel =
    FIELD_TOOLS_TABS.find((tool) => tool.id === activeTool)?.label ?? 'Instrument de terrain';

  return (
    <div
      className={cn(
        'flex min-h-0 w-full min-w-0 flex-1 flex-col',
        isModal &&
          'bg-surface border-border shadow-overlay max-h-[92vh] overflow-hidden rounded-2xl border',
      )}
    >
      {/* Barre de Titre & Sélecteur d'Onglets du Volet */}
      <div className="border-border bg-surface-raised min-w-0 space-y-2.5 border-b p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="bg-surface border-border text-foreground flex size-7 shrink-0 items-center justify-center rounded-lg border font-bold shadow-2xs sm:size-8">
              <Wrench className="text-primary size-3.5 sm:size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-foreground truncate text-xs font-extrabold tracking-tight sm:text-sm">
                Instruments de Terrain
              </h2>
              <p className="text-3xs text-muted-foreground truncate">
                Capteurs physiques et utilitaires d'intervention
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="size-touch text-muted-foreground hover:bg-surface hover:text-foreground focus-visible:ring-ring flex shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none sm:size-8"
              aria-label="Fermer les instruments de terrain"
              title="Fermer le volet"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Barre de Défilement des 6 Outils */}
        <div
          role="group"
          aria-label="Choisir un instrument de terrain"
          className="grid grid-cols-3 gap-1 sm:grid-cols-6 sm:gap-1.5"
        >
          {FIELD_TOOLS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTool === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTool(tab.id)}
                aria-pressed={isSelected}
                className={cn(
                  'min-h-touch focus-visible:ring-ring flex min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-center text-xs font-bold transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:outline-none sm:gap-1 sm:px-2 sm:py-2',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-2xs'
                    : 'border-border bg-surface text-muted-foreground hover:text-foreground hover:border-primary/40',
                )}
              >
                <Icon
                  className={cn(
                    'size-3.5 shrink-0 sm:size-4',
                    !isSelected && tab.tint.split(' ')[0],
                  )}
                  aria-hidden="true"
                />
                <span className="text-3xs max-w-full truncate font-semibold">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenu Actif de l'Outil */}
      <div
        role="region"
        aria-label={activeToolLabel}
        className="bg-surface min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 sm:p-5"
      >
        <Suspense fallback={<LoadingScreen />}>
          {activeTool === 'flashlight' && <FlashlightTool />}
          {activeTool === 'magnifier' && <MagnifierTool />}
          {activeTool === 'compass' && <CompassTool />}
          {activeTool === 'level' && <LevelTool />}
          {activeTool === 'stopwatch' && <StopwatchTool />}
          {activeTool === 'voice-recorder' && <VoiceRecorderTool />}
        </Suspense>
      </div>
    </div>
  );
}
