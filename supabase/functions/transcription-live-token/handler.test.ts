import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  LIVE_FALLBACK_MODEL,
  LIVE_MODEL,
  createLiveTokenHandler,
  sessionConfig,
  type LiveTokenConfig,
} from './handler.ts';

/*
  Ce qui est vérifié : sans session, rien ; la porte de la base décide, avec
  son motif ; la configuration envoyée à OpenAI porte le contexte de
  l'organisation (prompt, mots-clés, langue) et le bon modèle ; la réponse ne
  contient jamais la clé OpenAI ; la délivrance est tracée sans texte ; un
  OpenAI en panne ne renseigne rien.
*/

const ORG = '11111111-1111-4111-8111-111111111111';
const PAGE = '22222222-2222-4222-8222-222222222222';

function fabriquer(overrides: {
  acces?: {
    allowed: boolean;
    reason: string | null;
    industry: string | null;
    language: string | null;
  } | null;
  createClientSecret?: LiveTokenConfig['createClientSecret'];
  authenticate?: LiveTokenConfig['authenticate'];
}) {
  const traces: Array<Record<string, unknown>> = [];
  const sessions: Array<Record<string, unknown>> = [];
  const acces =
    overrides.acces === undefined
      ? { allowed: true, reason: null, industry: 'fiber_telecom', language: 'fr' }
      : overrides.acces;
  const callerClient = () =>
    ({
      rpc: () => ({ maybeSingle: () => Promise.resolve({ data: acces, error: null }) }),
    }) as unknown as SupabaseClient;
  const admin = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        traces.push({ table, ...row });
        return Promise.resolve({ error: null });
      },
    }),
  } as unknown as SupabaseClient;
  const config: LiveTokenConfig = {
    admin,
    callerClient,
    authenticate: overrides.authenticate ?? (() => Promise.resolve({ userId: 'user-1' })),
    loadContext: () =>
      Promise.resolve({ prompt: 'Enregistrement de terrain… Caraïbe Télécom, PTO, PBO' }),
    createClientSecret:
      overrides.createClientSecret ??
      ((session) => {
        sessions.push(session);
        return Promise.resolve({ value: 'ek_test_123', expiresAt: 1_800_000_060 });
      }),
  };
  return { handler: createLiveTokenHandler(config), traces, sessions };
}

const requete = (body: unknown, auth = 'Bearer jwt-ok') =>
  new Request('https://x/functions/v1/transcription-live-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  });

Deno.test('sans session : 401, sans rien demander à la base ni à OpenAI', async () => {
  const f = fabriquer({});
  const r1 = await f.handler(requete({ organizationId: ORG, pageId: PAGE }, ''));
  assertEquals(r1.status, 401);
  const g = fabriquer({ authenticate: () => Promise.resolve(null) });
  const r2 = await g.handler(requete({ organizationId: ORG, pageId: PAGE }));
  assertEquals(r2.status, 401);
  assertEquals(g.sessions.length, 0);
  assertEquals(g.traces.length, 0);
});

Deno.test('un corps sans identifiants valides : 400', async () => {
  const f = fabriquer({});
  const r = await f.handler(requete({ organizationId: 'x', pageId: PAGE }));
  assertEquals(r.status, 400);
});

Deno.test('la porte ferme : le motif est rendu, rien n’est demandé à OpenAI', async () => {
  for (const [reason, status] of [
    ['membership', 404],
    ['page', 404],
    ['engine', 403],
    ['quota', 403],
    ['permission', 403],
  ] as const) {
    const f = fabriquer({ acces: { allowed: false, reason, industry: null, language: null } });
    const r = await f.handler(requete({ organizationId: ORG, pageId: PAGE }));
    assertEquals(r.status, status, reason);
    const corps = (await r.json()) as { reason: string };
    assertEquals(corps.reason, reason);
    assertEquals(f.sessions.length, 0);
    assertEquals(f.traces.length, 0);
  }
});

Deno.test('la porte ouvre : jeton rendu, session avec le contexte, trace sans texte', async () => {
  const f = fabriquer({});
  const r = await f.handler(requete({ organizationId: ORG, pageId: PAGE }));
  assertEquals(r.status, 200);
  const corps = (await r.json()) as { token: string; expiresAt: number; model: string };
  assertEquals(corps, { token: 'ek_test_123', expiresAt: 1_800_000_060, model: LIVE_MODEL });

  const session = f.sessions[0] as {
    type: string;
    audio: {
      input: {
        transcription: Record<string, unknown>;
        turn_detection: { type: string };
        noise_reduction: { type: string };
      };
    };
  };
  assertEquals(session.type, 'transcription');
  assertEquals(session.audio.input.transcription.model, LIVE_MODEL);
  assertStringIncludes(String(session.audio.input.transcription.prompt), 'Caraïbe Télécom');
  assertEquals(session.audio.input.transcription.language, 'fr');
  // Seulement les champs que la documentation liste : un champ inconnu fait
  // refuser toute la session (cas vécu avec `keywords`, 22/09).
  assertEquals(Object.keys(session.audio.input.transcription).sort(), [
    'language',
    'model',
    'prompt',
  ]);
  assertEquals(session.audio.input.turn_detection.type, 'server_vad');
  assertEquals(session.audio.input.noise_reduction.type, 'near_field');

  assertEquals(f.traces, [
    {
      table: 'transcription_live_sessions',
      organization_id: ORG,
      user_id: 'user-1',
      page_id: PAGE,
      model: LIVE_MODEL,
    },
  ]);
  assert(!JSON.stringify(corps).includes('sk-'), 'jamais la clé OpenAI');
});

Deno.test('OpenAI refuse le modèle du direct : repli sur celui de la finale', async () => {
  const essais: string[] = [];
  const f = fabriquer({
    createClientSecret: (session) => {
      const model = String(
        (session as { audio: { input: { transcription: { model: string } } } }).audio.input
          .transcription.model,
      );
      essais.push(model);
      if (model === LIVE_MODEL) return Promise.reject(new Error('400 model_not_found param=model'));
      return Promise.resolve({ value: 'ek_fallback', expiresAt: 1 });
    },
  });
  const r = await f.handler(requete({ organizationId: ORG, pageId: PAGE }));
  assertEquals(r.status, 200);
  assertEquals(essais, [LIVE_MODEL, LIVE_FALLBACK_MODEL]);
  assertEquals(((await r.json()) as { model: string }).model, LIVE_FALLBACK_MODEL);
  assertEquals(f.traces[0]?.model, LIVE_FALLBACK_MODEL);
});

Deno.test('OpenAI refuse tout : 503 avec le code, sans le prompt, et sans trace', async () => {
  const f = fabriquer({
    createClientSecret: () =>
      Promise.reject(new Error('400 invalid_value param=session.audio.input.transcription')),
  });
  const r = await f.handler(requete({ organizationId: ORG, pageId: PAGE }));
  assertEquals(r.status, 503);
  const corps = (await r.json()) as { reason: string; code: string; error: string };
  assertEquals(corps.reason, 'openai');
  assertStringIncludes(corps.code, 'invalid_value');
  assert(!JSON.stringify(corps).includes('Caraïbe'), 'le prompt ne sort pas');
  assertEquals(f.traces.length, 0);
});

Deno.test('la configuration porte le modèle demandé', () => {
  const s = sessionConfig({ prompt: 'p', language: 'fr', model: LIVE_FALLBACK_MODEL }) as {
    audio: { input: { transcription: { model: string } } };
  };
  assertEquals(s.audio.input.transcription.model, LIVE_FALLBACK_MODEL);
});
