import assert from 'node:assert/strict';

import {
  MockSocialAIProvider,
  SocialAIProviderError,
  SocialAIValidationError,
  validateSocialAIWeeklyContent,
  type SocialAIProvider,
  type SocialAIWeeklyContent,
  type SocialAIWeeklyInput,
  type SocialAIWeeklyResult,
} from './social-ai-provider.ts';
import {
  createSocialContentGenerateHandler,
  type SocialContentStore,
  type SocialContentWeekState,
  type SocialWeekVisualGenerator,
} from './social-content-handler.ts';

const ORG = '00000000-0000-4000-8000-000000000360';
const USER = '00000000-0000-4000-8000-000000000001';
const WEEK = '2026-09-28';

function generatedWeek(): SocialAIWeeklyContent {
  return {
    week_strategy: {
      primary_goal: 'Tester sept angles Instagram terrain pour attirer des prospects qualifies.',
      hypotheses: [
        'Les situations de flou operationnel devraient mieux arreter le scroll.',
        'Les hooks tres courts devraient generer plus de lectures completes.',
      ],
      audience_focus: ['Artisans', 'TPE terrain', 'PME de maintenance'],
      experiments: ['probleme concret', 'produit', 'interaction', 'vision de marque'],
      notes: ['Mode exploration : aucune optimisation analytics n’est revendiquee.'],
    },
    posts: Array.from({ length: 7 }, (_, index) => {
      const day = index + 1;
      return {
        day,
        planned_time: day === 3 ? '12:15' : '18:30',
        objective: day % 2 === 0 ? 'Visites du profil' : 'Abonnes qualifies',
        audience: day % 2 === 0 ? 'Artisans' : 'TPE terrain',
        angle: `Angle terrain ${day} sur l’organisation des interventions`,
        hook: `Le chantier est fini. Le suivi commence ${day}.`,
        visual_text: `Moins de flou. Plus de terrain ${day}.`,
        visual_concept:
          'Composition publicitaire editoriale minimaliste, grand espace negatif, typographie massive, touche bleu REZO360 #1B44C8, scene terrain abstraite mais credible, aucun telephone flottant generique.',
        caption:
          `Quand les informations restent dispersees, le bureau et le terrain perdent le fil. ` +
          `REZO360 aide a garder une semaine lisible sans transformer l’equipe en administrateurs. Post ${day}.`,
        cta: day % 2 === 0 ? 'Voir le profil REZO360' : 'Preparer une semaine plus claire',
        hashtags: day === 7 ? [] : ['#terrain', '#organisation'],
        reasoning_summary: `Teste un angle distinct pour mesurer l’interet qualifie sans inventer de performance.`,
      };
    }),
  };
}

function request(body: unknown, token = 'jwt') {
  return new Request('https://project.supabase.co/functions/v1/social-content-generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setup(options: {
  auth?: boolean;
  authorized?: boolean;
  existingWeek?: SocialContentWeekState | null;
  reserve?: boolean;
  provider?: SocialAIProvider;
  visualGenerator?: SocialWeekVisualGenerator;
} = {}) {
  const calls = {
    createdWeeks: [] as Record<string, unknown>[],
    deletedWeeks: [] as Record<string, unknown>[],
    reserved: [] as Record<string, unknown>[],
    finalized: [] as Record<string, unknown>[],
    inserted: [] as Record<string, unknown>[],
    audits: [] as Record<string, unknown>[],
    recentLoaded: 0,
  };
  const provider = options.provider ?? new MockSocialAIProvider(generatedWeek());
  let weekCreated = false;

  const store: SocialContentStore = {
    authenticate: async () => (options.auth === false ? null : { userId: USER }),
    authorizeGeneration: async () =>
      options.authorized === false
        ? {
            ok: false,
            status: 403,
            code: 'SOCIAL_MANAGE_REQUIRED',
            message: 'Permission manquante.',
          }
        : { ok: true, context: { userId: USER, role: 'manager' } },
    findWeek: async () => {
      if (options.existingWeek !== undefined) return options.existingWeek;
      if (!weekCreated) return null;
      return {
        weekId: 'week-generated',
        postsCount: 0,
        strategy: {
          source: 'social_studio_ai',
          generation_status: 'processing',
          generation_id: 'generation-id',
          started_at: '2026-09-26T12:00:00.000Z',
        },
        createdAt: '2026-09-26T12:00:00.000Z',
      };
    },
    createGenerationWeek: async (input) => {
      calls.createdWeeks.push(input);
      weekCreated = true;
      return { created: true, weekId: 'week-generated' };
    },
    deleteGenerationWeek: async (input) => {
      calls.deletedWeeks.push(input);
    },
    reserveGeneration: async (input) => {
      calls.reserved.push(input);
      if (options.reserve === false) return null;
      return { usageId: 'usage-id', usedBefore: 0, remainingAfter: 2 };
    },
    finalizeUsage: async (input) => {
      calls.finalized.push(input);
    },
    loadRecentContent: async () => {
      calls.recentLoaded += 1;
      return [
        {
          hook: 'Ancien hook terrain',
          angle: 'Ancien angle planning',
          cta: 'Ancien CTA',
          audience: 'Artisans',
          objective: 'Visites du profil',
          visualConcept: 'Ancien brief visuel a ne pas repeter',
          createdAt: '2026-09-20T00:00:00.000Z',
        },
      ];
    },
    insertGeneratedContent: async (input) => {
      calls.inserted.push(input);
    },
    audit: async (input) => {
      calls.audits.push(input);
    },
  };

  const handler = createSocialContentGenerateHandler({
    store,
    provider,
    visualGenerator: options.visualGenerator,
    env: { weeklyGenerationLimit: '3' },
    randomId: () => '00000000-0000-4000-8000-00000000feed',
    now: () => new Date('2026-09-26T12:00:00.000Z'),
  });

  return { handler, calls, store };
}

