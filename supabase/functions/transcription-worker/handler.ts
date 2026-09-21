import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import { TranscriptionRejected } from '../_shared/transcription.ts';
import { workerSecretMatches } from '../_shared/worker-secret.ts';

/**
 * Transcrit et résume les enregistrements en attente ; purge l'audio de plus
 * de 30 jours. Réveillé par pg_cron quand il y a du travail.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE LA BASE DÉCIDE, CE QUE LE WORKER FAIT
 *
 * La base tire (`claim_workspace_recordings`, SKIP LOCKED), réserve les
 * minutes (`reserve_transcription_minutes`, atomique), écrit dans la page et
 * décide du recul (`record_workspace_recording_result`). Le worker : télécharge
 * l'audio, appelle le fournisseur deux fois (texte, puis résumé dans le quota
 * IA), rend compte, et supprime les fichiers désignés à la purge.
 *
 * Les appels fournisseur et le stockage sont injectés : ce fichier ne lit
 * jamais `Deno.env` et se teste sans réseau.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BATCH_SIZE = 3;
const PURGE_BATCH = 20;
const BUDGET_MS = 110_000;

export interface ClaimedRecording {
  id: string;
  organization_id: string;
  page_id: string;
  created_by: string | null;
  title: string;
  audio_path: string;
  mime_type: string;
  duration_seconds: number;
  language: string;
  attempts: number;
  created_at: string;
  /** Le moteur choisi par l'organisation (`organizations.stt_engine`) : legacy ou v2. */
  stt_engine: 'legacy' | 'v2';
}

export interface TranscriptionResult {
  text: string;
  /** Le modèle qui a réellement transcrit — consigné dans `workspace_recordings.engine`. */
  engine: string;
}

