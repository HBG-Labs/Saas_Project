import {
  AlertTriangle,
  Flame,
  Flashlight,
  Moon,
  Power,
  Sun,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

type LightColor = 'white' | 'warm' | 'red' | 'amber';
type FlashMode = 'steady' | 'strobe' | 'sos';

function applyTorchConstraint(track: MediaStreamTrack, enabled: boolean): Promise<void> {
  const torchConstraint = { torch: enabled } as MediaTrackConstraintSet;
  return track.applyConstraints({ advanced: [torchConstraint] });
}

const COLOR_CONFIGS: Record<
  LightColor,
  { label: string; bgClass: string; hex: string; desc: string }
> = {
  white: {
    label: 'Blanc Pur (6500K)',
    bgClass: 'bg-white text-slate-900',
    hex: '#ffffff',
    desc: 'Luminosité maximale pour inspection générale et tableaux électriques.',
  },
  warm: {
    label: 'Blanc Chaud (3000K)',
    bgClass: 'bg-warning text-warning',
    hex: '#fef3c7',
    desc: 'Éclairage doux et reposant pour lecture de plans et schémas.',
  },
  red: {
    label: 'Rouge Vision Nocturne',
    bgClass: 'bg-error text-white',
    hex: '#dc2626',
    desc: 'Préserve l’adaptation de l’œil à l’obscurité en intervention de nuit.',
  },
  amber: {
    label: 'Ambre Sécurité',
    bgClass: 'bg-warning text-foreground',
    hex: '#f59e0b',
    desc: 'Signalisation de sécurité haute visibilité pour balisage de zone.',
  },
};

export default function FlashlightTool() {
  const [isOn, setIsOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean | null>(null);
  const [torchActive, setTorchActive] = useState(false);
  const [selectedColor, setSelectedColor] = useState<LightColor>('white');
  const [flashMode, setFlashMode] = useState<FlashMode>('steady');
  const [brightness, setBrightness] = useState(100);
  const [fullScreenActive, setFullScreenActive] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const strobeTimerRef = useRef<number | null>(null);
  const [strobeState, setStrobeState] = useState(true);

  // Demande de WakeLock pour empêcher la mise en veille de l'écran
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Ignorer si non supporté ou refusé
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      // Ignorer
    }
  }, []);

  // Détection et basculement de la torche physique du téléphone
  const togglePhysicalTorch = useCallback(async (enable: boolean) => {
    try {
      if (enable) {
        if (!mediaStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          mediaStreamRef.current = stream;
          const track = stream.getVideoTracks()[0] ?? null;
          videoTrackRef.current = track;

          // Vérifier si la torche est supportée
          if (track) {
            const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
            if (capabilities && 'torch' in capabilities) {
              setHasTorchSupport(true);
              await applyTorchConstraint(track, true);
              setTorchActive(true);
            } else {
              setHasTorchSupport(false);
              setTorchActive(false);
            }
          }
        } else if (videoTrackRef.current) {
          await applyTorchConstraint(videoTrackRef.current, true);
          setTorchActive(true);
        }
      } else {
        if (videoTrackRef.current) {
          try {
            await applyTorchConstraint(videoTrackRef.current, false);
          } catch {
            // Ignorer
          }
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
          videoTrackRef.current = null;
        }
        setTorchActive(false);
      }
    } catch (err) {
      console.warn('Torche physique inaccessible ou non supportée:', err);
      setHasTorchSupport(false);
      setTorchActive(false);
    }
  }, []);

  // Gestion de l'allumage / extinction
  const handleToggle = useCallback(
    async (newState?: boolean) => {
      const target = newState !== undefined ? newState : !isOn;
      setIsOn(target);

      if (target) {
        await requestWakeLock();
        // Essayer d'allumer la torche physique
        await togglePhysicalTorch(true);
      } else {
        await releaseWakeLock();
        await togglePhysicalTorch(false);
        setFullScreenActive(false);
      }
    },
    [isOn, requestWakeLock, releaseWakeLock, togglePhysicalTorch],
  );

  // Gestion du stroboscope & SOS
  useEffect(() => {
    if (!isOn || flashMode === 'steady') {
      if (strobeTimerRef.current) {
        clearInterval(strobeTimerRef.current);
        strobeTimerRef.current = null;
      }
      return undefined;
    }

    if (flashMode === 'strobe') {
      const interval = window.setInterval(() => {
        setStrobeState((prev) => !prev);
      }, 100);
      strobeTimerRef.current = interval;
      return () => clearInterval(interval);
    }

    if (flashMode === 'sos') {
      // S: 3 courts, O: 3 longs, S: 3 courts
      const pattern = [
        1, 0, 1, 0, 1, 0, // S
        0, 0,
        1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, // O
        0, 0,
        1, 0, 1, 0, 1, 0, // S
        0, 0, 0, 0, // Pause
      ];
      let step = 0;
      const interval = window.setInterval(() => {
        setStrobeState(pattern[step] === 1);
        step = (step + 1) % pattern.length;
      }, 150);
      strobeTimerRef.current = interval;
      return () => clearInterval(interval);
    }

    return undefined;
  }, [isOn, flashMode]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (strobeTimerRef.current) clearInterval(strobeTimerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  const colorConfig = COLOR_CONFIGS[selectedColor];
  const isLightEmitting = isOn && (flashMode === 'steady' || strobeState);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Mode Plein Écran Lampe Torche */}
      {fullScreenActive && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Plein écran torche"
          className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 transition-colors duration-150"
          style={{
            backgroundColor: isLightEmitting ? colorConfig.hex : '#000000',
            opacity: isLightEmitting ? brightness / 100 : 1,
          }}
        >
          <button
            type="button"
            aria-label="Quitter le plein écran torche"
            className="absolute inset-0 cursor-default"
            onClick={() => setFullScreenActive(false)}
          />

          <div className="relative z-10 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs font-semibold shadow-lg">
            Touchez l’écran pour quitter le plein écran
          </div>

          <div className="relative z-10 text-center bg-black/50 backdrop-blur-md px-6 py-4 rounded-2xl text-white shadow-xl space-y-1">
            <p className="text-sm font-bold uppercase tracking-wider">{colorConfig.label}</p>
            <p className="text-xs opacity-80">
              {flashMode === 'steady'
                ? 'Lumière continue'
                : flashMode === 'strobe'
                  ? 'Stroboscope actif'
                  : 'Signal de détresse SOS'}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              void handleToggle(false);
            }}
            className="relative z-10 bg-black/80 text-white border-white/20 hover:bg-black"
          >
            Éteindre la lampe
          </Button>
        </div>
      )}

      {/* Carte Principale de Contrôle */}
      <Card className="border-border bg-surface shadow-2xs overflow-hidden min-w-0">
        <CardHeader className="border-b border-border/70 p-3.5 sm:p-4 pb-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300',
                  isOn
                    ? 'bg-warning text-foreground shadow-md ring-2 ring-warning/20'
                    : 'bg-surface-hover text-muted-foreground',
                )}
              >
                <Flashlight className={cn('size-5', isOn && 'animate-pulse')} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base font-bold truncate">Lampe Torche & Balisage</CardTitle>
                <p className="text-3xs sm:text-xs text-muted-foreground line-clamp-1">
                  Éclairage d’appoint haute puissance pour inspection et chantiers sombres.
                </p>
              </div>
            </div>

            {hasTorchSupport === true && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20 self-start sm:self-auto shrink-0">
                <Zap className="size-3" />
                Torche LED active
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden">
          {/* Grand Interrupteur Central */}
          <div className="flex flex-col items-center justify-center py-4">
            <button
              type="button"
              onClick={() => handleToggle()}
              aria-pressed={isOn}
              className={cn(
                'relative flex size-36 sm:size-44 items-center justify-center rounded-full transition-all duration-300 cursor-pointer',
                'border-4 shadow-xl active:scale-95 select-none',
                isOn
                  ? 'border-warning bg-linear-to-b from-warning to-warning text-foreground shadow-warning/40 ring-8 ring-warning/20'
                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground hover:border-primary/50 shadow-inner',
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <Power className={cn('size-12 sm:size-14 transition-transform duration-300', isOn && 'scale-110')} />
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">
                  {isOn ? 'Allumée' : 'Éteinte'}
                </span>
              </div>
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!isOn) void handleToggle(true);
                  setFullScreenActive(true);
                }}
                className="gap-2 text-xs"
              >
                <Sun className="size-4 text-warning" />
                <span>Plein écran projecteur</span>
              </Button>

              {torchActive && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void togglePhysicalTorch(false)}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Zap className="size-3.5 text-warning" />
                  <span>Désactiver LED</span>
                </Button>
              )}
            </div>
          </div>

          {/* Sélecteur de Teinte / Température de Couleur */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Moon className="size-3.5 text-primary" />
              <span>Température & Mode Couleur</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(Object.keys(COLOR_CONFIGS) as LightColor[]).map((colorKey) => {
                const config = COLOR_CONFIGS[colorKey];
                const isSelected = selectedColor === colorKey;
                return (
                  <button
                    key={colorKey}
                    type="button"
                    onClick={() => setSelectedColor(colorKey)}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                        : 'border-border bg-surface-raised hover:border-primary/40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="size-5 rounded-full border border-border/80 shadow-xs"
                        style={{ backgroundColor: config.hex }}
                      />
                      {isSelected && <span className="text-2xs font-bold text-primary">Actif</span>}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground line-clamp-1">{config.label}</p>
                      <p className="text-3xs text-muted-foreground line-clamp-2 mt-0.5">{config.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode de Diffusion (Fixe / Stroboscope / SOS) */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Flame className="size-3.5 text-primary" />
              <span>Mode de Clignotement & Signalisation</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFlashMode('steady')}
                className={cn(
                  'p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer',
                  flashMode === 'steady'
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground',
                )}
              >
                Continu
              </button>
              <button
                type="button"
                onClick={() => setFlashMode('strobe')}
                className={cn(
                  'p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer',
                  flashMode === 'strobe'
                    ? 'border-warning bg-warning text-foreground shadow-xs'
                    : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground',
                )}
              >
                Stroboscope
              </button>
              <button
                type="button"
                onClick={() => setFlashMode('sos')}
                className={cn(
                  'p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5',
                  flashMode === 'sos'
                    ? 'border-error bg-error text-white shadow-xs'
                    : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground',
                )}
              >
                <AlertTriangle className="size-3.5" />
                <span>S.O.S (Morse)</span>
              </button>
            </div>
          </div>

          {/* Slider d'Intensité / Luminosité d'Écran */}
          <div className="space-y-2 pt-2 border-t border-border/70">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Intensité du projecteur d’écran</span>
              <span className="font-mono font-bold text-primary">{brightness}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              aria-label="Intensité du projecteur d'écran"
              className="w-full accent-primary h-2 bg-surface-raised rounded-lg cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
