import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CircleAlert,
  Ellipsis,
  FileText,
  Headphones,
  Loader2,
  Mic,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import {
  RECORDING_STATUS_LABELS,
  countTranscriptWords,
  createRecordingRow,
  fetchLiveToken,
  formatRecordingDuration,
  recordingViews,
  submitRecording,
  updateRecordingNotes,
  useAudioRecorder,
  useDeleteRecording,
  useRecordingAudioUrl,
  useRecordingTimeline,
  useRecordings,
  useRenameRecording,
  useRetryRecordingTranscription,
  useTranscriptionQuota,
  type RecorderServerApi,
  type WorkspacePage,
  type WorkspaceRecording,
} from '@/features/workspace';
import { cn } from '@/lib/cn';
import { qk } from '@/lib/query-keys';

/*
  REZO Voice ne remplace pas la mécanique d'enregistrement. La capture, les
  tranches IndexedDB, la pause, le direct, l'envoi TUS et la reprise restent
  tous dans `useAudioRecorder`. Ce composant orchestre une seule surface
  visuelle au fil des états locaux et serveur.
*/

const serverApi: RecorderServerApi = {
  createRow: (input) => createRecordingRow(input),
  submit: (id, size) => submitRecording(id, size),
  updateNotes: (id, notes) => updateRecordingNotes(id, notes),
};

const COMPLETED_DOCK_VISIBLE_MS = 3_000;

function recorderErrorMessage(message: string): { title: string; help: string } {
  const normalized = message.toLocaleLowerCase('fr');
  if (/notallowed|permission|autorisation|refus/u.test(normalized)) {
    return {
      title: 'Autorisation du microphone refusée',
      help: 'Autorisez le microphone pour REZO360 dans les réglages du navigateur ou du téléphone, puis réessayez.',
    };
  }
  if (/notfound|aucun périphérique|introuvable|micro inaccessible/u.test(normalized)) {
    return {
      title: 'Microphone indisponible',
      help: 'Vérifiez qu’un microphone est connecté et qu’aucune autre application ne le bloque.',
    };
  }
  if (/quota/u.test(normalized)) {
    return {
      title: 'Quota de transcription atteint',
      help: 'L’audio conservé reste disponible. Réessayez lorsque des minutes de transcription seront disponibles.',
    };
  }
  if (/réseau|network|503|connexion|envoi/u.test(normalized)) {
    return {
      title: 'Envoi interrompu',
      help: 'L’audio est conservé sur cet appareil. Vous pouvez relancer l’envoi sans recommencer l’enregistrement.',
    };
  }
  return { title: 'REZO Voice a rencontré un problème', help: message };
}

