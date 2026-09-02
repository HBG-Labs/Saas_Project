import {
  CircleDot,
  Compass,
  Flashlight,
  Mic,
  Timer,
  Wrench,
  X,
  ZoomIn,
} from 'lucide-react';
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
  | 'flashlight'
  | 'magnifier'
  | 'compass'
  | 'level'
  | 'stopwatch'
  | 'voice-recorder';

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

  return (
    <div
      className={cn(
        'w-full flex flex-col min-w-0',
        isModal && 'max-h-[92vh] overflow-hidden rounded-2xl bg-surface border border-border shadow-overlay',
      )}
    >
      {/* Barre de Titre & Sélecteur d'Onglets du Volet */}
      <div className="border-b border-border bg-surface-raised p-3 sm:p-4 space-y-2.5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border text-foreground font-bold shadow-2xs">
              <Wrench className="size-3.5 sm:size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight truncate">
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
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer shrink-0"
              title="Fermer le volet"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        {/* Barre de Défilement des 6 Outils */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-1.5">
          {FIELD_TOOLS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTool === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTool(tab.id)}
                className={cn(
                  'px-1.5 py-1.5 sm:px-2 sm:py-2 rounded-lg border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 sm:gap-1 text-center min-w-0',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-2xs'
                    : 'border-border bg-surface text-muted-foreground hover:text-foreground hover:border-primary/40',
                )}
              >
                <Icon className={cn('size-3.5 sm:size-4 shrink-0', !isSelected && tab.tint.split(' ')[0])} />
                <span className="text-3xs truncate max-w-full font-semibold">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenu Actif de l'Outil */}
      <div className="p-3 sm:p-5 overflow-y-auto overflow-x-hidden flex-1 bg-surface min-w-0">
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
