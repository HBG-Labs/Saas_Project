import { useState, useEffect } from 'react';
import {
  History,
  Play,
  Pause,
  RotateCcw,
  Clock,
  ChevronUp,
  ChevronDown,
  Gauge,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { TechnicianLocation } from '../types';

interface GPSHistoryDrawerProps {
  technicians: TechnicianLocation[];
  selectedTechId: string | null;
  onSelectTech?: (id: string) => void;
}

export function GPSHistoryDrawer({
  technicians,
  selectedTechId,
}: GPSHistoryDrawerProps) {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [sliderIndex, setSliderIndex] = useState<number>(4);

  const selectedTech =
    technicians.find((t) => t.id === selectedTechId) ?? technicians[0];
  const historyTrail = selectedTech?.historyTrail ?? [];

  // Playback timer loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isPlaying) {
      interval = setInterval(() => {
        setSliderIndex((prev) => {
          if (prev >= historyTrail.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => {
      if (interval !== undefined) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, historyTrail.length]);

  const currentStep = historyTrail[sliderIndex] ?? historyTrail[historyTrail.length - 1];

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-md overflow-hidden transition-all duration-300">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-subtle/40 border-b border-border/60 cursor-pointer select-none hover:bg-surface-hover/50 transition-colors text-left focus:outline-hidden"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <History className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
              Tracé Historique GPS & Télémétrie Flotte
              <Badge variant="outline" className="text-3xs font-mono">
                {selectedTech ? selectedTech.name : 'Flotte complète'}
              </Badge>
            </h4>
            <p className="text-3xs text-muted-foreground">
              Relecture chronologique des étapes, vitesses et temps passés sur site
            </p>
          </div>
        </div>

        {/* Fleet KPI Pills */}
        <div className="hidden md:flex items-center gap-4 text-3xs font-semibold">
          <span className="flex items-center gap-1 text-foreground">
            <span className="size-2 rounded-full bg-blue-500" />
            2 En route (38 km/h moy.)
          </span>
          <span className="flex items-center gap-1 text-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            2 Sur site client
          </span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" />
            Couverture GPS 100%
          </span>
          <span className="text-muted-foreground p-1">
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </span>
        </div>
      </button>

      {/* Drawer Content */}
      {isOpen && (
        <div className="p-4 space-y-4">
          {/* Time Scrubber & Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPlaying(!isPlaying)}
                className="gap-1.5 text-xs h-8"
              >
                {isPlaying ? <Pause className="size-3" /> : <Play className="size-3" />}
                {isPlaying ? 'Pause' : 'Rejouer'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsPlaying(false);
                  setSliderIndex(0);
                }}
                className="text-xs h-8 px-2 text-muted-foreground"
                title="Revenir au départ (08:00)"
              >
                <RotateCcw className="size-3" />
              </Button>
            </div>

            {/* Slider Track */}
            <div className="flex-1 w-full flex items-center gap-3">
              <span className="text-3xs font-mono text-muted-foreground font-semibold">
                {historyTrail[0]?.time ?? '08:00'}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(historyTrail.length - 1, 1)}
                value={sliderIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setSliderIndex(Number(e.target.value));
                }}
                className="flex-1 accent-primary cursor-pointer h-1.5 bg-border rounded-lg"
              />
              <span className="text-3xs font-mono text-primary font-bold">
                {currentStep?.time ?? '14:30 (En direct)'}
              </span>
            </div>

            {/* Current Step Status */}
            {currentStep && (
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-surface-subtle border border-border text-3xs">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Clock className="size-3 text-primary" />
                  {currentStep.time}
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1">
                  <Gauge className="size-3 text-primary" />
                  {currentStep.speedKmH} km/h
                </span>
                <span className="text-border">|</span>
                <Badge
                  variant={currentStep.status === 'on_road' ? 'primary' : 'success'}
                  className="text-3xs"
                >
                  {currentStep.note ?? (currentStep.status === 'on_road' ? 'En transit' : 'Sur site')}
                </Badge>
              </div>
            )}
          </div>

          {/* Chronological Breadcrumb Steps */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-border/40">
            {historyTrail.map((step, idx) => {
              const isCurrent = idx === sliderIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setSliderIndex(idx);
                  }}
                  className={cn(
                    'p-2 rounded-xl border text-3xs cursor-pointer transition-all text-left focus:outline-hidden',
                    isCurrent
                      ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs ring-1 ring-primary/40'
                      : 'bg-surface hover:bg-surface-hover/60 border-border text-muted-foreground',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{step.time}</span>
                    <span>{step.speedKmH > 0 ? `${step.speedKmH} km/h` : 'Arrêt'}</span>
                  </div>
                  <p className="font-semibold truncate text-foreground mt-0.5">
                    {step.note ?? (step.status === 'on_road' ? 'Déplacement' : 'Intervention')}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