Deno.test('SocialStudioAI valide exactement 7 posts structures', () => {
  assert.equal(validateSocialAIWeeklyContent(generatedWeek()).posts.length, 7);

  assert.throws(
    () => validateSocialAIWeeklyContent({ ...generatedWeek(), posts: generatedWeek().posts.slice(0, 5) }),
    SocialAIValidationError,
  );

  const generic = generatedWeek();
  generic.posts[0] = { ...generic.posts[0]!, hook: 'Optimisez votre activite' };
  assert.throws(() => validateSocialAIWeeklyContent(generic), SocialAIValidationError);
});

Deno.test('SocialStudioAI refuse les requetes sans auth et sans social.manage', async () => {
  const unauth = setup({ auth: false });
  assert.equal((await unauth.handler(request({ organizationId: ORG, startsOn: WEEK, timezoneOffsetMinutes: 240 }))).status, 401);

  const forbidden = setup({ authorized: false });
  assert.equal((await forbidden.handler(request({ organizationId: ORG, startsOn: WEEK, timezoneOffsetMinutes: 240 }))).status, 403);
});

Deno.test('SocialStudioAI ne bascule pas vers mock quand aucun provider reel n’est configure', async () => {
  const { calls, store } = setup();
  const noProviderHandler = createSocialContentGenerateHandler({
    store,
    env: {},
  });

  const res = await noProviderHandler(request({ organizationId: ORG, startsOn: WEEK, timezoneOffsetMinutes: 240 }));

  assert.equal(res.status, 503);
  assert.equal(calls.inserted.length, 0);
});

Deno.test('SocialStudioAI genere une semaine en un seul appel provider et insere 7 brouillons', async () => {
  let providerCalls = 0;
  const providerInputs: SocialAIWeeklyInput[] = [];
  const provider: SocialAIProvider = {
    id: 'mock',
    model: 'mock-social-studio-ai',
    async generateWeeklyContent(input) {
      providerCalls += 1;
      providerInputs.push(input);
      const content = validateSocialAIWeeklyContent(generatedWeek());
      return {
        content,
        provider: 'mock',
        model: 'mock-social-studio-ai',
        generatorVersion: 'social-weekly-text-v1',
        usage: { inputTokens: 1200, outputTokens: 2200, estimatedCost: 0, latencyMs: 42 },
      };
    },
  };
  const { handler, calls } = setup({ provider });

  const res = await handler(request({ organizationId: ORG, startsOn: WEEK, timezoneOffsetMinutes: 240 }));
  const body = (await res.json()) as { status: string; postsCount: number };

  assert.equal(res.status, 200);
  assert.equal(body.status, 'generated');
  assert.equal(body.postsCount, 7);
  assert.equal(providerCalls, 1);
  assert.equal(providerInputs[0]?.recentContent[0]?.hook, 'Ancien hook terrain');
  assert.equal(providerInputs[0]?.performanceContext, undefined);
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.finalized.at(-1)?.status, 'success');
  assert.equal(JSON.stringify(calls.audits).includes('prompt'), false);
});