function SignalWaveform({ level, paused }: { level: number | null; paused: boolean }) {
  const measured = level !== null;
  const normalized = measured ? Math.min(1, Math.max(0.06, level * 6)) : 0.08;
  const shape = [
    0.24, 0.42, 0.68, 0.91, 0.62, 0.38, 0.74, 1, 0.7, 0.46, 0.82, 0.56, 0.31, 0.65, 0.88, 0.5, 0.72,
    0.35,
  ];
  return (
    <div
      className="flex h-10 min-w-28 flex-1 items-center justify-center gap-1"
      role={measured ? 'meter' : undefined}
      aria-label={measured ? 'Niveau sonore du microphone' : undefined}
      aria-valuemin={measured ? 0 : undefined}
      aria-valuemax={measured ? 100 : undefined}
      aria-valuenow={measured ? Math.round(Math.min(1, level * 6) * 100) : undefined}
    >
      {shape.map((factor, index) => (
        <span
          key={index}
          className={cn(
            'bg-primary block w-1 rounded-full transition-[height,opacity] duration-150',
            paused && 'opacity-45',
            !measured && 'opacity-25',
          )}
          style={{ height: `${Math.round(7 + normalized * factor * 29)}px` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function StatusStep({
  state,
  children,
}: {
  state: 'waiting' | 'active' | 'done' | 'error';
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-2 text-xs',
        state === 'waiting' && 'text-muted-foreground',
        state === 'active' && 'text-primary font-semibold',
        state === 'done' && 'text-success',
        state === 'error' && 'text-error font-semibold',
      )}
    >
      {state === 'done' ? (
        <span className="bg-success text-success-foreground flex size-5 items-center justify-center rounded-full">
          <Check className="size-3" aria-hidden />
        </span>
      ) : state === 'active' ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : state === 'error' ? (
        <CircleAlert className="size-5" aria-hidden />
      ) : (
        <span className="border-border-strong block size-5 rounded-full border-2" aria-hidden />
      )}
      <span>{children}</span>
    </li>
  );
}

function ProcessingSteps({
  localStatus,
  uploadProgress,
  recording,
}: {
  localStatus: ReturnType<typeof useAudioRecorder>['status'];
  uploadProgress: number | null;
  recording: WorkspaceRecording | null;
}) {
  const serverStatus = recording?.status;
  const audioDone =
    localStatus === 'uploading' ||
    localStatus === 'submitting' ||
    localStatus === 'done' ||
    serverStatus !== undefined;
  const uploadDone = localStatus === 'done' || serverStatus !== undefined;
  const failed = serverStatus === 'failed';
  const transcriptionDone = serverStatus === 'done';
  const transcriptionActive =
    localStatus === 'done' || serverStatus === 'pending' || serverStatus === 'processing';

  return (
    <ol className="space-y-2" aria-label="Progression de la note vocale">
      <StatusStep state={audioDone ? 'done' : 'active'}>Audio enregistré</StatusStep>
      <StatusStep
        state={
          uploadDone
            ? 'done'
            : localStatus === 'uploading' || localStatus === 'submitting'
              ? 'active'
              : 'waiting'
        }
      >
        {localStatus === 'uploading' && uploadProgress !== null
          ? `Envoi sécurisé — ${Math.round(uploadProgress * 100)} %`
          : localStatus === 'submitting'
            ? 'Confirmation de l’envoi…'
            : 'Envoi sécurisé'}
      </StatusStep>
      <StatusStep
        state={
          failed ? 'error' : transcriptionDone ? 'done' : transcriptionActive ? 'active' : 'waiting'
        }
      >
        {failed
          ? 'Transcription échouée'
          : transcriptionDone
            ? 'Transcription prête'
            : serverStatus === 'processing'
              ? 'Transcription en cours…'
              : transcriptionActive
                ? 'Transcription en attente…'
                : 'Transcription'}
      </StatusStep>
    </ol>
  );
}

function RecordingAudioPlayer({ recording }: { recording: WorkspaceRecording }) {
  const audio = useRecordingAudioUrl(recording);
  if (recording.audio_deleted_at) {
    return <p className="text-muted-foreground text-sm">L’audio a été effacé après 30 jours.</p>;
  }
  if (audio.isLoading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Préparation de l’audio…
      </p>
    );
  }
  if (!audio.data) return <p className="text-error text-sm">L’audio n’est pas disponible.</p>;
  return (
    // La transcription finale est disponible dans la même boîte de dialogue.
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio controls src={audio.data} className="h-12 w-full" />
  );
}

function RecordingOverflow({
  recording,
  onRename,
  onListen,
}: {
  recording: WorkspaceRecording;
  onRename: () => void;
  onListen: () => void;
}) {
  const remove = useDeleteRecording();
  return (
    <Dropdown
      trigger={
        <Button variant="ghost" size="icon" aria-label="Plus d’actions">
          <Ellipsis aria-hidden />
        </Button>
      }
    >
      <DropdownItem onSelect={onRename}>
        <Pencil aria-hidden /> Renommer
      </DropdownItem>
      <DropdownItem disabled={recording.audio_deleted_at !== null} onSelect={onListen}>
        <Headphones aria-hidden /> Réécouter
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem
        className="text-error"
        disabled={remove.isPending}
        onSelect={() => {
          if (
            window.confirm(
              'Supprimer l’enregistrement ? La transcription déjà intégrée à la page restera.',
            )
          ) {
            remove.mutate(recording);
          }
        }}
      >
        <Trash2 aria-hidden /> Supprimer
      </DropdownItem>
    </Dropdown>
  );
}

function RecordingHistoryRow({
  recording,
  onView,
  onRename,
  onListen,
}: {
  recording: WorkspaceRecording;
  onView: (mode: 'transcript' | 'summary') => void;
  onRename: () => void;
  onListen: () => void;
}) {
  const retry = useRetryRecordingTranscription();
  return (
    <li className="border-border flex flex-wrap items-center gap-2 border-b py-3 last:border-0">
      <div className="min-w-48 flex-1">
        <p className="text-sm font-semibold">{recording.title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {formatRecordingDuration(recording.duration_seconds)} ·{' '}
          {RECORDING_STATUS_LABELS[recording.status]}
          {recording.audio_deleted_at ? ' · audio effacé' : ''}
        </p>
        {recording.status === 'failed' && recording.error ? (
          <p className="text-error mt-1 text-xs">{recording.error}</p>
        ) : null}
      </div>
      {recording.status === 'done' ? (
        <Button size="sm" variant="secondary" onClick={() => onView('transcript')}>
          <FileText aria-hidden /> Voir
        </Button>
      ) : null}
      {recording.status === 'failed' && recording.audio_deleted_at === null ? (
        <Button
          size="sm"
          variant="secondary"
          isLoading={retry.isPending}
          onClick={() => retry.mutate(recording)}
        >
          <RotateCcw aria-hidden /> Réessayer
        </Button>
      ) : null}
      <RecordingOverflow recording={recording} onRename={onRename} onListen={onListen} />
    </li>
  );
}

export function WorkspaceRecorder({ page }: { page: WorkspacePage }) {
  const queryClient = useQueryClient();
  const recordings = useRecordings(page.id);
  const quota = useTranscriptionQuota(page.organization_id);
  const renameRecording = useRenameRecording();
  const retryTranscription = useRetryRecordingTranscription();
  const [consent, setConsent] = useState(false);
  const [focusedRecordingId, setFocusedRecordingId] = useState<string | null>(null);
  const [dockDismissed, setDockDismissed] = useState(false);
  const [details, setDetails] = useState<{
    recording: WorkspaceRecording;
    mode: 'transcript' | 'summary';
  } | null>(null);
  const [listenTarget, setListenTarget] = useState<WorkspaceRecording | null>(null);
  const [renameTarget, setRenameTarget] = useState<WorkspaceRecording | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const previousStatuses = useRef(new Map<string, WorkspaceRecording['status']>());

  const recorder = useAudioRecorder({
    page,
    api: serverApi,
    live: { getToken: () => fetchLiveToken(page.organization_id, page.id) },
    onSubmitted: (recordingId) => {
      setFocusedRecordingId(recordingId);
      setDockDismissed(false);
      void queryClient.invalidateQueries({ queryKey: qk.workspace.recordings(page.id) });
      void queryClient.invalidateQueries({
        queryKey: [...qk.workspace.all, page.organization_id, 'transcription-quota'],
      });
    },
  });
  const timeline = useRecordingTimeline(recorder, recordings.data);

  useEffect(() => {
    const next = new Map<string, WorkspaceRecording['status']>();
    for (const recording of recordings.data ?? []) {
      const previous = previousStatuses.current.get(recording.id);
      next.set(recording.id, recording.status);
      if (
        previous !== undefined &&
        previous !== recording.status &&
        (recording.status === 'done' || recording.status === 'failed')
      ) {
        setFocusedRecordingId(recording.id);
        setDockDismissed(false);
      }
    }
    previousStatuses.current = next;
  }, [recordings.data]);

  const focusedRecording =
    (recordings.data ?? []).find((recording) => recording.id === focusedRecordingId) ?? null;

  useEffect(() => {
    if (focusedRecording?.status !== 'done') return;
    const timer = window.setTimeout(() => setDockDismissed(true), COMPLETED_DOCK_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [focusedRecording?.id, focusedRecording?.status]);
  const active = recorder.status === 'recording' || recorder.status === 'paused';
  const localProcessing =
    recorder.status === 'requesting' ||
    recorder.status === 'saving' ||
    recorder.status === 'uploading' ||
    recorder.status === 'submitting' ||
    (recorder.status === 'done' && focusedRecording === null && focusedRecordingId !== null);
  const serverProcessing =
    focusedRecording?.status === 'pending' || focusedRecording?.status === 'processing';
  const showDock =
    !dockDismissed &&
    (active ||
      localProcessing ||
      serverProcessing ||
      focusedRecording?.status === 'done' ||
      focusedRecording?.status === 'failed');
  const remaining = quota.data?.remaining_minutes;
  const canRecord =
    consent &&
    !active &&
    !localProcessing &&
    (quota.data?.unlimited === true || (remaining ?? 0) > 0);
  const latestDone =
    (recordings.data ?? []).find((recording) => recording.status === 'done') ?? null;
  const words = countTranscriptWords(focusedRecording?.transcript ?? null);
  const errorDisplay = recorder.error ? recorderErrorMessage(recorder.error) : null;
  const focusedTimeline = timeline.find(
    (item) => item.key === focusedRecordingId || item.key === recorder.current?.key,
  );

  const start = () => {
    setFocusedRecordingId(null);
    setDockDismissed(false);
    void recorder.start({
      title: `Note vocale du ${new Date().toLocaleDateString('fr-FR')}`,
      consentConfirmed: consent,
    });
  };

  const openRename = (recording: WorkspaceRecording) => {
    setRenameTarget(recording);
    setRenameValue(recording.title);
  };

  return (
    <>
      <section
        className="rezo-voice-morph border-border bg-surface-subtle mb-4 overflow-hidden rounded-2xl border"
        aria-label="Enregistrement vocal"
      >
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="bg-primary-subtle text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                <Mic className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-bold">REZO Voice</p>
                <p className="text-muted-foreground text-xs">
                  Dictez une note pendant que vous continuez à écrire.
                </p>
              </div>
            </div>
            <Button
              className="min-h-11 w-full justify-center sm:w-auto"
              disabled={!canRecord}
              isLoading={recorder.status === 'requesting'}
              loadingLabel="Accès au microphone"
              onClick={start}
            >
              <Mic aria-hidden /> Enregistrer une note vocale
            </Button>
          </div>

          {!active && !localProcessing ? (
            <div className="border-border flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
              <Checkbox
                label="Les personnes enregistrées sont informées et d’accord."
                checked={consent}
                onCheckedChange={(value) => setConsent(value === true)}
              />
              <p className="text-muted-foreground text-xs">
                {quota.data
                  ? quota.data.unlimited
                    ? 'Transcription illimitée'
                    : `${remaining ?? 0} min restantes ce mois-ci`
                  : 'Vérification du quota…'}
              </p>
            </div>
          ) : null}

          {active || localProcessing ? (
            <div className="border-border grid gap-3 border-t pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.6fr)]">
              <div>
                <p className="text-muted-foreground text-xs font-semibold">
                  Notes d’enregistrement
                </p>
                <Textarea
                  aria-label="Notes pendant l’enregistrement"
                  value={recorder.notes}
                  onChange={(event) => recorder.setNotes(event.target.value)}
                  maxLength={20000}
                  rows={2}
                  placeholder="Noms, chiffres, actions à retenir…"
                />
              </div>
              {recorder.live.status !== 'off' && recorder.live.status !== 'unavailable' ? (
                <div
                  className="bg-surface border-border max-h-28 overflow-y-auto rounded-xl border p-3 text-sm whitespace-pre-wrap"
                  aria-live="polite"
                  aria-label="Transcription en direct"
                >
                  {recorder.live.text ||
                    (recorder.live.status === 'connecting'
                      ? 'Connexion de la transcription en direct…'
                      : 'Parlez naturellement : le brouillon apparaît ici.')}
                </div>
              ) : (
                <p className="text-muted-foreground self-center text-xs">
                  {recorder.live.status === 'unavailable'
                    ? 'Le direct est indisponible ; la transcription finale reste active.'
                    : 'L’audio est sauvegardé sur cet appareil pendant la capture.'}
                </p>
              )}
            </div>
          ) : null}

          {errorDisplay ? (
            <div className="border-error-border bg-error-subtle rounded-xl border p-3" role="alert">
              <p className="text-error text-sm font-bold">{errorDisplay.title}</p>
              <p className="text-muted-foreground mt-1 text-xs">{errorDisplay.help}</p>
            </div>
          ) : null}

          {recordings.isError ? (
            <div
              className="border-error-border bg-error-subtle flex flex-wrap items-center gap-3 rounded-xl border p-3"
              role="alert"
            >
              <div className="min-w-48 flex-1">
                <p className="text-error text-sm font-bold">Connexion au suivi interrompue</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  L’audio déjà capté n’est pas supprimé. Relancez le suivi de la transcription.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void recordings.refetch()}>
                <RotateCcw aria-hidden /> Réessayer
              </Button>
            </div>
          ) : null}

          {quota.isError ? (
            <div
              className="border-warning-border bg-warning-subtle rounded-xl border p-3"
              role="alert"
            >
              <p className="text-sm font-bold">Quota de transcription indisponible</p>
              <p className="text-muted-foreground mt-1 text-xs">
                L’enregistrement est temporairement désactivé pour éviter un échec silencieux.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => void quota.refetch()}
              >
                <RotateCcw aria-hidden /> Réessayer
              </Button>
            </div>
          ) : null}

          {recorder.pending.length > 0 ? (
            <ul className="border-border bg-surface space-y-2 rounded-xl border p-3">
              {recorder.pending.map((pending) => (
                <li key={pending.key} className="flex flex-wrap items-center gap-2 text-sm">
                  <div className="min-w-48 flex-1">
                    <p className="font-semibold">{pending.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatRecordingDuration(pending.durationSeconds)} ·{' '}
                      {pending.interrupted ? 'interrompu — audio conservé' : 'en attente d’envoi'}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => void recorder.retry(pending.key)}>
                    <RotateCcw aria-hidden /> Réessayer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Supprimer cet audio non envoyé ? Cette action est définitive.',
                        )
                      ) {
                        void recorder.discard(pending.key);
                      }
                    }}
                  >
                    Supprimer
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {!active && !localProcessing && latestDone ? (
            <div className="border-success-border bg-success-subtle flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <span className="bg-success text-success-foreground flex size-9 items-center justify-center rounded-full">
                <Check className="size-5" aria-hidden />
              </span>
              <div className="min-w-44 flex-1">
                <p className="text-success text-sm font-bold">Dernière transcription prête</p>
                <p className="text-muted-foreground text-xs">
                  {latestDone.title} · {formatRecordingDuration(latestDone.duration_seconds)}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setDetails({ recording: latestDone, mode: 'transcript' })}
              >
                Voir la transcription
              </Button>
            </div>
          ) : null}

          {(recordings.data?.length ?? 0) > 0 ? (
            <details className="group border-border border-t pt-3">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-semibold">
                Historique des notes vocales ({recordings.data?.length ?? 0})
              </summary>
              <ul className="mt-2">
                {(recordings.data ?? []).map((recording) => (
                  <RecordingHistoryRow
                    key={recording.id}
                    recording={recording}
                    onView={(mode) => setDetails({ recording, mode })}
                    onRename={() => openRename(recording)}
                    onListen={() => setListenTarget(recording)}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </section>

      {showDock ? (
        <aside
          className="rezo-voice-dock rezo-voice-morph border-border bg-surface-raised shadow-overlay fixed right-3 bottom-[calc(4.75rem+var(--safe-bottom))] left-3 z-[45] rounded-2xl border p-3 md:right-6 md:bottom-6 md:left-auto md:w-[min(42rem,calc(100vw-3rem))]"
          aria-label="REZO Voice"
          aria-live="polite"
        >
          {active ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-36 items-center gap-2">
                <span
                  className="rezo-voice-recording-dot bg-error block size-3 rounded-full"
                  aria-hidden
                />
                <div>
                  <p className="text-xs font-bold">
                    {recorder.status === 'paused'
                      ? 'Enregistrement en pause'
                      : 'Enregistrement en cours'}
                  </p>
                  <p className="font-mono text-xl font-black tabular-nums">
                    {formatRecordingDuration(recorder.elapsedSeconds)}
                  </p>
                </div>
              </div>
              <SignalWaveform level={recorder.level} paused={recorder.status === 'paused'} />
              <div className="ml-auto flex items-center gap-2">
                {recorder.status === 'recording' ? (
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Mettre l’enregistrement en pause"
                    onClick={recorder.pause}
                  >
                    <Pause aria-hidden />
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Reprendre l’enregistrement"
                    onClick={recorder.resume}
                  >
                    <Play aria-hidden />
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="icon"
                  aria-label="Terminer l’enregistrement"
                  onClick={recorder.stop}
                >
                  <Square aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Annuler l’enregistrement"
                  onClick={() => {
                    if (window.confirm('Annuler cet enregistrement et supprimer l’audio capté ?')) {
                      void recorder.cancel();
                    }
                  }}
                >
                  <X aria-hidden />
                </Button>
              </div>
              {recorder.signal === 'none' ? (
                <p className="text-error w-full text-xs font-semibold" role="alert">
                  Aucun son capté : vérifiez le microphone avant de continuer.
                </p>
              ) : null}
            </div>
          ) : focusedRecording?.status === 'done' ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rezo-voice-success bg-success text-success-foreground flex size-11 items-center justify-center rounded-full">
                <Check className="size-6" aria-hidden />
              </span>
              <div className="min-w-44 flex-1">
                <p className="text-success font-bold">Transcription prête</p>
                <p className="text-muted-foreground text-xs">
                  Durée : {formatRecordingDuration(focusedRecording.duration_seconds)}
                  {words !== null ? ` · ${new Intl.NumberFormat('fr-FR').format(words)} mots` : ''}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setDetails({ recording: focusedRecording, mode: 'transcript' })}
              >
                <FileText aria-hidden /> Voir la transcription
              </Button>
              {focusedRecording.summary ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDetails({ recording: focusedRecording, mode: 'summary' })}
                >
                  <Sparkles aria-hidden /> Voir le résumé
                </Button>
              ) : null}
              <RecordingOverflow
                recording={focusedRecording}
                onRename={() => openRename(focusedRecording)}
                onListen={() => setListenTarget(focusedRecording)}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fermer REZO Voice"
                onClick={() => setDockDismissed(true)}
              >
                <X aria-hidden />
              </Button>
            </div>
          ) : focusedRecording?.status === 'failed' ? (
            <div className="flex flex-wrap items-center gap-3">
              <CircleAlert className="text-error size-8" aria-hidden />
              <div className="min-w-44 flex-1">
                <p className="text-error font-bold">Transcription échouée</p>
                <p className="text-muted-foreground text-xs">
                  {focusedRecording.error ?? 'Le traitement n’a pas abouti.'}
                </p>
              </div>
              {focusedRecording.audio_deleted_at === null ? (
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={retryTranscription.isPending}
                  onClick={() => retryTranscription.mutate(focusedRecording)}
                >
                  <RotateCcw aria-hidden /> Réessayer
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fermer REZO Voice"
                onClick={() => setDockDismissed(true)}
              >
                <X aria-hidden />
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.7fr)] sm:items-center">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {recorder.status === 'requesting'
                      ? 'Accès au microphone…'
                      : (focusedTimeline?.label ?? 'Traitement de la note vocale')}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Vous pouvez continuer à écrire. La progression affichée correspond aux états
                    réellement reçus.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Masquer la progression de REZO Voice"
                  onClick={() => setDockDismissed(true)}
                >
                  <X aria-hidden />
                </Button>
              </div>
              <ProcessingSteps
                localStatus={recorder.status}
                uploadProgress={recorder.progress}
                recording={focusedRecording}
              />
            </div>
          )}
        </aside>
      ) : null}

      <Modal
        open={details !== null}
        onOpenChange={(open) => !open && setDetails(null)}
        title={
          details?.mode === 'summary'
            ? 'Résumé de la note vocale'
            : 'Transcription de la note vocale'
        }
        {...(details?.recording.title ? { description: details.recording.title } : {})}
        size="lg"
      >
        {details ? (
          <div className="space-y-4">
            <div className="bg-surface-sunken flex gap-1 rounded-xl p-1" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={details.mode === 'transcript'}
                className={cn(
                  'min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold',
                  details.mode === 'transcript' && 'bg-surface text-primary shadow-sm',
                )}
                onClick={() => setDetails({ ...details, mode: 'transcript' })}
              >
                Transcription
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={details.mode === 'summary'}
                disabled={!details.recording.summary}
                className={cn(
                  'min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold disabled:opacity-45',
                  details.mode === 'summary' && 'bg-surface text-primary shadow-sm',
                )}
                onClick={() => setDetails({ ...details, mode: 'summary' })}
              >
                Résumé
              </button>
            </div>
            <div className="max-w-none text-sm leading-relaxed whitespace-pre-wrap">
              {details.mode === 'summary'
                ? (recordingViews(details.recording).summary.markdown ?? 'Aucun résumé disponible.')
                : (recordingViews(details.recording).transcript.text ??
                  recordingViews(details.recording).live.text ??
                  'Aucune transcription disponible.')}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={listenTarget !== null}
        onOpenChange={(open) => !open && setListenTarget(null)}
        title="Réécouter la note vocale"
        {...(listenTarget?.title ? { description: listenTarget.title } : {})}
      >
        {listenTarget ? <RecordingAudioPlayer recording={listenTarget} /> : null}
      </Modal>

      <Modal
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title="Renommer la note vocale"
        footer={
          <Button
            disabled={renameValue.trim().length === 0}
            isLoading={renameRecording.isPending}
            onClick={() => {
              if (!renameTarget) return;
              renameRecording.mutate(
                { recordingId: renameTarget.id, title: renameValue.trim() },
                { onSuccess: () => setRenameTarget(null) },
              );
            }}
          >
            Renommer
          </Button>
        }
      >
        <Input
          label="Nom"
          value={renameValue}
          maxLength={120}
          onChange={(event) => setRenameValue(event.target.value)}
        />
      </Modal>
    </>
  );
}
