import { useQueryClient } from '@tanstack/react-query';
import { Mic, Pause, Play, Square, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  RECORDING_STATUS_LABELS,
  createRecordingRow,
  submitRecording,
  useAudioRecorder,
  useDeleteRecording,
  useRecordingAudioUrl,
  useRecordings,
  useTranscriptionQuota,
  type RecorderServerApi,
  type WorkspacePage,
  type WorkspaceRecording,
} from '@/features/workspace';
import { qk } from '@/lib/query-keys';

/*
  Présentation Atelier. La mécanique (capture, pause, tranches, sauvegarde
  locale, envoi reprenable, reprise) vit dans `useAudioRecorder` — ce
  composant affiche et demande, il n'enregistre rien lui-même.
*/

/** Les deux pas serveur de l'envoi, branchés sur l'API du Workspace. */
const serverApi: RecorderServerApi = {
  createRow: (input) => createRecordingRow(input),
  submit: (id, size) => submitRecording(id, size),
};

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m)}:${String(s).padStart(2, '0')}`;
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
  const queryClient = useQueryClient();
  const recordings = useRecordings(page.id);
  const quota = useTranscriptionQuota(page.organization_id);
  const [consent, setConsent] = useState(false);

  const recorder = useAudioRecorder({
    page,
    api: serverApi,
    onSubmitted: () => {
      void queryClient.invalidateQueries({ queryKey: qk.workspace.recordings(page.id) });
      void queryClient.invalidateQueries({
        queryKey: [...qk.workspace.all, page.organization_id, 'transcription-quota'],
      });
    },
  });

  const remaining = quota.data?.remaining_minutes;
  const enCours = recorder.status === 'recording' || recorder.status === 'paused';
  const enEnvoi =
    recorder.status === 'saving' ||
    recorder.status === 'uploading' ||
    recorder.status === 'submitting' ||
    recorder.status === 'requesting';
  const canRecord =
    consent && !enCours && !enEnvoi && (quota.data?.unlimited || (remaining ?? 0) > 0);

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
          L’audio est effacé après 30 jours ; la transcription et le résumé restent dans la page.
          {recorder.durable
            ? ' L’audio est gardé sur cet appareil jusqu’à confirmation de l’envoi.'
            : ' Ce navigateur ne garde pas l’audio hors ligne : ne fermez pas la page avant la fin de l’envoi.'}
        </p>
        <Checkbox
          label="Les personnes enregistrées sont informées et d’accord."
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          disabled={enCours}
        />
        <div className="flex flex-wrap items-center gap-2">
          {enCours ? (
            <>
              {recorder.status === 'recording' ? (
                <Button type="button" variant="secondary" onClick={recorder.pause}>
                  <Pause aria-hidden /> Pause
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={recorder.resume}>
                  <Play aria-hidden /> Reprendre
                </Button>
              )}
              <Button type="button" variant="danger" onClick={recorder.stop}>
                <Square aria-hidden /> Terminer ({formatSeconds(recorder.elapsedSeconds)})
              </Button>
              <Button type="button" variant="ghost" onClick={() => void recorder.cancel()}>
                <X aria-hidden /> Annuler
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={() =>
                void recorder.start({
                  title: `Enregistrement du ${new Date().toLocaleDateString('fr-FR')}`,
                  consentConfirmed: consent,
                })
              }
              disabled={!canRecord}
              isLoading={enEnvoi}
              loadingLabel={
                recorder.status === 'uploading' && recorder.progress !== null
                  ? `Envoi ${String(Math.round(recorder.progress * 100))} %`
                  : recorder.status === 'submitting'
                    ? 'Confirmation…'
                    : 'Sauvegarde…'
              }
            >
              <Mic aria-hidden /> Enregistrer
            </Button>
          )}
          {recorder.error ? <span className="text-error text-xs">{recorder.error}</span> : null}
        </div>

        {recorder.pending.length > 0 ? (
          <ul className="border-border bg-surface-sunken space-y-2 rounded-lg border p-3 text-sm">
            {recorder.pending.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.title}</span>
                <span className="text-muted-foreground text-xs">
                  {formatSeconds(p.durationSeconds)} ·{' '}
                  {p.interrupted ? 'interrompu — audio conservé' : 'en attente d’envoi'}
                  {p.lastError ? ` — ${p.lastError}` : ''}
                </span>
                <Button type="button" size="sm" onClick={() => void recorder.retry(p.key)}>
                  Envoyer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Supprimer cet enregistrement non envoyé ? L’audio sera perdu.',
                      )
                    ) {
                      void recorder.discard(p.key);
                    }
                  }}
                >
                  Supprimer
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

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
