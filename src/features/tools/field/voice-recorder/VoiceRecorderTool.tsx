import {
  AlertCircle,
  Download,
  Info,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/features/auth';
import { useCurrentOrganization } from '@/features/organizations';
import { cn } from '@/lib/cn';
import {
  removeLegacyPrivateLocalStorage,
  voiceRecordingSessionKey,
} from '@/lib/private-session-storage';

interface AudioRecording {
  id: string;
  name: string;
  dataUrl: string;
  duration: number; // en secondes
  createdAt: string;
}

interface WebkitAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

function isAudioRecording(value: unknown): value is AudioRecording {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AudioRecording>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.dataUrl === 'string' &&
    typeof candidate.duration === 'number' &&
    typeof candidate.createdAt === 'string'
  );
}

function readStoredRecordings(storageKey: string | null): AudioRecording[] {
  if (storageKey === null) return [];
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter(isAudioRecording) : [];
  } catch {
    return [];
  }
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function VoiceRecorderSession({ storageKey }: { storageKey: string | null }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordings, setRecordings] = useState<AudioRecording[]>(() =>
    readStoredRecordings(storageKey),
  );
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Lecteur Audio
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Références MediaRecorder & Web Audio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const saveRecordings = (updated: AudioRecording[]) => {
    setRecordings(updated);
    if (storageKey === null) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erreur stockage de session du mémo vocal:', e);
    }
  };

  useEffect(() => {
    removeLegacyPrivateLocalStorage();
  }, []);

  // Visualiseur Canvas d'onde sonore en direct
  const drawWaveform = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!isRecording || isPaused) {
        // Ligne plate de repos
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        return;
      }

      animFrameRef.current = requestAnimationFrame(render);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f59e0b'; // Ambre dynamique
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i] ?? 128;
        const v = val / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    render();
  }, [isRecording, isPaused]);

  // Démarrer l'enregistrement
  const startRecording = async () => {
    setPermissionError(null);

    if (storageKey === null) {
      setPermissionError(
        'Une session et une entreprise actives sont nécessaires pour enregistrer un mémo.',
      );
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setPermissionError(
        'L’API audio/microphone n’est pas disponible dans ce navigateur ou requiert une connexion sécurisée (HTTPS).',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Web Audio Analyser pour l'onde (facultatif si non supporté)
      try {
        const AudioCtx = window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;
        }
      } catch (audioCtxErr) {
        console.warn('Analyser Web Audio non disponible:', audioCtxErr);
      }

      // Détection MIME Type compatible multi-plateformes (Android Chrome, iOS Safari, etc.)
      let recorderOptions: MediaRecorderOptions | undefined = undefined;
      let selectedMime = 'audio/webm';

      if (
        typeof MediaRecorder !== 'undefined' &&
        typeof MediaRecorder.isTypeSupported === 'function'
      ) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          selectedMime = 'audio/webm;codecs=opus';
          recorderOptions = { mimeType: selectedMime };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          selectedMime = 'audio/webm';
          recorderOptions = { mimeType: selectedMime };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          selectedMime = 'audio/mp4';
          recorderOptions = { mimeType: selectedMime };
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          selectedMime = 'audio/aac';
          recorderOptions = { mimeType: selectedMime };
        }
      }

      // Configuration MediaRecorder
      const mediaRecorder = recorderOptions
        ? new MediaRecorder(stream, recorderOptions)
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMime });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          const newRecording: AudioRecording = {
            id: `rec_${Date.now()}`,
            name: `Mémo Chantier ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
            dataUrl: base64Data,
            duration: recordDuration,
            createdAt: new Date().toISOString(),
          };
          setRecordings((current) => {
            const updated = [newRecording, ...current];
            try {
              sessionStorage.setItem(storageKey, JSON.stringify(updated));
            } catch (error) {
              console.warn('Erreur stockage de session du mémo vocal:', error);
            }
            return updated;
          });
        };
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setIsPaused(false);
      setRecordDuration(0);

      // Timer
      durationTimerRef.current = window.setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

      drawWaveform();
    } catch (err: unknown) {
      console.warn('Erreur accès micro dictaphone:', err);
      const errorName = err instanceof Error ? err.name : '';
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setPermissionError(
          'Autorisation refusée par votre navigateur. Vous devez autoriser le microphone dans les paramètres de votre navigateur pour enregistrer des mémos vocaux.',
        );
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setPermissionError('Aucun microphone physique détecté sur cet appareil.');
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        setPermissionError('Le microphone est déjà utilisé par une autre application.');
      } else {
        setPermissionError('Impossible d’accéder au microphone de l’appareil.');
      }
    }
  };

  // Mettre en pause / Reprendre
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      durationTimerRef.current = window.setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
      drawWaveform();
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
  };

  // Arrêter et sauvegarder l'enregistrement
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    setIsRecording(false);
    setIsPaused(false);
  };

  // Lecture d'un mémo
  const playRecording = (rec: AudioRecording) => {
    if (activePlayingId === rec.id) {
      if (audioPlayerRef.current) {
        if (audioPlayerRef.current.paused) {
          void audioPlayerRef.current.play();
        } else {
          audioPlayerRef.current.pause();
          setActivePlayingId(null);
        }
      }
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audio = new Audio(rec.dataUrl);
    audio.playbackRate = playbackSpeed;
    audioPlayerRef.current = audio;
    setActivePlayingId(rec.id);

    audio.onended = () => {
      setActivePlayingId(null);
    };

    audio.play().catch(() => {
      setActivePlayingId(null);
    });
  };

  // Changer vitesse de lecture
  const cyclePlaybackSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex] ?? 1;
    setPlaybackSpeed(nextSpeed);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = nextSpeed;
    }
  };

  // Supprimer un mémo
  const deleteRecording = (id: string) => {
    if (activePlayingId === id && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setActivePlayingId(null);
    }
    const updated = recordings.filter((r) => r.id !== id);
    saveRecordings(updated);
  };

  // Télécharger le fichier
  const downloadAudio = (rec: AudioRecording) => {
    const a = document.createElement('a');
    a.href = rec.dataUrl;
    a.download = `${rec.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`;
    a.click();
  };

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl min-w-0 space-y-4 sm:space-y-6">
      <Card className="border-border bg-surface min-w-0 overflow-hidden shadow-2xs">
        <CardHeader className="border-border/70 border-b p-3.5 pb-3.5 sm:p-4">
          <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300',
                  isRecording
                    ? 'bg-error ring-error/20 animate-pulse text-white shadow-md ring-2'
                    : 'bg-primary/10 text-primary',
                )}
              >
                <Mic className="size-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-sm font-bold sm:text-base">
                  Dictaphone & Mémos Vocaux
                </CardTitle>
                <p className="text-3xs text-muted-foreground line-clamp-1 sm:text-xs">
                  Enregistrement audio rapide pour rapports de visite, constats et notes de
                  chantier.
                </p>
              </div>
            </div>

            {recordings.length > 0 && (
              <span className="text-3xs bg-surface-raised border-border text-foreground inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border px-2.5 py-1 font-bold tracking-wider uppercase sm:self-auto">
                {recordings.length} mémo{recordings.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="min-w-0 space-y-4 overflow-x-hidden p-3 sm:space-y-6 sm:p-6">
          {permissionError && (
            <div className="bg-error/10 border-error/30 text-foreground space-y-3 rounded-xl border p-4 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="text-error mt-0.5 size-5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-error text-sm font-bold">Accès au microphone requis</p>
                  <p className="text-muted-foreground text-xs">{permissionError}</p>
                </div>
              </div>

              <div className="bg-surface-raised/90 border-border text-2xs space-y-2 rounded-lg border p-3">
                <p className="text-foreground flex items-center gap-1.5 font-semibold">
                  <Info className="text-primary size-3.5" />
                  Comment réactiver le micro sur votre téléphone :
                </p>
                <ul className="text-muted-foreground list-disc space-y-1.5 pl-4">
                  <li>
                    <strong className="text-foreground">Sur Android (Chrome / Navigateur) :</strong>{' '}
                    Touchez l'icône du cadenas{' '}
                    <span className="bg-surface-subtle rounded px-1 font-mono">🔒</span> ou réglages
                    tout en haut à gauche dans la barre d'adresse &gt;{' '}
                    <strong className="text-foreground">Autorisations</strong> &gt; Activez{' '}
                    <strong className="text-foreground">Microphone</strong> &gt; Rafraîchissez la
                    page.
                  </li>
                  <li>
                    <strong className="text-foreground">Sur iPhone (Safari / Chrome) :</strong>{' '}
                    Touchez <strong className="text-foreground">aA</strong> dans la barre d'adresse
                    &gt; <strong className="text-foreground">Réglages du site</strong> &gt;{' '}
                    <strong className="text-foreground">Microphone</strong> &gt;{' '}
                    <strong className="text-foreground">Autoriser</strong>.
                  </li>
                  <li>
                    <strong className="text-foreground">Paramètres système Android :</strong> Ouvrez{' '}
                    <em>Paramètres &gt; Applications &gt; Chrome &gt; Autorisations</em> et
                    autorisez le <strong>Microphone</strong>.
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={startRecording}
                  className="bg-error hover:bg-error cursor-pointer gap-1.5 text-xs text-white shadow-sm"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Réessayer l'autorisation</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPermissionError(null)}
                  className="cursor-pointer text-xs"
                >
                  Fermer
                </Button>
              </div>
            </div>
          )}

          {/* Zone d'Enregistrement & Visualiseur d'Onde */}
          <div className="bg-surface-sunken border-border flex flex-col items-center justify-center space-y-4 rounded-2xl border p-6 shadow-inner">
            {/* Visualiseur Canvas */}
            <canvas
              ref={canvasRef}
              width={600}
              height={100}
              className="border-border bg-surface-sunken/60 h-24 w-full rounded-xl border"
            />

            {/* Durée de l'enregistrement */}
            <div className="font-mono text-4xl font-black tracking-tight text-white sm:text-5xl">
              {formatDuration(recordDuration)}
            </div>

            {/* Contrôles d'enregistrement */}
            <div className="flex items-center gap-3 pt-2">
              {!isRecording ? (
                <Button
                  type="button"
                  size="lg"
                  variant="primary"
                  onClick={startRecording}
                  className="bg-error hover:bg-error shadow-error/30 h-12 cursor-pointer gap-2 px-6 text-sm font-bold text-white shadow-lg"
                >
                  <Mic className="size-5" />
                  <span>Démarrer l’enregistrement</span>
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={togglePause}
                    className="bg-surface-sunken border-border hover:bg-surface-sunken h-12 cursor-pointer gap-1.5 px-5 text-xs font-semibold text-white"
                  >
                    {isPaused ? (
                      <Play className="size-4 fill-current" />
                    ) : (
                      <Pause className="size-4" />
                    )}
                    <span>{isPaused ? 'Reprendre' : 'Pause'}</span>
                  </Button>

                  <Button
                    type="button"
                    size="lg"
                    variant="primary"
                    onClick={stopRecording}
                    className="bg-success hover:bg-success h-12 cursor-pointer gap-2 px-6 text-sm font-bold text-white shadow-md"
                  >
                    <Square className="size-4 fill-current" />
                    <span>Sauvegarder le mémo</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Liste des Mémos Vocaux Enregistrés */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-xs font-bold tracking-wider uppercase">
                Mémos vocaux enregistrés ({recordings.length})
              </span>
              {recordings.length > 0 && (
                <button
                  type="button"
                  onClick={cyclePlaybackSpeed}
                  className="text-primary cursor-pointer font-mono text-xs font-bold hover:underline"
                >
                  Vitesse : {playbackSpeed}x
                </button>
              )}
            </div>

            {recordings.length === 0 ? (
              <p className="text-muted-foreground border-border rounded-xl border border-dashed py-6 text-center text-xs">
                Aucun mémo vocal enregistré. Cliquez sur « Démarrer l’enregistrement » pour créer
                votre première note audio.
              </p>
            ) : (
              <div className="divide-border border-border bg-surface-raised max-h-80 divide-y overflow-hidden overflow-y-auto rounded-xl border">
                {recordings.map((rec) => {
                  const isPlaying = activePlayingId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      className={cn(
                        'flex flex-col justify-between gap-3 p-3.5 transition-colors sm:flex-row sm:items-center',
                        isPlaying && 'bg-primary/5',
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => playRecording(rec)}
                          className={cn(
                            'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-xs transition-all',
                            isPlaying
                              ? 'bg-primary text-primary-foreground ring-primary/20 scale-105 ring-4'
                              : 'bg-surface border-border text-foreground hover:border-primary border',
                          )}
                          title={isPlaying ? 'Pause' : 'Écouter'}
                        >
                          {isPlaying ? (
                            <Pause className="size-4" />
                          ) : (
                            <Play className="ml-0.5 size-4 fill-current" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="text-foreground truncate text-xs font-bold">{rec.name}</p>
                          <div className="text-3xs text-muted-foreground mt-0.5 flex items-center gap-3">
                            <span className="text-primary font-mono font-semibold">
                              {formatDuration(rec.duration)}
                            </span>
                            <span>•</span>
                            <span>{new Date(rec.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => downloadAudio(rec)}
                          className="text-3xs h-8 gap-1 px-2.5"
                          title="Télécharger l'enregistrement audio"
                        >
                          <Download className="size-3" />
                          <span className="hidden sm:inline">Audio</span>
                        </Button>

                        <button
                          type="button"
                          onClick={() => deleteRecording(rec.id)}
                          className="text-muted-foreground hover:text-error hover:bg-error/10 cursor-pointer rounded-lg p-2 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VoiceRecorderTool() {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const storageKey =
    user && organization ? voiceRecordingSessionKey(user.id, organization.id) : null;

  // Une frontière de session/tenant remonte un composant neuf : aucun état
  // audio, lecteur ou mémo de l'identité précédente ne peut survivre.
  return <VoiceRecorderSession key={storageKey ?? 'no-session'} storageKey={storageKey} />;
}
