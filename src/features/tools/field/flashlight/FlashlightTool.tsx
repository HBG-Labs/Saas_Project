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
    bgClass: 'bg-amber-100 text-amber-950',
    hex: '#fef3c7',
    desc: 'Éclairage doux et reposant pour lecture de plans et schémas.',
  },
  red: {
    label: 'Rouge Vision Nocturne',
    bgClass: 'bg-red-600 text-white',
    hex: '#dc2626',
    desc: 'Préserve l’adaptation de l’œil à l’obscurité en intervention de nuit.',
  },
  amber: {
    label: 'Ambre Sécurité',
    bgClass: 'bg-amber-500 text-slate-950',
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
              await (track as any).applyConstraints({
                advanced: [{ torch: true }],
              });
              setTorchActive(true);
            } else {
              setHasTorchSupport(false);
              setTorchActive(false);
            }
          }
        } else if (videoTrackRef.current) {
          await (videoTrackRef.current as any).applyConstraints({
            advanced: [{ torch: true }],
          });
          setTorchActive(true);
        }
      } else {
        if (videoTrackRef.current) {
          try {
            await (videoTrackRef.current as any).applyConstraints({
              advanced: [{ torch: false }],
            });
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
      setStrobeState(true);
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
  const isLightEmitting = isOn && strobeState;

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
          onClick={() => setFullScreenActive(false)}
        >
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs font-semibold shadow-lg">
            Touchez l’écran pour quitter le plein écran
          </div>

          <div className="text-center bg-black/50 backdrop-blur-md px-6 py-4 rounded-2xl text-white shadow-xl space-y-1">
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
              handleToggle(false);
            }}
            className="bg-black/80 text-white border-white/20 hover:bg-black"
          >
            Éteindre la lampe
          </Button>
        </div>
      )}

      {/* Carte Principale de Contrôle */}
      <Card className="border-border bg-surface shadow-raised overflow-hidden">
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex size-11 items-center justify-center rounded-xl transition-all duration-300',
                  isOn
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-4 ring-amber-500/20'
                    : 'bg-surface-hover text-muted-foreground',
                )}
              >
                <Flashlight className={cn('size-6', isOn && 'animate-pulse')} />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Lampe Torche & Balisage</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Éclairage d’appoint haute puissance pour inspection et chantiers sombres.
                </p>
              </div>
            </div>

            {hasTorchSupport === true && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Zap className="size-3" />
                Torche LED active
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
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
                  ? 'border-amber-400 bg-linear-to-b from-amber-400 to-amber-500 text-slate-950 shadow-amber-500/40 ring-8 ring-amber-400/20'
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
                  if (!isOn) handleToggle(true);
                  setFullScreenActive(true);
                }}
                className="gap-2 text-xs"
              >
                <Sun className="size-4 text-amber-500" />
                <span>Plein écran projecteur</span>
              </Button>

              {torchActive && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => togglePhysicalTorch(false)}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Zap className="size-3.5 text-amber-500" />
                  <span>Désactiver LED</span>
                </Button>
              )}
            </div>
          </div>

          {/* Sélecteur de Teinte / Température de Couleur */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Moon className="size-3.5 text-primary" />
              <span>Température & Mode Couleur</span>
            </label>
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
            <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Flame className="size-3.5 text-primary" />
              <span>Mode de Clignotement & Signalisation</span>
            </label>
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
                    ? 'border-amber-500 bg-amber-500 text-slate-950 shadow-xs'
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
                    ? 'border-red-500 bg-red-600 text-white shadow-xs'
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
