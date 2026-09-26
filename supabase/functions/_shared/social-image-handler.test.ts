import { assert, assertEquals } from 'jsr:@std/assert';

import {
  MockImageGenerationProvider,
  SocialImageProviderError,
  generateRenderedSocialImage,
  type ImageGenerationProvider,
  type SocialImageGenerationInput,
} from './social-image-provider.ts';
import {
  createSocialImageGenerateHandler,
  generateSocialImagesForWeek,
  type SocialImagePostState,
  type SocialImageStore,
} from './social-image-handler.ts';

const ORG = '00000000-0000-4000-8000-000000000360';
const USER = '00000000-0000-4000-8000-000000000001';
const POST = '00000000-0000-4000-8000-00000000aa01';
const WEEK = '00000000-0000-4000-8000-00000000bb01';

function post(slotIndex = 1, overrides: Partial<SocialImagePostState> = {}): SocialImagePostState {
  return {
    id: `00000000-0000-4000-8000-00000000aa0${slotIndex}`,
    organizationId: ORG,
    weekId: WEEK,
    startsOn: '2026-09-28',
    slotIndex,
    status: 'draft',
    hook: `Hook terrain ${slotIndex}`,
    visualText: `Moins de flou. Plus de terrain ${slotIndex}.`,
    visualConcept:
      'Composition editoriale minimaliste, typographie forte, bleu REZO360 discret, scene terrain credible.',
    caption: 'Une legende naturelle pour REZO360.',
    cta: 'Voir REZO360',
    objective: 'Visites du profil',
    audience: 'Artisans',
    ...overrides,
  };
}

function weekPosts(overrides: Partial<SocialImagePostState>[] = []) {
  return Array.from({ length: 7 }, (_, index) => post(index + 1, overrides[index] ?? {}));
}

