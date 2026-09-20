import { Mic, Square, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  AUDIO_MAX_SECONDS,
  RECORDING_STATUS_LABELS,
  useCreateRecording,
  useDeleteRecording,
  useRecordingAudioUrl,
  useRecordings,
  useTranscriptionQuota,
  type WorkspacePage,
  type WorkspaceRecording,
} from '@/features/workspace';

/* Présentation Atelier ; la capture, le consentement et les quotas existants sont conservés. */

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

/** Le type MIME que ce navigateur sait produire, dans l'ordre de préférence. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}

function RecordingRow({ recording }: { recording: WorkspaceRecording }) {
  const audio = useRecordingAudioUrl(recording);
  const remove = useDeleteRecording();
  return (
    <li className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-3 text-sm last:border-0">
      <span className="font-medium">{recording.title}</span>
      <span className="text-muted-foreground text-sm leading-relaxed">
        {formatSeconds(recording.duration_seconds)} · {RECORDING_STATUS_LABELS[recording.status]}
        {recording.status === 'failed' && recording.error ? ` — ${recording.error}` : ''}
        {recording.audio_deleted_at ? ' · audio effacé (30 jours)' : ''}
      </span>
      {audio.data ? (
        // La transcription, écrite dans la page, tient lieu de sous-titres :
        // l'audio n'est que la source, effacée après 30 jours.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={audio.data} className="h-11 w-full max-w-64" />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Supprimer l'enregistrement"
        isLoading={remove.isPending}
        onClick={() => {
          if (
            window.confirm(
              "Supprimer l'enregistrement ? La transcription déjà écrite dans la page y reste.",
            )
          ) {
            remove.mutate(recording);
          }
        }}
      >
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}

export function WorkspaceRecorder({ page }: { page: WorkspacePage }) {
  const recordings = useRecordings(page.id);
  const quota = useTranscriptionQuota(page.organization_id);
  const create = useCreateRecording();

  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    // Au-delà d'une heure, on arrête : la base refuserait de toute façon.
    if (recording && elapsed >= AUDIO_MAX_SECONDS) recorderRef.current?.stop();
  }, [recording, elapsed]);

  const start = async () => {
    setError(null);
    const mimeType = pickMimeType();
    if (!mimeType) {
      setError("Ce navigateur ne sait pas enregistrer l'audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 48 kbit/s en opus : de la voix, lisible, ~20 Mo pour une heure —
      // sous la limite du bucket et de l'API.
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48_000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        create.mutate(
          {
            page,
            audio: blob,
            durationSeconds,
            consentConfirmed: consent,
            title: `Enregistrement du ${new Date().toLocaleDateString('fr-FR')}`,
          },
          { onError: (e) => setError(e instanceof Error ? e.message : 'Envoi impossible.') },
        );
      };
      startedAtRef.current = Date.now();
      setElapsed(0);
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Micro inaccessible.');
    }
  };

  const remaining = quota.data?.remaining_minutes;
  const canRecord =
    consent && !recording && !create.isPending && (quota.data?.unlimited || (remaining ?? 0) > 0);

  return (
    <section
      className="border-border bg-surface overflow-hidden rounded-xl border"
      aria-label="Enregistrement vocal"
    >
      <div className="space-y-4 p-4 sm:p-6">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Mic className="size-4" aria-hidden /> Enregistrement vocal
        </p>
        <p className="text-muted-foreground text-xs">
          {quota.data
            ? quota.data.unlimited
              ? 'Minutes de transcription : illimitées.'
              : `Minutes de transcription ce mois-ci : ${String(quota.data.used_minutes)} / ${String(quota.data.limit_minutes ?? 0)} (reste ${String(remaining ?? 0)}).`
            : 'Quota de transcription inconnu.'}{' '}
          L'audio est effacé après 30 jours ; la transcription et le résumé restent dans la page.
        </p>
        <Checkbox
          label="Les personnes enregistrées sont informées et d'accord."
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          disabled={recording}
        />
        <div className="flex flex-wrap items-center gap-2">
          {recording ? (
            <Button type="button" variant="danger" onClick={() => recorderRef.current?.stop()}>
              <Square aria-hidden /> Arrêter ({formatSeconds(elapsed)})
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void start()}
              disabled={!canRecord}
              isLoading={create.isPending}
            >
              <Mic aria-hidden /> Enregistrer
            </Button>
          )}
          {error ? <span className="text-error text-xs">{error}</span> : null}
        </div>
        {(recordings.data?.length ?? 0) > 0 ? (
          <ul className="space-y-2">
            {(recordings.data ?? []).map((r) => (
              <RecordingRow key={r.id} recording={r} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