export interface TranscriptionWorkerConfig {
  url: string;
  serviceRoleKey: string;
  secret: string;
  /** Lit l'audio du bucket. `null` = stockage non joignable (test). */
  downloadAudio: (path: string) => Promise<Blob>;
  /** Supprime des fichiers du bucket. */
  removeAudio: (paths: string[]) => Promise<void>;
  /**
   * Le texte de l'audio et le modèle utilisé. Lève `TranscriptionRejected`
   * pour un refus définitif. Reçoit le moteur de l'organisation : « legacy »
   * = la chaîne d'origine, « v2 » = le nouveau moteur (phase 5).
   */
  transcribe: (
    audio: Blob,
    fileName: string,
    language: string,
    engine: 'legacy' | 'v2',
    prompt: string | undefined,
  ) => Promise<TranscriptionResult>;
  /**
   * La phrase de contexte pour une organisation (glossaire de son secteur,
   * puis son dictionnaire — phase 6). `undefined` en legacy : pas de contexte.
   * Jamais journalisée : elle peut porter des noms.
   */
  buildPrompt: (params: {
    admin: SupabaseClient;
    organizationId: string;
    engine: 'legacy' | 'v2';
  }) => Promise<string | undefined>;
  /**
   * Le résumé, DANS le quota IA de l'organisation : `null` si le quota est
   * épuisé ou le fournisseur indisponible — la transcription part sans
   * résumé plutôt que d'attendre.
   */
  summarize: (params: {
    admin: SupabaseClient;
    organizationId: string;
    userId: string | null;
    transcript: string;
  }) => Promise<string | null>;
  fetch?: typeof fetch;
  now?: () => Date;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

function fileNameFor(recording: ClaimedRecording): string {
  const dernier = recording.audio_path.split('/').pop() ?? 'audio';
  return dernier.includes('.') ? dernier : `${dernier}.webm`;
}

export function createTranscriptionWorkerHandler(config: TranscriptionWorkerConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

    const providedSecret = request.headers.get('x-worker-secret') ?? '';
    if (!(await workerSecretMatches(providedSecret, config.secret))) {
      return json({ error: 'Accès refusé.' }, 401);
    }

    const clock = config.now ?? (() => new Date());
    const startedAt = clock().getTime();
    const withinBudget = () => clock().getTime() - startedAt < BUDGET_MS;
    const result = { attempted: 0, done: 0, failed: 0, purged: 0 };

    const admin: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
      ...(config.fetch ? { global: { fetch: config.fetch } } : {}),
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.rpc('claim_workspace_recordings', { p_limit: BATCH_SIZE });
    if (error) return json({ error: "File d'enregistrements illisible." }, 503);

    for (const raw of data ?? []) {
      if (!withinBudget()) break;
      const recording = raw as ClaimedRecording;
      result.attempted += 1;

      let outcome: 'done' | 'error' | 'quota' | 'rejected' = 'error';
      let transcript: string | null = null;
      let summary: string | null = null;
      let errorMessage: string | null = null;
      let engine: string | null = null;

      try {
        const { data: reservation, error: reserveError } = await admin
          .rpc('reserve_transcription_minutes', { p_recording_id: recording.id })
          .maybeSingle();
        if (reserveError) throw reserveError;
        const reserved = (reservation as { reserved?: boolean } | null)?.reserved === true;
        if (!reserved) {
          outcome = 'quota';
          errorMessage = 'Quota de minutes de transcription épuisé pour ce mois.';
        } else {
          const audio = await config.downloadAudio(recording.audio_path);
          const moteur = recording.stt_engine ?? 'legacy';
          const prompt = await config.buildPrompt({
            admin,
            organizationId: recording.organization_id,
            engine: moteur,
          });
          const resultat = await config.transcribe(
            audio,
            fileNameFor(recording),
            recording.language,
            moteur,
            prompt,
          );
          transcript = resultat.text;
          engine = resultat.engine;
          summary = await config.summarize({
            admin,
            organizationId: recording.organization_id,
            userId: recording.created_by,
            transcript,
          });
          outcome = 'done';
        }
      } catch (failure) {
        if (failure instanceof TranscriptionRejected) {
          outcome = 'rejected';
        }
        errorMessage = failure instanceof Error ? failure.message : String(failure);
      }

      const { error: recordError } = await admin.rpc('record_workspace_recording_result', {
        p_id: recording.id,
        p_outcome: outcome,
        p_transcript: transcript,
        p_summary: summary,
        p_error: errorMessage,
        p_engine: engine,
      });
      if (recordError) {
        console.error('transcription-worker: résultat non enregistré', recordError);
        result.failed += 1;
        continue;
      }
      if (outcome === 'done') result.done += 1;
      else result.failed += 1;
    }

    // La purge : l'audio de plus de 30 jours. Le fichier d'abord, la marque
    // ensuite — une marque sans suppression cacherait un fichier qui reste.
    if (withinBudget()) {
      const { data: purges } = await admin.rpc('claim_workspace_audio_purges', {
        p_limit: PURGE_BATCH,
      });
      for (const raw of (purges ?? []) as Array<{ id: string; audio_path: string }>) {
        if (!withinBudget()) break;
        try {
          await config.removeAudio([raw.audio_path]);
          const { error: markError } = await admin.rpc('mark_workspace_audio_deleted', {
            p_id: raw.id,
          });
          if (markError) throw markError;
          result.purged += 1;
        } catch (failure) {
          console.error('transcription-worker: purge impossible', raw.audio_path, failure);
        }
      }
    }

    const durationMs = clock().getTime() - startedAt;
    const { error: heartbeatError } = await admin.from('transcription_worker_runs').insert({
      ran_at: clock().toISOString(),
      attempted: result.attempted,
      done: result.done,
      failed: result.failed,
      purged: result.purged,
      duration_ms: durationMs,
    });
    if (heartbeatError)
      console.error('transcription-worker: battement de cœur impossible', heartbeatError);

    return json({ ...result, durationMs });
  };
}
