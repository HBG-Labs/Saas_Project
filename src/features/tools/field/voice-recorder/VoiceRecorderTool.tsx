import {
  Download,
  Mic,
  Pause,
  Play,
  Square,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

interface AudioRecording {
  id: string;
  name: string;
  dataUrl: string;
  duration: number; // en secondes
  createdAt: string;
}

const STORAGE_KEY = 'rezo360_field_voice_recordings';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function VoiceRecorderTool() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordings, setRecordings] = useState<AudioRecording[]>([]);
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

  // Charger les enregistrements locaux
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setRecordings(JSON.parse(saved));
      }
    } catch {
      // Ignorer
    }
  }, []);

  const saveRecordings = (updated: AudioRecording[]) => {
    setRecordings(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erreur stockage local mémo vocal:', e);
    }
  };

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Web Audio Analyser pour l'onde
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Configuration MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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
          saveRecordings([newRecording, ...recordings]);
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
    } catch (err: any) {
      console.warn('Erreur accès micro dictaphone:', err);
      setPermissionError(
        err.name === 'NotAllowedError'
          ? 'Autorisation micro refusée. Veuillez autoriser le microphone dans votre navigateur.'
          : 'Impossible d’accéder au microphone de l’appareil.',
      );
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
          audioPlayerRef.current.play();
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-border bg-surface shadow-raised overflow-hidden">
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex size-11 items-center justify-center rounded-xl transition-all duration-300',
                  isRecording
                    ? 'bg-red-600 text-white ring-4 ring-red-500/20 animate-pulse'
                    : 'bg-primary/10 text-primary',
                )}
              >
                <Mic className="size-6" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Dictaphone & Mémos Vocaux de Chantier</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Enregistrez rapidement vos comptes-rendus oraux, constats et notes vocales sur le terrain.
                </p>
              </div>
            </div>

            {isRecording && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-600/10 text-red-600 dark:text-red-400 border border-red-600/20 animate-pulse">
                <span className="size-2 rounded-full bg-red-600" />
                {isPaused ? 'En pause' : 'Enregistrement'}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {permissionError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
              <p className="font-bold">Accès au microphone requis</p>
              <p className="mt-0.5">{permissionError}</p>
            </div>
          )}

          {/* Zone d'Enregistrement & Visualiseur d'Onde */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
            {/* Visualiseur Canvas */}
            <canvas
              ref={canvasRef}
              width={600}
              height={100}
              className="w-full h-24 rounded-xl border border-slate-800 bg-slate-900/60"
            />

            {/* Durée de l'enregistrement */}
            <div className="font-mono text-4xl sm:text-5xl font-black text-white tracking-tight">
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
                  className="h-12 px-6 text-sm font-bold gap-2 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 cursor-pointer"
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
                    className="h-12 px-5 text-xs font-semibold gap-1.5 bg-slate-900 text-white border-slate-700 hover:bg-slate-800 cursor-pointer"
                  >
                    {isPaused ? <Play className="size-4 fill-current" /> : <Pause className="size-4" />}
                    <span>{isPaused ? 'Reprendre' : 'Pause'}</span>
                  </Button>

                  <Button
                    type="button"
                    size="lg"
                    variant="primary"
                    onClick={stopRecording}
                    className="h-12 px-6 text-sm font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer"
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
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Mémos vocaux enregistrés ({recordings.length})
              </span>
              {recordings.length > 0 && (
                <button
                  type="button"
                  onClick={cyclePlaybackSpeed}
                  className="text-xs font-mono font-bold text-primary hover:underline cursor-pointer"
                >
                  Vitesse : {playbackSpeed}x
                </button>
              )}
            </div>

            {recordings.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
                Aucun mémo vocal enregistré. Cliquez sur « Démarrer l’enregistrement » pour créer votre première note audio.
              </p>
            ) : (
              <div className="divide-y divide-border border border-border rounded-xl bg-surface-raised overflow-hidden max-h-80 overflow-y-auto">
                {recordings.map((rec) => {
                  const isPlaying = activePlayingId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      className={cn(
                        'flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 transition-colors',
                        isPlaying && 'bg-primary/5',
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => playRecording(rec)}
                          className={cn(
                            'size-10 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-xs',
                            isPlaying
                              ? 'bg-primary text-primary-foreground scale-105 ring-4 ring-primary/20'
                              : 'bg-surface border border-border text-foreground hover:border-primary',
                          )}
                          title={isPlaying ? 'Pause' : 'Écouter'}
                        >
                          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 fill-current ml-0.5" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground truncate">{rec.name}</p>
                          <div className="flex items-center gap-3 text-3xs text-muted-foreground mt-0.5">
                            <span className="font-mono font-semibold text-primary">
                              {formatDuration(rec.duration)}
                            </span>
                            <span>•</span>
                            <span>{new Date(rec.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => downloadAudio(rec)}
                          className="h-8 px-2.5 text-3xs gap-1"
                          title="Télécharger l'enregistrement audio"
                        >
                          <Download className="size-3" />
                          <span className="hidden sm:inline">Audio</span>
                        </Button>

                        <button
                          type="button"
                          onClick={() => deleteRecording(rec.id)}
                          className="p-2 rounded-lg text-muted-foreground hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
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
