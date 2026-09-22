import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  createChatCompletion,
  finalizeAiUsage,
  releaseAiUsage,
  reserveAiUsage,
} from '../_shared/ai.ts';
import { chargerTermesOrganisation, contexteOrganisation } from '../_shared/stt-context.ts';
import {
  lireResume,
  promptResumeStructure,
  requeteResume,
  resumeEnMarkdown,
} from '../_shared/structured-summary.ts';
import { glossaireDeBase } from '../_shared/stt-glossary.ts';
import { normaliserTranscription } from '../_shared/transcript-normalize.ts';
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
    transcribe: (audio, fileName, language, engine, prompt) => {
      if (!openaiApiKey)
        throw new Error('OPENAI_API_KEY absente : la transcription est impossible.');
      return transcribeAudio({ apiKey: openaiApiKey, audio, fileName, language, engine, prompt });
    },
    // Le contexte de la chaîne v2 : le dictionnaire de l'organisation, puis
    // le glossaire de son secteur. Rien en legacy. Jamais journalisé.
    buildPrompt: ({ admin, organizationId, engine }) =>
      engine === 'v2' ? contexteOrganisation(admin, organizationId) : Promise.resolve(undefined),
    // La normalisation contrôlée (phase 7), en v2 seulement : les termes
    // connus sont le dictionnaire de l'organisation puis le glossaire de son
    // secteur ; la couche modèle fait partie de la transcription (couverte
    // par les minutes réservées), pas du quota de requêtes IA. Sans clé, la
    // couche orthographe seule. Rien du texte n'est journalisé.
    normalize: async ({ admin, organizationId, engine, text }) => {
      if (engine !== 'v2') return null;
      const [{ data: org }, dictionnaire] = await Promise.all([
        admin.from('organizations').select('industry').eq('id', organizationId).maybeSingle(),
        chargerTermesOrganisation(admin, organizationId),
      ]);
      const industry = (org as { industry?: string | null } | null)?.industry ?? null;
      const termes = [...dictionnaire, ...glossaireDeBase(industry)];
      return normaliserTranscription({
        brut: text,
        termes,
        ...(openaiApiKey
          ? {
              proposer: async (promptSysteme: string, texte: string) =>
                (
                  await createChatCompletion({
                    apiKey: openaiApiKey,
                    systemPrompt: promptSysteme,
                    history: [],
                    query: texte,
                  })
                ).content,
            }
          : {}),
      });
    },
    // Le résumé compte une requête IA de l'organisation, réservée comme une
    // conversation Workspace ; sans quota ou sans clé, la transcription part
    // sans résumé.
    //
    // En v2, le résumé est structuré (points clés, décisions, actions, chacun
    // citant ses paragraphes) et le Markdown de la page en est dérivé. Si le
    // modèle ne rend pas la forme attendue, on retombe sur le résumé libre —
    // un second appel, compté dans la même réservation.
    summarize: async ({ admin, organizationId, userId, engine, transcript, segments }) => {
      if (!openaiApiKey || !userId || transcript.trim().length === 0) return null;
      const reservation = await reserveAiUsage(admin, organizationId, userId, 'workspace');
      if (!reservation) return null;
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        let markdown: string | null = null;
        let structured = null;
        if (engine === 'v2' && segments.length > 0) {
          const structure = await createChatCompletion({
            apiKey: openaiApiKey,
            systemPrompt: promptResumeStructure(),
            history: [],
            query: requeteResume(segments),
          });
          inputTokens += structure.inputTokens;
          outputTokens += structure.outputTokens;
          structured = lireResume(structure.content, segments);
          if (structured) markdown = resumeEnMarkdown(structured);
        }
        if (markdown === null) {
          const completion = await createChatCompletion({
            apiKey: openaiApiKey,
            systemPrompt: summaryPrompt(),
            history: [],
            query: summaryQuery(transcript),
          });
          inputTokens += completion.inputTokens;
          outputTokens += completion.outputTokens;
          markdown = completion.content;
        }
        await finalizeAiUsage({
          admin,
          reservationId: reservation.id,
          organizationId,
          userId,
          inputTokens,
          outputTokens,
        });
        return { markdown, structured };
      } catch (failure) {
        console.error('transcription-worker: résumé impossible', failure);
        await releaseAiUsage(admin, reservation.id, organizationId, userId);
        return null;
      }
    },
  }),
);