function request(body: unknown, token = 'jwt') {
  return new Request('https://project.supabase.co/functions/v1/social-image-generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

class CountingProvider extends MockImageGenerationProvider {
  calls = 0;

  override async generateBackground(input: SocialImageGenerationInput) {
    this.calls += 1;
    return super.generateBackground(input);
  }
}

class TemporaryFailureProvider extends MockImageGenerationProvider {
  calls = 0;

  override async generateBackground(input: SocialImageGenerationInput) {
    this.calls += 1;
    if (this.calls === 1) throw new SocialImageProviderError('rate limited', 'rate_limit');
    return super.generateBackground(input);
  }
}

class PermanentFailureProvider extends MockImageGenerationProvider {
  constructor(private readonly failingPostId: string) {
    super();
  }

  override async generateBackground(input: SocialImageGenerationInput) {
    if (input.post.postId === this.failingPostId) {
      throw new SocialImageProviderError('prompt refused', 'prompt_refused');
    }
    return super.generateBackground(input);
  }
}

class InvalidBackgroundProvider extends MockImageGenerationProvider {
  override async generateBackground(input: SocialImageGenerationInput) {
    const result = await super.generateBackground(input);
    return {
      ...result,
      background: { ...result.background, width: 64 },
    };
  }
}

function setup(options: {
  auth?: boolean;
  authorized?: boolean;
  provider?: ImageGenerationProvider;
  posts?: SocialImagePostState[];
  assets?: Array<{ postId: string; id: string; kind: string; position: number }>;
  reservation?: 'reserved' | 'in_progress' | 'limit_reached';
  insertFails?: boolean;
} = {}) {
  const posts = options.posts ?? [post()];
  const calls = {
    uploaded: [] as string[],
    inserted: [] as unknown[],
    removed: [] as string[][],
    finalized: [] as Record<string, unknown>[],
    audits: [] as Record<string, unknown>[],
    marked: [] as Record<string, unknown>[],
    maxActive: 0,
    active: 0,
  };
  const provider = options.provider ?? new CountingProvider();

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
    loadPost: async ({ postId }) => posts.find((item) => item.id === postId) ?? null,
    listWeekPosts: async () => posts,
    listAssets: async ({ postId }) =>
      (options.assets ?? [])
        .filter((asset) => asset.postId === postId)
        .map((asset) => ({
          id: asset.id,
          postId,
          kind: asset.kind,
          position: asset.position,
          storagePath: `org/generated/${asset.id}.png`,
          provider: 'mock',
        })),
    reserveGeneration: async () => ({
      status: options.reservation ?? 'reserved',
      usageId: options.reservation === 'reserved' || options.reservation === undefined ? crypto.randomUUID() : null,
      startsOn: '2026-09-28',
      usedBefore: 0,
      remainingAfter: 13,
    }),
    uploadImage: async ({ postId, variant }) => {
      calls.active += 1;
      calls.maxActive = Math.max(calls.maxActive, calls.active);
      const path = `${ORG}/social-studio/generated/${postId}/generation/final-${variant.index}.png`;
      calls.uploaded.push(path);
      calls.active -= 1;
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
    markPostImageStatus: async (input) => {
      calls.marked.push(input);
    },
    removeStorageObjects: async (paths) => {
      calls.removed.push(paths);
    },
    finalizeUsage: async (input) => {
      calls.finalized.push(input as unknown as Record<string, unknown>);
    },
    audit: async (input) => {
      calls.audits.push(input);
    },
  };

  const handler = createSocialImageGenerateHandler({
    store,
    provider,
    env: { weeklyGenerationLimit: '14', maxRetries: '2', maxConcurrency: '2' },
    randomId: () => crypto.randomUUID(),
    now: () => new Date('2026-09-26T12:00:00.000Z'),
  });

  return { handler, calls, store, provider };
}

Deno.test('SocialVisualRenderer produit un asset final 1080x1350 lisible', async () => {
  const state = post();
  const result = await generateRenderedSocialImage({
    provider: new MockImageGenerationProvider(),
    post: {
      organizationId: state.organizationId,
      postId: state.id,
      slotIndex: state.slotIndex,
      hook: state.hook ?? '',
      visualText: 'Le chantier est fini. Pas le suivi administratif.',
      visualConcept: state.visualConcept ?? '',
      caption: state.caption ?? '',
      cta: state.cta,
      objective: state.objective,
      audience: state.audience,
    },
  });

  assertEquals(result.variants.length, 1);
  assertEquals(result.variants[0]!.width, 1080);
  assertEquals(result.variants[0]!.height, 1350);
  assertEquals(result.variants[0]!.mimeType, 'image/png');
  assert(result.variants[0]!.render.safeZoneOk);
  assert(result.variants[0]!.render.contrastRatio >= 4.5);
});

Deno.test('social-image-generate exige auth et social.manage', async () => {
  const unauthenticated = setup({ auth: false });
  assertEquals((await unauthenticated.handler(request({ organizationId: ORG, postId: POST }))).status, 401);

  const forbidden = setup({ authorized: false });
  assertEquals((await forbidden.handler(request({ organizationId: ORG, postId: POST }))).status, 403);
});

Deno.test('social-image-generate ne bascule pas silencieusement vers mock', async () => {
  const { store } = setup();
  const noProviderHandler = createSocialImageGenerateHandler({ store, env: {} });
  const response = await noProviderHandler(request({ organizationId: ORG, postId: POST }));
  assertEquals(response.status, 503);
});

Deno.test('social-image-generate cree un asset final sans publier ni scheduler', async () => {
  const { handler, calls } = setup();
  const response = await handler(request({ organizationId: ORG, postId: POST }));
  const payload = await response.json();

  assertEquals(response.status, 200);
  assertEquals(payload.status, 'generated');
  assertEquals(payload.assetsCount, 1);
  assertEquals(calls.uploaded.length, 1);
  assertEquals(calls.inserted.length, 1);
  assertEquals(calls.marked.at(-1)?.status, 'ready');
  assertEquals(calls.audits.map((audit) => audit.action), [
    'social.image_generation_started',
    'social.image_generation_completed',
  ]);
});

Deno.test('generation semaine auto cree 7 assets avec concurrence limitee', async () => {
  const provider = new CountingProvider();
  const { store, calls } = setup({ provider, posts: weekPosts() });
  const result = await generateSocialImagesForWeek({
    store,
    provider,
    env: { weeklyGenerationLimit: '14', maxConcurrency: '2', maxRetries: '1' },
    organizationId: ORG,
    weekId: WEEK,
    userId: USER,
    now: () => new Date('2026-09-26T12:00:00.000Z'),
    randomId: () => crypto.randomUUID(),
  });

  assertEquals(result.total, 7);
  assertEquals(result.generated, 7);
  assertEquals(result.failed, 0);
  assertEquals(calls.uploaded.length, 7);
  assertEquals(calls.marked.filter((item) => item.status === 'ready').length, 7);
  assert(calls.maxActive <= 2);
  assertEquals(provider.calls, 7);
});

Deno.test('generation semaine auto conserve 6 ready et marque 1 failed', async () => {
  const posts = weekPosts();
  const failingPostId = posts[3]!.id;
  const { store, calls } = setup({
    provider: new PermanentFailureProvider(failingPostId),
    posts,
  });
  const result = await generateSocialImagesForWeek({
    store,
    provider: new PermanentFailureProvider(failingPostId),
    env: { weeklyGenerationLimit: '14', maxConcurrency: '2', maxRetries: '1' },
    organizationId: ORG,
    weekId: WEEK,
    userId: USER,
    now: () => new Date('2026-09-26T12:00:00.000Z'),
    randomId: () => crypto.randomUUID(),
  });

  assertEquals(result.total, 7);
  assertEquals(result.generated, 6);
  assertEquals(result.failed, 1);
  assertEquals(calls.marked.filter((item) => item.status === 'ready').length, 6);
  assertEquals(calls.marked.filter((item) => item.status === 'failed').length, 1);
});

Deno.test('generation visuelle retry les erreurs temporaires', async () => {
  const provider = new TemporaryFailureProvider();
  const { handler, calls } = setup({ provider });
  const response = await handler(request({ organizationId: ORG, postId: POST }));

  assertEquals(response.status, 200);
  assertEquals(provider.calls, 2);
  assertEquals(calls.marked.at(-1)?.status, 'ready');
});

Deno.test('generation visuelle bloque idempotence, quota et nettoie Storage', async () => {
  const existing = setup({
    assets: [{ postId: POST, id: 'asset-1', kind: 'selected', position: 1 }],
  });
  const existingResponse = await existing.handler(request({ organizationId: ORG, postId: POST }));
  assertEquals(existingResponse.status, 200);
  assertEquals((await existingResponse.json()).status, 'existing');
  assertEquals(existing.calls.uploaded.length, 0);

  const limit = setup({ reservation: 'limit_reached' });
  assertEquals((await limit.handler(request({ organizationId: ORG, postId: POST }))).status, 429);

  const cleanup = setup({ insertFails: true });
  assertEquals((await cleanup.handler(request({ organizationId: ORG, postId: POST, force: true }))).status, 502);
  assertEquals(cleanup.calls.removed[0]?.length, 1);
});

Deno.test('quality check refuse un background provider invalide', async () => {
  const { handler, calls } = setup({ provider: new InvalidBackgroundProvider() });
  const response = await handler(request({ organizationId: ORG, postId: POST, force: true }));

  assertEquals(response.status, 502);
  assertEquals(calls.uploaded.length, 0);
  assertEquals(calls.marked.at(-1)?.status, 'failed');
});
