import {
  Check,
  Clock,
  Copy,
  Flag,
  Hourglass,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

interface LapItem {
  lapIndex: number;
  lapTime: number; // en ms
  totalTime: number; // en ms
}

type Mode = 'stopwatch' | 'timer';

function formatTime(ms: number): { main: string; hundredths: string } {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);

  const pad = (n: number) => n.toString().padStart(2, '0');

  const main =
    hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;

  return {
    main,
    hundredths: pad(hundredths),
  };
}

export default function StopwatchTool() {
  const [activeMode, setActiveMode] = useState<Mode>('stopwatch');

  // --- Chronomètre ---
  const [swTime, setSwTime] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [laps, setLaps] = useState<LapItem[]>([]);
  const swStartTimeRef = useRef<number>(0);
  const swAccumulatedRef = useRef<number>(0);
  const swAnimFrameRef = useRef<number | null>(null);

  // --- Minuteur / Compte à rebours ---
  const [timerInitial, setTimerInitial] = useState(300000); // 5 min par défaut (en ms)
  const [timerRemaining, setTimerRemaining] = useState(300000);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSound, setTimerSound] = useState(true);
  const [timerFinished, setTimerFinished] = useState(false);
  const timerEndTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<number | null>(null);
  const [copiedLaps, setCopiedLaps] = useState(false);

  // Émission sonore pour la fin du minuteur
  const playAlarm = useCallback(() => {
    if (!timerSound) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (time: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.2);
      };

      const now = ctx.currentTime;
      playBeep(now, 880);
      playBeep(now + 0.25, 880);
      playBeep(now + 0.5, 1174);
    } catch {
      // Ignorer
    }

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate?.([200, 100, 200, 100, 400]);
      } catch {
        // Ignorer
      }
    }
  }, [timerSound]);

  // Boucle d'animation fluide du chronomètre
  const updateStopwatch = useCallback(() => {
    if (!swRunning) return;
    const now = performance.now();
    const elapsed = now - swStartTimeRef.current + swAccumulatedRef.current;
    setSwTime(elapsed);
    swAnimFrameRef.current = requestAnimationFrame(updateStopwatch);
  }, [swRunning]);

  useEffect(() => {
    if (swRunning) {
      swStartTimeRef.current = performance.now();
      swAnimFrameRef.current = requestAnimationFrame(updateStopwatch);
    } else if (swAnimFrameRef.current) {
      cancelAnimationFrame(swAnimFrameRef.current);
      swAnimFrameRef.current = null;
    }
    return () => {
      if (swAnimFrameRef.current) cancelAnimationFrame(swAnimFrameRef.current);
    };
  }, [swRunning, updateStopwatch]);

  // Commandes Chronomètre
  const toggleStopwatch = () => {
    if (swRunning) {
      swAccumulatedRef.current += performance.now() - swStartTimeRef.current;
      setSwRunning(false);
    } else {
      setSwRunning(true);
    }
  };

  const resetStopwatch = () => {
    setSwRunning(false);
    swAccumulatedRef.current = 0;
    setSwTime(0);
    setLaps([]);
  };

  const getExactElapsed = () => {
    if (!swRunning) return swAccumulatedRef.current;
    return performance.now() - swStartTimeRef.current + swAccumulatedRef.current;
  };

  const recordLap = () => {
    const exactNow = getExactElapsed();
    if (exactNow === 0) return;
    const lastLapTotal = laps.length > 0 ? (laps[0]?.totalTime ?? 0) : 0;
    const currentLapTime = Math.max(0, exactNow - lastLapTotal);

    const newLap: LapItem = {
      lapIndex: laps.length + 1,
      lapTime: currentLapTime,
      totalTime: exactNow,
    };
    setLaps([newLap, ...laps]);
  };

  // Copier les tours
  const copyLaps = () => {
    if (laps.length === 0) return;
    const text = laps
      .map(
        (l) =>
          `Tour #${l.lapIndex} : ${formatTime(l.lapTime).main}.${formatTime(l.lapTime).hundredths} (Cumul : ${formatTime(l.totalTime).main}.${formatTime(l.totalTime).hundredths})`,
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLaps(true);
    setTimeout(() => setCopiedLaps(false), 2000);
  };

  // Trouver le tour le plus rapide et le plus lent
  const bestLap = laps.length >= 2 ? Math.min(...laps.map((l) => l.lapTime)) : null;
  const worstLap = laps.length >= 2 ? Math.max(...laps.map((l) => l.lapTime)) : null;

  // --- Boucle Minuteur ---
  useEffect(() => {
    if (!timerRunning) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    timerEndTimeRef.current = Date.now() + timerRemaining;
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, timerEndTimeRef.current - Date.now());
      setTimerRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setTimerRunning(false);
        setTimerFinished(true);
        playAlarm();
      }
    }, 100);

    timerIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [timerRunning, playAlarm]);

  const toggleTimer = () => {
    if (timerRunning) {
      setTimerRunning(false);
    } else {
      if (timerRemaining <= 0) {
        setTimerRemaining(timerInitial);
      }
      setTimerFinished(false);
      setTimerRunning(true);
    }
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerFinished(false);
    setTimerRemaining(timerInitial);
  };

  const setTimerPreset = (seconds: number) => {
    const ms = seconds * 1000;
    setTimerInitial(ms);
    setTimerRemaining(ms);
    setTimerRunning(false);
    setTimerFinished(false);
  };

  const swFormatted = formatTime(swTime);
  const timerFormatted = formatTime(timerRemaining);
  const timerProgress = timerInitial > 0 ? (timerRemaining / timerInitial) * 100 : 0;

  // Calcul du tour en cours
  const lastLapTotal = laps.length > 0 ? (laps[0]?.totalTime ?? 0) : 0;
  const currentRunningLapTime = Math.max(0, swTime - lastLapTotal);
  const currentRunningLapFmt = formatTime(currentRunningLapTime);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto min-w-0">
      <Card className="border-border bg-surface shadow-2xs overflow-hidden min-w-0">
        <CardHeader className="border-b border-border/70 p-3.5 sm:p-4 pb-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Timer className="size-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base font-bold truncate">Chronomètre & Minuteur</CardTitle>
                <p className="text-3xs sm:text-xs text-muted-foreground line-clamp-1">
                  Mesure de temps de purge, test de débit, essais de pression et durées.
                </p>
              </div>
            </div>

            {/* Bascule Mode Chrono / Minuteur */}
            <div className="flex items-center gap-1 bg-surface-raised border border-border p-0.5 sm:p-1 rounded-xl self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveMode('stopwatch')}
                className={cn(
                  'px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                  activeMode === 'stopwatch'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Clock className="size-3.5" />
                <span>Chronomètre</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('timer')}
                className={cn(
                  'px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                  activeMode === 'timer'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Hourglass className="size-3.5" />
                <span>Minuteur</span>
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden">
          {activeMode === 'stopwatch' ? (
            /* --- VUE CHRONOMÈTRE --- */
            <div className="space-y-6">
              {/* Grand Afficheur Numérique */}
              <div className="flex flex-col items-center justify-center py-6 bg-slate-950 rounded-2xl border border-slate-800 text-white shadow-inner">
                <div className="font-mono text-5xl sm:text-7xl font-black tracking-tight flex items-baseline">
                  <span>{swFormatted.main}</span>
                  <span className="text-2xl sm:text-4xl text-amber-400 font-bold ml-1">
                    .{swFormatted.hundredths}
                  </span>
                </div>
                <span className="text-3xs uppercase font-bold text-slate-400 mt-2 tracking-widest">
                  Précision au 1/100e de seconde
                </span>
              </div>

              {/* Boutons d'Action Principaux */}
              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button"
                  size="lg"
                  variant={swRunning ? 'outline' : 'primary'}
                  onClick={toggleStopwatch}
                  className={cn(
                    'w-36 h-12 text-sm font-bold gap-2 shadow-md cursor-pointer',
                    swRunning && 'border-amber-500 text-amber-500 hover:bg-amber-500/10',
                  )}
                >
                  {swRunning ? <Pause className="size-5" /> : <Play className="size-5 fill-current" />}
                  <span>{swRunning ? 'Pause' : swTime === 0 ? 'Démarrer' : 'Reprendre'}</span>
                </Button>

                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={recordLap}
                  disabled={swTime === 0}
                  className="w-32 h-12 text-sm font-bold gap-2 cursor-pointer"
                >
                  <Flag className="size-4 text-primary" />
                  <span>Tour / Lap</span>
                </Button>

                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={resetStopwatch}
                  disabled={swTime === 0}
                  className="h-12 text-xs font-semibold gap-1 text-muted-foreground hover:text-error cursor-pointer"
                >
                  <RotateCcw className="size-4" />
                  <span className="hidden sm:inline">Reset</span>
                </Button>
              </div>

              {/* Tableau des Tours (Laps) */}
              {(laps.length > 0 || swTime > 0) && (
                <div className="p-4 rounded-xl bg-surface-raised border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Tableau des temps &amp; paliers ({laps.length + (swTime > 0 ? 1 : 0)})
                    </span>
                    {laps.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyLaps}
                        className="h-7 px-2 text-3xs font-semibold gap-1 cursor-pointer"
                      >
                        {copiedLaps ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        {copiedLaps ? 'Copié' : 'Copier les tours'}
                      </Button>
                    )}
                  </div>

                  {/* En-têtes de colonnes clairs */}
                  <div className="grid grid-cols-12 px-3 py-1.5 text-3xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    <div className="col-span-3">N° Tour</div>
                    <div className="col-span-5 text-right">Durée du tour</div>
                    <div className="col-span-4 text-right">Temps cumulé</div>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
                    {/* Tour actif en cours */}
                    {swTime > 0 && (
                      <div className="grid grid-cols-12 items-center py-2 px-3 text-xs rounded-lg bg-primary/10 text-primary font-bold transition-colors">
                        <div className="col-span-3 flex items-center gap-1.5">
                          <span className="font-mono">#{laps.length + 1}</span>
                          <span className="text-3xs uppercase font-extrabold px-1.5 py-0.2 rounded bg-primary/20 text-primary">
                            {swRunning ? 'En cours' : 'Arrêté'}
                          </span>
                        </div>
                        <div className="col-span-5 text-right font-mono text-foreground font-black text-xs sm:text-sm">
                          {currentRunningLapFmt.main}.{currentRunningLapFmt.hundredths}
                        </div>
                        <div className="col-span-4 text-right font-mono text-muted-foreground text-xs">
                          {swFormatted.main}.{swFormatted.hundredths}
                        </div>
                      </div>
                    )}

                    {/* Liste des tours enregistrés */}
                    {laps.map((lap) => {
                      const isBest = bestLap !== null && lap.lapTime === bestLap;
                      const isWorst = worstLap !== null && lap.lapTime === worstLap;
                      const lapFmt = formatTime(lap.lapTime);
                      const totalFmt = formatTime(lap.totalTime);

                      return (
                        <div
                          key={lap.lapIndex}
                          className={cn(
                            'grid grid-cols-12 items-center py-2 px-3 text-xs rounded-lg transition-colors',
                            isBest && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold',
                            isWorst && 'bg-red-500/10 text-red-700 dark:text-red-300 font-semibold',
                          )}
                        >
                          <div className="col-span-3 flex items-center gap-1.5">
                            <span className="font-mono text-muted-foreground">#{lap.lapIndex}</span>
                            {isBest && (
                              <span className="text-3xs uppercase font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                Plus rapide
                              </span>
                            )}
                            {isWorst && (
                              <span className="text-3xs uppercase font-extrabold px-1.5 py-0.2 rounded bg-red-500/20 text-red-600 dark:text-red-400">
                                Plus long
                              </span>
                            )}
                          </div>

                          <div className="col-span-5 text-right font-mono text-foreground font-semibold">
                            {lapFmt.main}.{lapFmt.hundredths}
                          </div>

                          <div className="col-span-4 text-right font-mono text-muted-foreground text-xs">
                            {totalFmt.main}.{totalFmt.hundredths}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* --- VUE MINUTEUR / COMPTE À REBOURS --- */
            <div className="space-y-6">
              {/* Grand Afficheur Minuteur avec Alerte Fin */}
              <div
                className={cn(
                  'flex flex-col items-center justify-center py-6 rounded-2xl border text-white shadow-inner transition-colors duration-300',
                  timerFinished
                    ? 'bg-red-950 border-red-600 animate-pulse'
                    : 'bg-slate-950 border-slate-800',
                )}
              >
                <div className="font-mono text-5xl sm:text-7xl font-black tracking-tight">
                  {timerFormatted.main}
                </div>
                <div className="w-48 bg-slate-800 h-2 rounded-full mt-4 overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-100',
                      timerFinished ? 'bg-red-500' : 'bg-primary',
                    )}
                    style={{ width: `${timerProgress}%` }}
                  />
                </div>
                <span className="text-3xs uppercase font-bold text-slate-400 mt-2 tracking-widest">
                  {timerFinished ? '⚠️ TEMPS ÉCOULÉ !' : 'Compte à rebours restant'}
                </span>
              </div>

              {/* Raccourcis Prédéfinis */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Durées Rapides (Chantier / Purge / Essais)
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {[
                    { label: '30s', sec: 30 },
                    { label: '1m', sec: 60 },
                    { label: '2m', sec: 120 },
                    { label: '5m', sec: 300 },
                    { label: '10m', sec: 600 },
                    { label: '15m', sec: 900 },
                    { label: '30m', sec: 1800 },
                    { label: '1h', sec: 3600 },
                  ].map((p) => (
                    <button
                      key={p.sec}
                      type="button"
                      onClick={() => setTimerPreset(p.sec)}
                      className={cn(
                        'p-2 rounded-lg border text-center text-xs font-bold font-mono transition-all cursor-pointer',
                        timerInitial === p.sec * 1000
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                          : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Boutons d'Action Minuteur */}
              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button"
                  size="lg"
                  variant={timerRunning ? 'outline' : 'primary'}
                  onClick={toggleTimer}
                  className={cn(
                    'w-40 h-12 text-sm font-bold gap-2 shadow-md cursor-pointer',
                    timerRunning && 'border-amber-500 text-amber-500 hover:bg-amber-500/10',
                  )}
                >
                  {timerRunning ? <Pause className="size-5" /> : <Play className="size-5 fill-current" />}
                  <span>{timerRunning ? 'Pause' : 'Démarrer'}</span>
                </Button>

                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={resetTimer}
                  className="h-12 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <RotateCcw className="size-4" />
                  <span>Réinitialiser</span>
                </Button>

                <button
                  type="button"
                  onClick={() => setTimerSound((v) => !v)}
                  className="p-3 rounded-xl border border-border bg-surface-raised text-muted-foreground hover:text-foreground cursor-pointer"
                  title={timerSound ? 'Alerte sonore activée' : 'Alerte sonore muette'}
                >
                  {timerSound ? <Volume2 className="size-5 text-primary" /> : <VolumeX className="size-5" />}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
