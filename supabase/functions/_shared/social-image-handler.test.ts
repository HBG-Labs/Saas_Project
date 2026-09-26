import { assert, assertEquals } from 'jsr:@std/assert';

import { MockSocialImageProvider, type SocialImageProvider } from './social-image-provider.ts';
import {
  createSocialImageGenerateHandler,
  type SocialImagePostState,
  type SocialImageStore,
} from './social-image-handler.ts';

const ORG = '00000000-0000-4000-8000-000000000360';
const USER = '00000000-0000-4000-8000-000000000001';
const POST = '00000000-0000-4000-8000-00000000aa01';
const WEEK = '00000000-0000-4000-8000-00000000bb01';

class TinyProvider implements SocialImageProvider {
  readonly id = 'tiny';
  readonly model = 'tiny-image';

  constructor(private readonly countOffset = 0) {}

  async generatePostImages(input: Parameters<SocialImageProvider['generatePostImages']>[0]) {
    const variants = Array.from({ length: input.variantCount + this.countOffset }, (_, index) => ({
      index: index + 1,
      bytes: new Uint8Array([1, 2, 3, index + 1]),
      mimeType: 'image/png' as const,
      width: 64,
      height: 64,
      altText: `Mock image ${index + 1}`,
      originalFilename: `mock-${index + 1}.png`,
      promptSummary: 'prompt omitted from audits',
    }));
    return {
      provider: this.id,
      model: this.model,
      generatorVersion: 'test-image-v1',
      usage: {
        variantCount: variants.length,
        promptChars: 42,
        estimatedCost: 0,
        latencyMs: 1,
      },
      variants,
    };
  }
}

function post(overrides: Partial<SocialImagePostState> = {}): SocialImagePostState {
  return {
    id: POST,
    organizationId: ORG,
    weekId: WEEK,
    startsOn: '2026-09-28',
    slotIndex: 1,
    status: 'draft',
    hook: 'Le chantier est fini. Le suivi commence.',
    visualText: 'Moins de flou. Plus de terrain.',
    visualConcept:
      'Composition editoriale minimaliste, typographie forte, bleu REZO360 discret, scene terrain credible.',
    caption: 'Une legende naturelle pour REZO360.',
    cta: 'Voir REZO360',
    objective: 'Visites du profil',
    audience: 'Artisans',
    ...overrides,
  };
}

function request(body: unknown, token = 'jwt') {
  return new Request('https://project.supabase.co/functions/v1/social-image-generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setup(options: {
  auth?: boolean;
  authorized?: boolean;
  provider?: SocialImageProvider;
  post?: SocialImagePostState | null;
  assets?: Array<{ id: string; kind: string; position: number }>;
  reservation?: 'reserved' | 'in_progress' | 'limit_reached';
  insertFails?: boolean;
} = {}) {
  const calls = {
    provider: 0,
    uploaded: [] as string[],
    inserted: [] as unknown[],
    removed: [] as string[][],
    finalized: [] as unknown[],
    audits: [] as Record<string, unknown>[],
  };
  const provider = options.provider ?? new TinyProvider();
  const wrappedProvider: SocialImageProvider = {
    id: provider.id,
    model: provider.model,
    generatePostImages: async (input) => {
      calls.provider += 1;
      return provider.generatePostImages(input);
    },
  };

  const store: SocialImageStore = {
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
    loadPost: async () => (options.post === undefined ? post() : options.post),
    listAssets: async () =>
      (options.assets ?? []).map((asset) => ({
        id: asset.id,
        postId: POST,
        kind: asset.kind,
        position: asset.position,
        storagePath: `org/generated/${asset.id}.png`,
        provider: 'mock',
      })),
    reserveGeneration: async () => ({
      status: options.reservation ?? 'reserved',
      usageId: options.reservation === 'reserved' || options.reservation === undefined ? 'usage-id' : null,
      startsOn: '2026-09-28',
      usedBefore: 0,
      remainingAfter: 20,
    }),
    uploadImage: async ({ variant }) => {
      const path = `${ORG}/social-studio/generated/${POST}/generation/variant-${variant.index}.png`;
      calls.uploaded.push(path);
      return path;
    },
    insertGeneratedAssets: async (input) => {
      calls.inserted.push(input);
      if (options.insertFails) throw new Error('insert failed');
      return input.variants.map(({ storagePath, position }, index) => ({
        id: `asset-${index + 1}`,
        storagePath,
        position,
      }));
    },
    removeStorageObjects: async (paths) => {
      calls.removed.push(paths);
    },
    finalizeUsage: async (input) => {
      calls.finalized.push(input);
    },
    audit: async (input) => {
      calls.audits.push(input);
    },
  };

  const handler = createSocialImageGenerateHandler({
    store,
    provider: wrappedProvider,
    env: { weeklyGenerationLimit: '21' },
    randomId: () => '00000000-0000-4000-8000-00000000feed',
    now: () => new Date('2026-09-26T12:00:00.000Z'),
  });

  return { handler, calls, store };
}

