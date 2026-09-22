import { adminClient, callerClient } from '../_shared/billing.ts';
import { chargerTermesOrganisation } from '../_shared/stt-context.ts';
import { construirePromptStt } from '../_shared/stt-glossary.ts';
import { TOKEN_TTL_SECONDS, createLiveTokenHandler } from './handler.ts';

/**
 * Délivre un jeton éphémère OpenAI Realtime pour le direct. Session Supabase
 * obligatoire (verify_jwt par défaut) ; la clé OpenAI reste ici.
 */
const admin = adminClient();
const openaiApiKey = Deno.env.get('OPENAI_API_KEY') ?? '';

Deno.serve(
  createLiveTokenHandler({
    admin,
    callerClient: (jwt) => callerClient(`Bearer ${jwt}`),
    authenticate: async (jwt) => {
      const { data, error } = await admin.auth.getUser(jwt);
      return error || !data.user ? null : { userId: data.user.id };
    },
    // Le même contexte que la finale : le dictionnaire en tête, puis le
    // glossaire du secteur ; les termes du dictionnaire aussi en mots-clés.
    loadContext: async (client, organizationId, industry) => {
      const termes = await chargerTermesOrganisation(client, organizationId);
      return { prompt: construirePromptStt({ industry, termesSupplementaires: termes }) };
    },
    createClientSecret: async (session) => {
      if (!openaiApiKey) throw new Error('OPENAI_API_KEY absente.');
      const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_after: { anchor: 'created_at', seconds: TOKEN_TTL_SECONDS },
          session,
        }),
      });
      if (!response.ok) {
        // Le code et le champ fautif, jamais le corps entier : il contient le prompt.
        const detail = (await response.json().catch(() => null)) as {
          error?: { code?: string; param?: string; message?: string };
        } | null;
        throw new Error(
          `${String(response.status)} ${detail?.error?.code ?? '?'} param=${detail?.error?.param ?? '?'} ${(detail?.error?.message ?? '').slice(0, 120)}`,
        );
      }
      const payload = (await response.json()) as { value?: string; expires_at?: number };
      if (!payload.value || typeof payload.expires_at !== 'number') {
        throw new Error('Réponse OpenAI sans jeton.');
      }
      return { value: payload.value, expiresAt: payload.expires_at };
    },
  }),
);