Deno.test('SocialStudioAI declenche la generation visuelle automatique de la semaine', async () => {
  let visualCalls = 0;
  const visualGenerator: SocialWeekVisualGenerator = {
    async generate(input) {
      visualCalls += 1;
      assert.equal(input.organizationId, ORG);
      assert.equal(input.weekId, 'week-generated');
      assert.equal(input.userId, USER);
      return { total: 7, generated: 7, existing: 0, failed: 0 };
    },
  };
  const { handler, calls } = setup({ visualGenerator });

  const res = await handler(request({ organizationId: ORG, startsOn: WEEK, timezoneOffsetMinutes: 240 }));
  const body = (await res.json()) as {
    status: string;
    visualGeneration: { total: number; generated: number; existing: number; failed: number } | null;
  };

  assert.equal(res.status, 200);
  assert.equal(body.status, 'generated');
  assert.equal(visualCalls, 1);
  assert.deepEqual(body.visualGeneration, { total: 7, generated: 7, existing: 0, failed: 0 });
  assert.equal(calls.deletedWeeks.length, 0);
});

Deno.test('SocialStudioAI conserve la semaine si le moteur visuel echoue', async () => {
  const visualGenerator: SocialWeekVisualGenerator = {
    async generate() {
      throw new Error('visual provider unavailable');
    },
  };
  const { handler, calls } = setup({ visualGenerator });

  const res = await handler(request({ organizationId: ORG, startsOn: WEEK, timezoneOffsetMinutes: 240 }));
  const body = (await res.json()) as {
    visualGeneration: { total: number; generated: number; existing: number; failed: number } | null;
  };

  assert.equal(res.status, 200);
  assert.deepEqual(body.visualGeneration, { total: 7, generated: 0, existing: 0, failed: 7 });
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.deletedWeeks.length, 0);
  assert.equal(calls.finalized.at(-1)?.status, 'success');
  assert.equal(
    calls.audits.some((audit) => audit.action === 'social.image_week_generation_failed'),
    true,
  );
});

Deno.test('SocialStudioAI est idempotent quand la semaine existe deja', async () => {
  const { handler, calls } = setup({
    existingWeek: {
      weekId: 'existing-week',
      postsCount: 7,
      strategy: { source: 'social_studio_ai' },
      createdAt: '2026-09-26T12:00:00.000Z',
    },
  });

  const res = await handler(request({ organizationId: ORG, startsOn: WEEK, timezoneOffsetMinutes: 240 }));
  const body = (await res.json()) as { status: string; weekId: string };

  assert.equal(res.status, 200);
  assert.equal(body.status, 'existing');
  assert.equal(body.weekId, 'existing-week');
  assert.equal(calls.createdWeeks.length, 0);
  assert.equal(calls.inserted.length, 0);
});

Deno.test('SocialStudioAI bloque le quota interne avant appel provider', async () => {
  let providerCalls = 0;
  const provider: SocialAIProvider = {
    id: 'mock',
    model: 'mock',
    async generateWeeklyContent() {
      providerCalls += 1;
      return new MockSocialAIProvider(generatedWeek()).generateWeeklyContent();
    },
  };
  const { handler, calls } = setup({ reserve: false, provider });

  const res = await handler(request({ organizationId: ORG, startsOn: WEEK, timezoneOffsetMinutes: 240 }));

  assert.equal(res.status, 429);
  assert.equal(providerCalls, 0);
  assert.equal(calls.deletedWeeks.length, 1);
});

Deno.test('SocialStudioAI nettoie la semaine si le provider echoue', async () => {
  const provider: SocialAIProvider = {
    id: 'mock',
    model: 'mock',
    async generateWeeklyContent() {
      throw new SocialAIProviderError('provider down', 'provider_error');
    },
  };
  const { handler, calls } = setup({ provider });

  const res = await handler(request({ organizationId: ORG, startsOn: WEEK, timezoneOffsetMinutes: 240 }));

  assert.equal(res.status, 502);
  assert.equal(calls.inserted.length, 0);
  assert.equal(calls.deletedWeeks.length, 1);
  assert.equal(calls.finalized.at(-1)?.status, 'provider_error');
});

Deno.test('SocialStudioAI refuse une sortie invalide sans creer de semaine partielle', async () => {
  const provider: SocialAIProvider = {
    id: 'mock',
    model: 'mock',
    async generateWeeklyContent() {
      throw new SocialAIValidationError('5 posts seulement', {
        provider: 'mock',
        model: 'mock',
        usage: { inputTokens: 100, outputTokens: 200, estimatedCost: 0, latencyMs: 5 },
      });
    },
  };
  const { handler, calls } = setup({ provider });

  const res = await handler(request({ organizationId: ORG, startsOn: WEEK, timezoneOffsetMinutes: 240 }));

  assert.equal(res.status, 502);
  assert.equal(calls.inserted.length, 0);
  assert.equal(calls.deletedWeeks.length, 1);
  assert.equal(calls.finalized.at(-1)?.status, 'invalid_response');
  assert.equal((calls.finalized.at(-1)?.result as SocialAIWeeklyResult | undefined)?.usage?.inputTokens, 100);
});
