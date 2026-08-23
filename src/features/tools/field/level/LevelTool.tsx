import {
  Activity,
  Check,
  CircleDot,
  Lock,
  RotateCcw,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

export default function LevelTool() {
  const [pitch, setPitch] = useState(0); // Axe Y (-90° à +90°)
  const [roll, setRoll] = useState(0); // Axe X (-90° à +90°)
  const [calibratedPitch, setCalibratedPitch] = useState(0);
  const [calibratedRoll, setCalibratedRoll] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasOrientationSensor, setHasOrientationSensor] = useState<boolean | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);

  // Demande d'autorisation pour iOS 13+
  const requestOrientationPermission = useCallback(async () => {
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as any)?.requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setHasOrientationSensor(true);
          setPermissionRequested(true);
        } else {
          setHasOrientationSensor(false);
        }
      } catch (err) {
        console.warn('Erreur permission orientation niveau:', err);
      }
    } else {
      setPermissionRequested(true);
    }
  }, []);

  // Écoute des capteurs
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (isLocked) return;

      if (event.beta !== null && event.gamma !== null) {
        setHasOrientationSensor(true);
        // Limiter entre -90 et +90
        const rawPitch = Math.max(-90, Math.min(90, event.beta));
        const rawRoll = Math.max(-90, Math.min(90, event.gamma));

        setPitch(Number(rawPitch.toFixed(1)));
        setRoll(Number(rawRoll.toFixed(1)));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [isLocked]);

  // Valeurs nettes après calibration
  const netPitch = Number((pitch - calibratedPitch).toFixed(1));
  const netRoll = Number((roll - calibratedRoll).toFixed(1));

  // Vérification de la planéité parfaite (±0.5°)
  const isPerfectLevel = Math.abs(netPitch) <= 0.5 && Math.abs(netRoll) <= 0.5;

  // Feedback sonore et vibration quand le niveau est parfait
  useEffect(() => {
    if (isPerfectLevel) {
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate?.(30);
        } catch {
          // Ignorer
        }
      }

      if (soundEnabled) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // Note La (A5)
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        } catch {
          // Ignorer
        }
      }
    }
  }, [isPerfectLevel, soundEnabled]);

  // Calibrer (Tare) à la position courante
  const handleCalibrate = () => {
    setCalibratedPitch(pitch);
    setCalibratedRoll(roll);
  };

  // Réinitialiser la calibration d'usine
  const handleResetCalibration = () => {
    setCalibratedPitch(0);
    setCalibratedRoll(0);
  };

  // Conversion en pente (mm/m et %)
  // Pente (mm/m) = tan(angle en rad) * 1000
  const slopePitchMm = Math.round(Math.tan((netPitch * Math.PI) / 180) * 1000);
  const slopeRollMm = Math.round(Math.tan((netRoll * Math.PI) / 180) * 1000);

  // Position visuelle de la bulle dans l'œil de bœuf (-100px à +100px)
  // Max 45° pour atteindre le bord
  const bubbleX = Math.max(-100, Math.min(100, (netRoll / 45) * 100));
  const bubbleY = Math.max(-100, Math.min(100, (netPitch / 45) * 100));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-border bg-surface shadow-raised overflow-hidden">
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex size-11 items-center justify-center rounded-xl transition-all duration-300',
                  isPerfectLevel
                    ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20 shadow-lg'
                    : 'bg-primary/10 text-primary',
                )}
              >
                <CircleDot className="size-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Niveau à Bulle & Inclinomètre</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Niveau 2D œil-de-bœuf et tubulaire pour réglage de socles, platines, goulottes et tuyauteries.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                className="p-2 rounded-lg border border-border bg-surface-raised text-muted-foreground hover:text-foreground cursor-pointer"
                title={soundEnabled ? 'Désactiver le bip sonore' : 'Activer le bip sonore'}
              >
                {soundEnabled ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4" />}
              </button>

              <Button
                type="button"
                variant={isLocked ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setIsLocked((v) => !v)}
                className="gap-1.5 text-xs font-semibold"
              >
                {isLocked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                <span>{isLocked ? 'Angle figé' : 'Figer'}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Alerte demande de permission iOS */}
          {hasOrientationSensor === null && !permissionRequested && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-foreground">Accès aux capteurs d’inclinaison</p>
                <p className="text-muted-foreground">
                  Autorisez le gyroscope pour utiliser la détection de niveau automatique.
                </p>
              </div>
              <Button type="button" size="sm" onClick={requestOrientationPermission} className="text-xs shrink-0">
                Activer le niveau
              </Button>
            </div>
          )}

          {/* Niveau Circulaire 2D (Œil de bœuf) */}
          <div className="flex flex-col items-center justify-center py-4">
            <div
              className={cn(
                'relative size-64 sm:size-76 rounded-full border-4 shadow-2xl flex items-center justify-center transition-all duration-300',
                isPerfectLevel
                  ? 'border-emerald-500 bg-emerald-950/20 ring-8 ring-emerald-500/20 shadow-emerald-500/30'
                  : 'border-border bg-slate-950',
              )}
            >
              {/* Cercles de tolérance (0.5°, 5°, 15°, 30°) */}
              <div className="absolute size-52 rounded-full border border-slate-800" />
              <div className="absolute size-36 rounded-full border border-slate-800/80 border-dashed" />
              <div
                className={cn(
                  'absolute size-18 rounded-full border-2 transition-all duration-200',
                  isPerfectLevel
                    ? 'border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/40 animate-pulse'
                    : 'border-slate-700',
                )}
              />

              {/* Réticule de visée */}
              <div className="absolute h-full w-px bg-slate-800/80" />
              <div className="absolute w-full h-px bg-slate-800/80" />

              {/* Bulle mobile */}
              <div
                className={cn(
                  'absolute size-12 rounded-full transition-transform duration-75 ease-out flex items-center justify-center shadow-lg',
                  isPerfectLevel
                    ? 'bg-radial from-emerald-300 to-emerald-500 ring-4 ring-emerald-400/40 shadow-emerald-500/60'
                    : 'bg-radial from-amber-200 to-amber-500 ring-2 ring-amber-400/30 shadow-amber-500/40',
                )}
                style={{
                  transform: `translate(${bubbleX}px, ${bubbleY}px)`,
                }}
              >
                <div className="size-2 rounded-full bg-white/80 shadow-xs" />
              </div>
            </div>

            {/* Statut & Verdict */}
            <div className="mt-5 text-center space-y-1">
              <div
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-extrabold shadow-sm transition-all',
                  isPerfectLevel
                    ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20 animate-bounce'
                    : 'bg-surface-raised border border-border text-foreground',
                )}
              >
                {isPerfectLevel ? (
                  <>
                    <Check className="size-4 stroke-[3]" />
                    <span>Niveau Parfait (0.0°)</span>
                  </>
                ) : (
                  <span>
                    X: {netRoll > 0 ? `+${netRoll}` : netRoll}° • Y:{' '}
                    {netPitch > 0 ? `+${netPitch}` : netPitch}°
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Niveaux Tubulaires Horizontaux & Verticaux */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Axe Horizontal (Roll / X) */}
            <div className="p-4 rounded-xl bg-surface-raised border border-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-foreground">
                  Axe Horizontal (X - Roulis)
                </span>
                <span className="font-mono font-bold text-primary text-sm">
                  {netRoll > 0 ? `+${netRoll}` : netRoll}° ({slopeRollMm} mm/m)
                </span>
              </div>

              {/* Tube de niveau horizontal */}
              <div className="relative w-full h-8 bg-slate-950 rounded-full border border-slate-700 overflow-hidden flex items-center justify-center">
                <div className="absolute left-1/2 -translate-x-1/2 w-8 h-full border-x-2 border-slate-600 pointer-events-none" />
                <div
                  className={cn(
                    'absolute size-6 rounded-full transition-transform duration-75 ease-out shadow-md',
                    Math.abs(netRoll) <= 0.5
                      ? 'bg-radial from-emerald-300 to-emerald-500 shadow-emerald-500/50'
                      : 'bg-radial from-amber-200 to-amber-500 shadow-amber-500/40',
                  )}
                  style={{
                    transform: `translateX(${Math.max(-120, Math.min(120, (netRoll / 45) * 120))}px)`,
                  }}
                />
              </div>
            </div>

            {/* Axe Vertical (Pitch / Y) */}
            <div className="p-4 rounded-xl bg-surface-raised border border-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-foreground">
                  Axe Vertical (Y - Tangage)
                </span>
                <span className="font-mono font-bold text-primary text-sm">
                  {netPitch > 0 ? `+${netPitch}` : netPitch}° ({slopePitchMm} mm/m)
                </span>
              </div>

              {/* Tube de niveau vertical horizontalisé */}
              <div className="relative w-full h-8 bg-slate-950 rounded-full border border-slate-700 overflow-hidden flex items-center justify-center">
                <div className="absolute left-1/2 -translate-x-1/2 w-8 h-full border-x-2 border-slate-600 pointer-events-none" />
                <div
                  className={cn(
                    'absolute size-6 rounded-full transition-transform duration-75 ease-out shadow-md',
                    Math.abs(netPitch) <= 0.5
                      ? 'bg-radial from-emerald-300 to-emerald-500 shadow-emerald-500/50'
                      : 'bg-radial from-amber-200 to-amber-500 shadow-amber-500/40',
                  )}
                  style={{
                    transform: `translateX(${Math.max(-120, Math.min(120, (netPitch / 45) * 120))}px)`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Simulateur / Sliders si aucun capteur (Mode Bureau) */}
          {hasOrientationSensor === false && (
            <div className="p-4 rounded-xl bg-surface-raised border border-border space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Simulateur d’inclinaison (mode bureau sans capteur) :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Axe X (Roulis)</span>
                    <span className="font-mono font-bold">{roll}°</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="0.5"
                    value={roll}
                    onChange={(e) => setRoll(Number(e.target.value))}
                    aria-label="Inclinaison Axe X"
                    className="w-full accent-primary h-2 bg-surface rounded-lg cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Axe Y (Tangage)</span>
                    <span className="font-mono font-bold">{pitch}°</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="0.5"
                    value={pitch}
                    onChange={(e) => setPitch(Number(e.target.value))}
                    aria-label="Inclinaison Axe Y"
                    className="w-full accent-primary h-2 bg-surface rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Barre de Calibration & Tare */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/70">
            <div className="text-xs text-muted-foreground">
              {calibratedPitch !== 0 || calibratedRoll !== 0 ? (
                <span className="text-amber-500 font-semibold">
                  ⚠️ Calibration relative active (Offset X: {calibratedRoll}°, Y: {calibratedPitch}°)
                </span>
              ) : (
                <span>Référence zéro d’usine absolue.</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {(calibratedPitch !== 0 || calibratedRoll !== 0) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetCalibration}
                  className="gap-1 text-xs"
                >
                  <RotateCcw className="size-3" />
                  Réinitialiser zéro
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCalibrate}
                className="gap-1.5 text-xs font-semibold"
              >
                <Activity className="size-3.5 text-primary" />
                <span>Calibrer Zéro (Tare)</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
