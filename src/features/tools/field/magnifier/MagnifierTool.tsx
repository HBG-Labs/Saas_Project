import {
  Camera,
  Download,
  Flashlight,
  Grid,
  RefreshCw,
  Sliders,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

type FilterMode = 'normal' | 'high-contrast' | 'invert' | 'grayscale' | 'sepia';

const FILTER_STYLES: Record<FilterMode, { label: string; filter: string; desc: string }> = {
  normal: { label: 'Normal', filter: 'none', desc: 'Rendu naturel de la caméra.' },
  'high-contrast': {
    label: 'Contraste Élevé',
    filter: 'contrast(180%) brightness(110%)',
    desc: 'Idéal pour lire les étiquettes effacées et gravures.',
  },
  invert: {
    label: 'Négatif / Inversé',
    filter: 'invert(100%) contrast(150%)',
    desc: 'Fait ressortir les numéros de série et circuits imprimés.',
  },
  grayscale: {
    label: 'Niveaux de Gris',
    filter: 'grayscale(100%) contrast(140%)',
    desc: 'Réduit les reflets de lumière sur le métal.',
  },
  sepia: {
    label: 'Filtre Chaud',
    filter: 'sepia(80%) contrast(120%)',
    desc: 'Améliore la lisibilité sous éclairage fluorescent.',
  },
};

export default function MagnifierTool() {
  const [streamActive, setStreamActive] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(2);
  const [filterMode, setFilterMode] = useState<FilterMode>('normal');
  const [showGrid, setShowGrid] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [frozenImage, setFrozenImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  // Initialisation du flux caméra arrière
  const startCamera = useCallback(async () => {
    try {
      setStreamError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0] ?? null;
      trackRef.current = track;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setStreamActive(true);
    } catch (err: any) {
      console.warn('Erreur accès caméra loupe:', err);
      setStreamError(
        err.name === 'NotAllowedError'
          ? 'Autorisation d’accès à la caméra refusée. Veuillez autoriser l’appareil photo dans votre navigateur.'
          : 'Impossible d’accéder à la caméra arrière de l’appareil.',
      );
      setStreamActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      trackRef.current = null;
    }
    setStreamActive(false);
    setIsTorchOn(false);
  }, []);

  // Gestion du zoom (matériel si supporté, complété par zoom CSS fluide)
  const handleZoomChange = useCallback(async (newZoom: number) => {
    const clamped = Math.max(1, Math.min(12, Number(newZoom.toFixed(1))));
    setZoomLevel(clamped);

    if (trackRef.current) {
      try {
        const capabilities = trackRef.current.getCapabilities?.() as { zoom?: { max: number } } | undefined;
        if (capabilities?.zoom) {
          const hwZoom = Math.min(clamped, capabilities.zoom.max);
          await (trackRef.current as any).applyConstraints({
            advanced: [{ zoom: hwZoom }],
          });
        }
      } catch {
        // Fallback sur zoom CSS
      }
    }
  }, []);

  // Gestion de la torche intégrée
  const toggleTorch = useCallback(async () => {
    if (!trackRef.current) return;
    try {
      const nextTorch = !isTorchOn;
      await (trackRef.current as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torche non supportée sur ce capteur:', err);
    }
  }, [isTorchOn]);

  // Figer l'image (Snapshot / Freeze frame)
  const toggleFreeze = useCallback(() => {
    if (frozenImage) {
      setFrozenImage(null);
      return;
    }

    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Appliquer le filtre sur le snapshot
    if (filterMode !== 'normal') {
      ctx.filter = FILTER_STYLES[filterMode].filter;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setFrozenImage(dataUrl);
  }, [frozenImage, filterMode]);

  // Télécharger le snapshot
  const downloadSnapshot = useCallback(() => {
    if (!frozenImage) return;
    const a = document.createElement('a');
    a.href = frozenImage;
    a.download = `loupe-rezo360-${Date.now()}.jpg`;
    a.click();
  }, [frozenImage]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const currentFilter = FILTER_STYLES[filterMode];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-border bg-surface shadow-raised overflow-hidden">
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ZoomIn className="size-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Loupe d'Inspection Haute Définition</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Agrandissement haute netteté, filtres de contraste et capture de micro-détails.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={isTorchOn ? 'primary' : 'outline'}
                size="sm"
                onClick={toggleTorch}
                disabled={!streamActive}
                className="gap-1.5 text-xs font-semibold"
                title="Éclairer avec la torche"
              >
                <Flashlight className="size-3.5" />
                <span className="hidden sm:inline">Torche</span>
              </Button>

              <Button
                type="button"
                variant={frozenImage ? 'primary' : 'outline'}
                size="sm"
                onClick={toggleFreeze}
                disabled={!streamActive && !frozenImage}
                className="gap-1.5 text-xs font-semibold"
              >
                <Camera className="size-3.5" />
                <span>{frozenImage ? 'Reprendre' : 'Figer l’image'}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          {/* Écran de Visualisation de la Caméra / Loupe */}
          <div className="relative w-full aspect-4/3 sm:aspect-16/9 bg-slate-950 rounded-2xl overflow-hidden border border-border shadow-inner flex items-center justify-center">
            {streamError ? (
              <div className="p-6 text-center text-white space-y-3">
                <p className="text-sm font-bold text-amber-400">Accès caméra requis</p>
                <p className="text-xs text-slate-300 max-w-md mx-auto">{streamError}</p>
                <Button type="button" size="sm" onClick={startCamera} className="gap-1.5 text-xs">
                  <RefreshCw className="size-3.5" />
                  Réessayer
                </Button>
              </div>
            ) : frozenImage ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <img
                  src={frozenImage}
                  alt="Image figée de la loupe"
                  className="w-full h-full object-contain"
                  style={{
                    transform: `scale(${zoomLevel > 2 ? 1 + (zoomLevel - 2) * 0.15 : 1})`,
                    filter: currentFilter.filter,
                  }}
                />
                <div className="absolute top-3 left-3 bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-2xs font-extrabold uppercase tracking-wider shadow-md">
                  Image Figée
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={downloadSnapshot}
                    className="bg-black/70 text-white border-white/20 hover:bg-black gap-1.5 text-xs"
                  >
                    <Download className="size-3.5" />
                    <span>Enregistrer</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover transition-transform duration-100"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    filter: currentFilter.filter,
                  }}
                />

                {/* Réticule et grille optionnelle */}
                {showGrid && (
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/30">
                    <div className="border-r border-b border-white/20" />
                    <div className="border-r border-b border-white/20" />
                    <div className="border-b border-white/20" />
                    <div className="border-r border-b border-white/20" />
                    <div className="border-r border-b border-white/20 flex items-center justify-center">
                      <div className="size-8 rounded-full border border-amber-400/80 border-dashed animate-pulse" />
                    </div>
                    <div className="border-b border-white/20" />
                    <div className="border-r border-white/20" />
                    <div className="border-r border-white/20" />
                    <div />
                  </div>
                )}

                {/* Badge Zoom Actif */}
                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-lg text-white font-mono text-xs font-bold border border-white/10">
                  {zoomLevel.toFixed(1)}x
                </div>

                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGrid((v) => !v)}
                    className={cn(
                      'p-2 rounded-lg text-xs font-semibold backdrop-blur-md transition-all cursor-pointer border',
                      showGrid
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-black/60 text-white border-white/20 hover:bg-black/80',
                    )}
                    title="Afficher la grille de visée"
                  >
                    <Grid className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Barre de Contrôle du Zoom */}
          <div className="space-y-3 p-4 rounded-xl bg-surface-raised border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ZoomIn className="size-4 text-primary" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Facteur d’Agrandissement : {zoomLevel.toFixed(1)}x
                </span>
              </div>

              {/* Paliers Rapides */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 4, 8, 12].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleZoomChange(preset)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-pointer',
                      Math.abs(zoomLevel - preset) < 0.2
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-surface border border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {preset}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleZoomChange(zoomLevel - 0.5)}
                className="p-2 rounded-lg bg-surface border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                title="Dézoomer"
              >
                <ZoomOut className="size-4" />
              </button>

              <input
                type="range"
                min="1"
                max="12"
                step="0.2"
                value={zoomLevel}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                aria-label="Niveau de zoom"
                className="w-full accent-primary h-2 bg-surface rounded-lg cursor-pointer"
              />

              <button
                type="button"
                onClick={() => handleZoomChange(zoomLevel + 0.5)}
                className="p-2 rounded-lg bg-surface border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                title="Zoomer"
              >
                <ZoomIn className="size-4" />
              </button>
            </div>
          </div>

          {/* Filtres de Netteté et Rendu */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Sliders className="size-3.5 text-primary" />
              <span>Filtres de Lecture & Contraste</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(Object.keys(FILTER_STYLES) as FilterMode[]).map((fKey) => {
                const config = FILTER_STYLES[fKey];
                const isSelected = filterMode === fKey;
                return (
                  <button
                    key={fKey}
                    type="button"
                    onClick={() => setFilterMode(fKey)}
                    className={cn(
                      'p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                        : 'border-border bg-surface-raised hover:border-primary/40',
                    )}
                  >
                    <span className="text-xs font-bold text-foreground">{config.label}</span>
                    <span className="text-3xs text-muted-foreground line-clamp-1">{config.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
