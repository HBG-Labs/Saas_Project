import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import { CORS_HEADERS, json } from '../_shared/billing.ts';

/**
 * Le jeton éphémère du direct (STT phase 14).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE FONCTION FAIT, ET NE FAIT PAS
 *
 * Le téléphone veut ouvrir une connexion WebRTC directe vers OpenAI Realtime
 * pour voir le texte tomber pendant qu'on parle. Il ne doit JAMAIS voir la
 * clé OpenAI. OpenAI prévoit pour ça un jeton éphémère (`client_secrets`)
 * qui porte la configuration de session et expire vite.
 *
 * Ici, dans l'ordre : la session Supabase est valide ; la base dit oui
 * (`live_transcription_access` : membre, permission, module, page visible,
 * moteur v2, quota) ; on charge le contexte de l'organisation (glossaire du
 * secteur, dictionnaire) — le même que la finale ; on demande le jeton à
 * OpenAI avec cette configuration ; on trace la délivrance (organisation,
 * personne, page, modèle — jamais de texte) ; on rend le jeton et son
 * expiration. Rien d'autre : pas d'audio, pas de texte, pas d'écriture dans
 * la page. Le worker et la page ne connaissent pas cette fonction.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const LIVE_MODEL = 'gpt-live-transcribe';
/** Si le compte n'a pas accès au modèle du direct, celui de la finale sait aussi streamer. */
export const LIVE_FALLBACK_MODEL = 'gpt-transcribe';
/** Le jeton sert à ouvrir la connexion, pas à la tenir : une minute suffit. */
export const TOKEN_TTL_SECONDS = 60;

export interface LiveTokenConfig {
  /** Rend l'identité de la session, ou `null` si elle est invalide. */
  authenticate: (jwt: string) => Promise<{ userId: string } | null>;
  /** Le client agissant AVEC le jeton de l'appelant (RLS). */
  callerClient: (jwt: string) => SupabaseClient;
  /** Le client service_role, pour le contexte et la trace. */
  admin: SupabaseClient;
  /** La phrase de contexte et les termes (dictionnaire) pour une organisation. */
  loadContext: (
    admin: SupabaseClient,
    organizationId: string,
    industry: string | null,
  ) => Promise<{ prompt: string }>;
  /**
   * Demande le jeton à OpenAI ; injecté pour tester sans réseau. Lève
   * `LiveTokenRefused` (avec le code d'OpenAI) sur un refus définitif.
   */
  createClientSecret: (session: Record<string, unknown>) => Promise<{
    value: string;
    expiresAt: number;
  }>;
  now?: () => Date;
}

interface Body {
  organizationId: string;
  pageId: string;
}

function lireCorps(raw: unknown): Body | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as { organizationId?: unknown; pageId?: unknown };
  const uuid = /^[0-9a-f-]{36}$/i;
  if (typeof o.organizationId !== 'string' || !uuid.test(o.organizationId)) return null;
  if (typeof o.pageId !== 'string' || !uuid.test(o.pageId)) return null;
  return { organizationId: o.organizationId, pageId: o.pageId };
}

/**
 * La configuration de session que porte le jeton — ce que le téléphone ne
 * peut pas changer. Seuls les champs que la documentation d'OpenAI liste
 * pour une session de transcription : un champ inconnu (`keywords`, essayé
 * le 22/09) fait refuser toute la session en 400.
 */
export function sessionConfig(params: {
  prompt: string;
  language: string;
  model?: string;
}): Record<string, unknown> {
  return {
    type: 'transcription',
    audio: {
      input: {
        noise_reduction: { type: 'near_field' },
        transcription: {
          model: params.model ?? LIVE_MODEL,
          prompt: params.prompt,
          language: params.language,
        },
        turn_detection: { type: 'server_vad', silence_duration_ms: 600 },
      },
    },
  };
}

export const REASON_MESSAGES: Record<string, string> = {
  membership: 'Accès non autorisé à cette organisation.',
  permission: "Vous n'avez pas la permission d'utiliser la transcription.",
  module: 'Le Workspace n’est pas inclus dans votre formule.',
  page: 'Page introuvable.',
  engine: 'Le direct n’est pas activé pour cette organisation.',
  quota: 'Quota de minutes de transcription insuffisant pour le direct.',
};

export function createLiveTokenHandler(config: LiveTokenConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authentification requise' }, 401);
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json({ error: 'Corps JSON invalide.' }, 400);
    }
    const body = lireCorps(raw);
    if (!body) return json({ error: 'organizationId et pageId sont requis.' }, 400);

    const identite = await config.authenticate(jwt);
    if (!identite) return json({ error: 'Session utilisateur invalide ou expirée.' }, 401);

    // La porte, côté base, avec les droits de l'appelant.
    const { data: acces, error: accesError } = await config
      .callerClient(jwt)
      .rpc('live_transcription_access', {
        p_organization_id: body.organizationId,
        p_page_id: body.pageId,
      })
      .maybeSingle();
    if (accesError || !acces) return json({ error: 'Vérification impossible.' }, 503);
    const porte = acces as {
      allowed: boolean;
      reason: string | null;
      industry: string | null;
      language: string | null;
    };
    if (!porte.allowed) {
      const reason = porte.reason ?? 'membership';
      const status = reason === 'membership' || reason === 'page' ? 404 : 403;
      return json({ error: REASON_MESSAGES[reason] ?? 'Direct refusé.', reason }, status);
    }

    const contexte = await config.loadContext(config.admin, body.organizationId, porte.industry);
    const langue = porte.language ?? 'fr';

    // Le modèle du direct, puis celui de la finale si le compte n'y a pas
    // accès. Le code du refus est journalisé (jamais le prompt ni le texte).
    let jeton: { value: string; expiresAt: number } | null = null;
    let modeleRetenu = LIVE_MODEL;
    let dernierCode = 'inconnu';
    for (const model of [LIVE_MODEL, LIVE_FALLBACK_MODEL]) {
      try {
        jeton = await config.createClientSecret(
          sessionConfig({ prompt: contexte.prompt, language: langue, model }),
        );
        modeleRetenu = model;
        break;
      } catch (echec) {
        dernierCode = echec instanceof Error ? echec.message.slice(0, 200) : 'inconnu';
        console.error('transcription-live-token: OpenAI a refusé', model, dernierCode);
      }
    }
    if (!jeton) {
      return json(
        {
          error: 'Le direct est indisponible pour le moment.',
          reason: 'openai',
          code: dernierCode,
        },
        503,
      );
    }

    const { error: traceError } = await config.admin.from('transcription_live_sessions').insert({
      organization_id: body.organizationId,
      user_id: identite.userId,
      page_id: body.pageId,
      model: modeleRetenu,
    });
    if (traceError) console.error('transcription-live-token: trace impossible', traceError.code);

    return json({ token: jeton.value, expiresAt: jeton.expiresAt, model: modeleRetenu });
  };
}