const BODY = { organizationId: ORG, postId: POST, variantCount: 3 };

Deno.test('MockSocialImageProvider genere trois variantes image privees', async () => {
  const state = post();
  const result = await new MockSocialImageProvider().generatePostImages({
    post: {
      organizationId: state.organizationId,
      postId: state.id,
      slotIndex: state.slotIndex,
      hook: state.hook ?? '',
      visualText: state.visualText ?? '',
      visualConcept: state.visualConcept ?? '',
      caption: state.caption ?? '',
      cta: state.cta,
      objective: state.objective,
      audience: state.audience,
    },
    variantCount: 3,
  });

  assertEquals(result.variants.length, 3);
  assertEquals(result.provider, 'mock');
  assert(result.variants.every((variant) => variant.mimeType === 'image/png'));
  assert(result.variants.every((variant) => variant.bytes.byteLength > 1000));
});

Deno.test('social-image-generate exige auth et social.manage', async () => {
  const unauthenticated = setup({ auth: false });
  assertEquals((await unauthenticated.handler(request(BODY))).status, 401);

  const forbidden = setup({ authorized: false });
  assertEquals((await forbidden.handler(request(BODY))).status, 403);
});

Deno.test('social-image-generate ne bascule pas silencieusement vers mock', async () => {
  const { store } = setup();
  const noProviderHandler = createSocialImageGenerateHandler({
    store,
    env: {},
  });

  const response = await noProviderHandler(request(BODY));
  assertEquals(response.status, 503);
});

Deno.test('social-image-generate cree trois assets sans publier ni scheduler', async () => {
  const { handler, calls } = setup();
  const response = await handler(request(BODY));
  const payload = await response.json();

  assertEquals(response.status, 200);
  assertEquals(payload.status, 'generated');
  assertEquals(payload.assetsCount, 3);
  assertEquals(calls.provider, 1);
  assertEquals(calls.uploaded.length, 3);
  assertEquals(calls.inserted.length, 1);
  assertEquals(calls.finalized.length, 1);
  assertEquals(calls.audits.map((audit) => audit.action), [
    'social.image_generation_started',
    'social.image_generation_completed',
  ]);
  assert(!JSON.stringify(calls.audits).includes('prompt omitted from audits'));
});

Deno.test('social-image-generate est idempotent quand des variantes existent deja', async () => {
  const { handler, calls } = setup({
    assets: [
      { id: 'asset-1', kind: 'generated', position: 1 },
      { id: 'asset-2', kind: 'generated', position: 2 },
      { id: 'asset-3', kind: 'selected', position: 3 },
    ],
  });
  const response = await handler(request(BODY));
  const payload = await response.json();

  assertEquals(response.status, 200);
  assertEquals(payload.status, 'existing');
  assertEquals(calls.provider, 0);
});

Deno.test('social-image-generate bloque concurrence et quota avant provider', async () => {
  const inProgress = setup({ reservation: 'in_progress' });
  assertEquals((await inProgress.handler(request(BODY))).status, 409);
  assertEquals(inProgress.calls.provider, 0);

  const limit = setup({ reservation: 'limit_reached' });
  assertEquals((await limit.handler(request(BODY))).status, 429);
  assertEquals(limit.calls.provider, 0);
});

Deno.test('social-image-generate refuse une sortie provider incomplete', async () => {
  const { handler, calls } = setup({ provider: new TinyProvider(-1) });
  const response = await handler(request(BODY));

  assertEquals(response.status, 502);
  assertEquals(calls.uploaded.length, 0);
  assertEquals(calls.finalized.length, 1);
  assert(JSON.stringify(calls.finalized).includes('invalid_response'));
});

Deno.test('social-image-generate nettoie Storage si insertion asset echoue', async () => {
  const { handler, calls } = setup({ insertFails: true });
  const response = await handler(request(BODY));

  assertEquals(response.status, 502);
  assertEquals(calls.uploaded.length, 3);
  assertEquals(calls.removed.length, 1);
  assertEquals(calls.removed[0]?.length, 3);
  assertEquals(calls.finalized.length, 1);
});
