import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  createChatCompletion,
  finalizeAiUsage,
  releaseAiUsage,
  reserveAiUsage,
} from '../_shared/ai.ts';
import { summaryPrompt, summaryQuery, transcribeAudio } from '../_shared/transcription.ts';
import { createTranscriptionWorkerHandler } from './handler.ts';

/**
 * Réveillé chaque minute par pg_cron (`app.trigger_transcription_worker`),
 * seulement quand un enregistrement attend ou qu'un audio est à purger.
 */
const url = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY') ?? '';

const storage = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}).storage.from('workspace-audio');

Deno.serve(
  createTranscriptionWorkerHandler({
    url,
    serviceRoleKey,
    secret: Deno.env.get('TRANSCRIPTION_WORKER_SECRET') ?? '',
    downloadAudio: async (path) => {
      const { data, error } = await storage.download(path);
      if (error || !data)
        throw new Error(`Audio introuvable dans le bucket : ${error?.message ?? path}`);
      return data;
    },
    removeAudio: async (paths) => {
      const { error } = await storage.remove(paths);
      if (error) throw error;
    },
    // Phase 4 : le flag est transmis et le moteur utilisé est consigné ;
    // « v2 » ne diffère pas encore de « legacy » (phase 5 : nouveau moteur + glossaire).
    transcribe: (audio, fileName, language, _engine) => {
      if (!openaiApiKey)
        throw new Error('OPENAI_API_KEY absente : la transcription est impossible.');
      return transcribeAudio({ apiKey: openaiApiKey, audio, fileName, language });
    },
    // Le résumé compte une requête IA de l'organisation, réservée comme une
    // conversation Workspace ; sans quota ou sans clé, la transcription part
    // sans résumé.
    summarize: async ({ admin, organizationId, userId, transcript }) => {
      if (!openaiApiKey || !userId || transcript.trim().length === 0) return null;
      const reservation = await reserveAiUsage(admin, organizationId, userId, 'workspace');
      if (!reservation) return null;
      try {
        const completion = await createChatCompletion({
          apiKey: openaiApiKey,
          systemPrompt: summaryPrompt(),
          history: [],
          query: summaryQuery(transcript),
        });
        await finalizeAiUsage({
          admin,
          reservationId: reservation.id,
          organizationId,
          userId,
          inputTokens: completion.inputTokens,
          outputTokens: completion.outputTokens,
        });
        return completion.content;
      } catch (failure) {
        console.error('transcription-worker: résumé impossible', failure);
        await releaseAiUsage(admin, reservation.id, organizationId, userId);
        return null;
      }
    },
  }),
);
