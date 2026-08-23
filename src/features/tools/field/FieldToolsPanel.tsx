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
    tint: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  },
  {
    id: 'magnifier',
    label: 'Loupe HD',
    shortLabel: 'Loupe',
    icon: ZoomIn,
    tint: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
  },
  {
    id: 'compass',
    label: 'Boussole & Cap',
    shortLabel: 'Boussole',
    icon: Compass,
    tint: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
  },
  {
    id: 'level',
    label: 'Niveau à Bulle',
    shortLabel: 'Niveau',
    icon: CircleDot,
    tint: 'text-teal-500 bg-teal-500/10 border-teal-500/30',
  },
  {
    id: 'stopwatch',
    label: 'Chronomètre & Minuteur',
    shortLabel: 'Chrono',
    icon: Timer,
    tint: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
  },
  {
    id: 'voice-recorder',
    label: 'Dictaphone & Mémos',
    shortLabel: 'Dictaphone',
    icon: Mic,
    tint: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
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
        'w-full flex flex-col',
        isModal && 'max-h-[90vh] overflow-hidden rounded-2xl bg-surface border border-border shadow-overlay',
      )}
    >
      {/* Barre de Titre & Sélecteur d'Onglets du Volet */}
      <div className="border-b border-border bg-surface-raised p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Wrench className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground tracking-tight">
                Volet Outils de Terrain
              </h2>
              <p className="text-3xs text-muted-foreground">
                Instruments utilitaires directs pour techniciens et interventions
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
              title="Fermer le volet"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        {/* Barre de Défilement des 6 Outils */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {FIELD_TOOLS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTool === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTool(tab.id)}
                className={cn(
                  'px-2 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 text-center',
                  isSelected
                    ? cn('border-primary bg-primary text-primary-foreground shadow-xs scale-102')
                    : 'border-border bg-surface text-muted-foreground hover:text-foreground hover:border-primary/40',
                )}
              >
                <Icon className={cn('size-4', !isSelected && tab.tint.split(' ')[0])} />
                <span className="text-3xs truncate max-w-full font-semibold">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenu Actif de l'Outil */}
      <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-surface">
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
