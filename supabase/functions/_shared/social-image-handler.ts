import { CORS_HEADERS, json } from './billing.ts';
import {
  DEFAULT_SOCIAL_IMAGE_MODEL,
  DEFAULT_SOCIAL_IMAGE_PROVIDER,
  SocialImageProviderError,
  SocialImageValidationError,
  createConfiguredSocialImageProvider,
  generateRenderedSocialImage,
  validateSocialImageResult,
  type SocialGeneratedImageVariant,
  type SocialImageGenerationResult,
  type SocialImageProvider,
} from './social-image-provider.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_MAX_BYTES = 8_192;
const DEFAULT_WEEKLY_IMAGE_LIMIT = 14;
const DEFAULT_MAX_CONCURRENCY = 2;
const DEFAULT_MAX_RETRIES = 2;
const ALLOWED_POST_STATUSES = new Set(['draft', 'ready', 'failed']);

export interface SocialImageAccessContext {
  userId: string;
  role: string;
}

export interface SocialImagePostState {
  id: string;
  organizationId: string;
  weekId: string;
  startsOn: string;
  slotIndex: number;
  status: string;
  hook: string | null;
  visualText: string | null;
  visualConcept: string | null;
  caption: string | null;
  cta: string | null;
  objective: string | null;
  audience: string | null;
}

export interface SocialImageAssetState {
  id: string;
  postId: string;
  kind: string;
  position: number;
  storagePath: string;
  provider: string | null;
}

export interface SocialImageReservation {
  status: 'reserved' | 'in_progress' | 'limit_reached';
  usageId: string | null;
  startsOn: string;
  usedBefore: number;
  remainingAfter: number;
}

export interface StoredSocialImageAsset {
  id: string;
  storagePath: string;
  position: number;
}

export interface SocialImageStore {
  authenticate(authorization: string): Promise<{ userId: string } | null>;
  authorizeGeneration(input: {
    organizationId: string;
    userId: string;
  }): Promise<
    | { ok: true; context: SocialImageAccessContext }
    | { ok: false; status: number; code: string; message: string }
  >;
  loadPost(input: { organizationId: string; postId: string }): Promise<SocialImagePostState | null>;
  listWeekPosts(input: { organizationId: string; weekId: string }): Promise<SocialImagePostState[]>;
  listAssets(input: { organizationId: string; postId: string }): Promise<SocialImageAssetState[]>;
  reserveGeneration(input: {
    organizationId: string;
    userId: string;
    postId: string;
    generationId: string;
    provider: string;
    model: string;
    weeklyLimit: number;
  }): Promise<SocialImageReservation>;
  uploadImage(input: {
    organizationId: string;
    postId: string;
    generationId: string;
    variant: SocialGeneratedImageVariant;
  }): Promise<string>;
  insertGeneratedAssets(input: {
    organizationId: string;
    postId: string;
    userId: string;
    provider: string;
    variants: Array<{ variant: SocialGeneratedImageVariant; storagePath: string; position: number }>;
  }): Promise<StoredSocialImageAsset[]>;
  markPostImageStatus(input: {
    organizationId: string;
    postId: string;
    status: 'ready' | 'failed';
    lastError: string | null;
  }): Promise<void>;
  removeStorageObjects(paths: string[]): Promise<void>;
  finalizeUsage(input: {
    usageId: string;
    organizationId: string;
    status: 'success' | 'provider_error' | 'invalid_response' | 'timeout' | 'cancelled';
    result?: Pick<SocialImageGenerationResult, 'usage' | 'provider' | 'model'>;
    errorCode?: string;
    completedAt: string;
  }): Promise<void>;
  audit(input: {
    organizationId: string;
    userId: string | null;
    action: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface SocialImageGenerateEnv {
  provider?: string | null;
  model?: string | null;
  allowMock?: string | null;
  openaiApiKey?: string | null;
  quality?: string | null;
  weeklyGenerationLimit?: string | null;
  maxConcurrency?: string | null;
  maxRetries?: string | null;
}

export interface SocialImageGenerateHandlerOptions {
  store: SocialImageStore;
  env: SocialImageGenerateEnv;
  provider?: SocialImageProvider;
  now?: () => Date;
  randomId?: () => string;
}

interface ValidRequestBody {
  organizationId: string;
  postId: string;
  force: boolean;
}

function validateRequestBody(value: unknown): { ok: true; value: ValidRequestBody } | { ok: false; message: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, message: 'Corps de requete invalide.' };
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set(['organizationId', 'postId', 'force']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return { ok: false, message: 'Le corps contient des champs non autorises.' };
  }
  if (typeof body.organizationId !== 'string' || !UUID_PATTERN.test(body.organizationId)) {
    return { ok: false, message: "Identifiant d'organisation invalide." };
  }
  if (typeof body.postId !== 'string' || !UUID_PATTERN.test(body.postId)) {
    return { ok: false, message: 'Identifiant de publication invalide.' };
  }
  const force = body.force === undefined ? false : body.force;
  if (typeof force !== 'boolean') {
    return { ok: false, message: 'Le mode de regeneration est invalide.' };
  }
  return { ok: true, value: { organizationId: body.organizationId, postId: body.postId, force } };
}

function weeklyLimit(value: string | null | undefined): number {
  const parsed = Number(value ?? '');
  if (!Number.isInteger(parsed)) return DEFAULT_WEEKLY_IMAGE_LIMIT;
  return Math.min(Math.max(parsed, 1), 70);
}

function boundedInteger(value: string | null | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value ?? '');
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function configuredProvider(options: SocialImageGenerateHandlerOptions): SocialImageProvider | null {
  if (options.provider) return options.provider;
  return createConfiguredSocialImageProvider({
    provider: options.env.provider,
    model: options.env.model,
    allowMock: options.env.allowMock,
    openaiApiKey: options.env.openaiApiKey,
    quality: options.env.quality,
  });
}

function usableExistingAssets(assets: SocialImageAssetState[]) {
  return assets.filter((asset) => asset.kind === 'generated' || asset.kind === 'selected');
}

function firstAvailablePosition(assets: SocialImageAssetState[], variantCount = 1): number | null {
  const used = new Set(assets.map((asset) => asset.position));
  for (let start = 1; start <= 10 - variantCount + 1; start += 1) {
    if (Array.from({ length: variantCount }, (_, index) => start + index).every((position) => !used.has(position))) {
      return start;
    }
  }
  return null;
}

function validatePostForGeneration(post: SocialImagePostState): { ok: true } | { ok: false; status: number; message: string } {
  if (!ALLOWED_POST_STATUSES.has(post.status)) {
    return {
      ok: false,
      status: 409,
      message: 'Les visuels ne peuvent plus etre generes pour cette publication.',
    };
  }
  if (!post.visualText?.trim() || !post.visualConcept?.trim()) {
    return {
      ok: false,
      status: 422,
      message: 'Le texte visuel et le brief visuel sont requis avant la generation image.',
    };
  }
  return { ok: true };
}

function errorStatus(error: unknown): {
  status: 'provider_error' | 'invalid_response' | 'timeout' | 'cancelled';
  httpStatus: number;
  message: string;
  code: string;
} {
  if (error instanceof SocialImageValidationError) {
    return {
      status: 'invalid_response',
      httpStatus: 502,
      message: error.code === 'text_overflow'
        ? 'Le texte visuel est trop long pour produire une creation lisible.'
        : 'La reponse du moteur visuel Social Studio est invalide. Aucun asset n’a ete cree.',
      code: error.code,
    };
  }
  if (error instanceof SocialImageProviderError && error.code === 'timeout') {
    return {
      status: 'timeout',
      httpStatus: 504,
      message: 'La generation visuelle Social Studio a expire. Aucun asset n’a ete cree.',
      code: 'timeout',
    };
  }
  if (error instanceof SocialImageProviderError) {
    return {
      status: 'provider_error',
      httpStatus: 502,
      message: 'Le moteur visuel Social Studio est momentanement indisponible.',
      code: error.code,
    };
  }
  return {
    status: 'provider_error',
    httpStatus: 502,
    message: 'La generation visuelle est momentanement indisponible.',
    code: 'unknown',
  };
}

function retryable(error: unknown): boolean {
  return (
    error instanceof SocialImageProviderError &&
    ['timeout', 'rate_limit', 'server_error', 'temporary_unavailable'].includes(error.code)
  );
}

async function auditSafe(store: SocialImageStore, input: Parameters<SocialImageStore['audit']>[0]) {
  try {
    await store.audit(input);
  } catch (error) {
    console.error('social image audit failed', error instanceof Error ? error.name : 'unknown');
  }
}

export function createSocialImageGenerateHandler(options: SocialImageGenerateHandlerOptions) {
  const nowFn = options.now ?? (() => new Date());
  const randomId = options.randomId ?? (() => crypto.randomUUID());

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (request.method !== 'POST') return json({ error: 'Methode non autorisee' }, 405);

    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > REQUEST_MAX_BYTES) {
      return json({ error: 'Requete trop volumineuse.' }, 413);
    }

    const authorization = request.headers.get('Authorization') ?? '';
    if (!/^Bearer\s+\S+$/i.test(authorization)) {
      return json({ error: 'Authentification requise.' }, 401);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return json({ error: 'Corps JSON invalide.' }, 400);
    }
    const parsed = validateRequestBody(rawBody);
    if (!parsed.ok) return json({ error: parsed.message }, 400);

    let provider: SocialImageProvider | null;
    try {
      provider = configuredProvider(options);
    } catch (error) {
      console.error('social image provider configuration failed', error instanceof Error ? error.name : 'unknown');
      return json(
        {
          error: 'SOCIAL_IMAGE_PROVIDER_UNSUPPORTED',
          message: 'Le provider visuel Social Studio configure n’est pas supporte.',
        },
        503,
      );
    }
    if (!provider) {
      return json(
        {
          error: 'SOCIAL_IMAGE_NOT_CONFIGURED',
          message: 'Le moteur visuel Social Studio n’est pas configure cote serveur.',
        },
        503,
      );
    }

    const auth = await options.store.authenticate(authorization);
    if (!auth) return json({ error: 'Session utilisateur invalide ou expiree.' }, 401);

    const access = await options.store.authorizeGeneration({
      organizationId: parsed.value.organizationId,
      userId: auth.userId,
    });
    if (!access.ok) return json({ error: access.code, message: access.message }, access.status);

    const post = await options.store.loadPost(parsed.value);
    if (!post) return json({ error: 'SOCIAL_POST_NOT_FOUND', message: 'Publication introuvable.' }, 404);

    const postValidation = validatePostForGeneration(post);
    if (!postValidation.ok) return json({ error: 'SOCIAL_IMAGE_POST_NOT_READY', message: postValidation.message }, postValidation.status);

    const output = await generateSocialImageForPost({
      store: options.store,
      provider,
      env: options.env,
      post,
      userId: auth.userId,
      force: parsed.value.force,
      now: nowFn,
      randomId,
      maxRetries: boundedInteger(options.env.maxRetries, DEFAULT_MAX_RETRIES, 0, 4),
    });

    if (output.status === 'existing') {
      return json({ status: 'existing', postId: post.id, assetsCount: output.assetsCount, generated: false });
    }
    if (output.status === 'in_progress') {
      return json(
        {
          error: 'SOCIAL_IMAGE_GENERATION_IN_PROGRESS',
          message: 'Une generation visuelle est deja en cours pour cette publication.',
        },
        409,
      );
    }
    if (output.status === 'limit_reached') {
      return json(
        {
          error: 'SOCIAL_IMAGE_WEEKLY_LIMIT_REACHED',
          message: 'La limite interne de generations visuelles pour cette semaine est atteinte.',
        },
        429,
      );
    }
    if (output.status === 'failed') {
      return json({ error: 'SOCIAL_IMAGE_GENERATION_FAILED', message: output.message }, output.httpStatus);
    }
    return json({
      status: 'generated',
      postId: post.id,
      assetsCount: output.assetsCount,
      provider: output.provider,
      model: output.model,
      usage: output.usage,
    });
  };
}

export type SocialPostImageGenerationOutput =
  | { status: 'generated'; postId: string; assetsCount: number; provider: string; model: string; usage: SocialImageGenerationResult['usage'] }
  | { status: 'existing'; postId: string; assetsCount: number }
  | { status: 'in_progress'; postId: string }
  | { status: 'limit_reached'; postId: string }
  | { status: 'failed'; postId: string; httpStatus: number; message: string; code: string };

export async function generateSocialImageForPost(input: {
  store: SocialImageStore;
  provider: SocialImageProvider;
  env: SocialImageGenerateEnv;
  post: SocialImagePostState;
  userId: string;
  force: boolean;
  now: () => Date;
  randomId: () => string;
  maxRetries: number;
}): Promise<SocialPostImageGenerationOutput> {
  const existingAssets = await input.store.listAssets({
    organizationId: input.post.organizationId,
    postId: input.post.id,
  });
  const existingUsableAssets = usableExistingAssets(existingAssets);
  if (!input.force && existingUsableAssets.length >= 1) {
    return { status: 'existing', postId: input.post.id, assetsCount: existingUsableAssets.length };
  }

  const startPosition = firstAvailablePosition(existingAssets, 1);
  if (startPosition === null) {
    return {
      status: 'failed',
      postId: input.post.id,
      httpStatus: 409,
      message: 'Cette publication a deja trop de variantes visuelles.',
      code: 'asset_limit',
    };
  }

  const generationId = input.randomId();
  const descriptor = {
    provider: input.provider.id || DEFAULT_SOCIAL_IMAGE_PROVIDER,
    model: input.provider.model || DEFAULT_SOCIAL_IMAGE_MODEL,
  };
  let usageId: string | null = null;
  let resultForUsage: Pick<SocialImageGenerationResult, 'usage' | 'provider' | 'model'> | undefined;
  const uploadedPaths: string[] = [];

  try {
    const reservation = await input.store.reserveGeneration({
      organizationId: input.post.organizationId,
      userId: input.userId,
      postId: input.post.id,
      generationId,
      provider: descriptor.provider,
      model: descriptor.model,
      weeklyLimit: weeklyLimit(input.env.weeklyGenerationLimit),
    });
    if (reservation.status === 'in_progress') return { status: 'in_progress', postId: input.post.id };
    if (reservation.status === 'limit_reached' || !reservation.usageId) {
      return { status: 'limit_reached', postId: input.post.id };
    }
    usageId = reservation.usageId;

    await auditSafe(input.store, {
      organizationId: input.post.organizationId,
      userId: input.userId,
      action: 'social.image_generation_started',
      entityId: input.post.id,
      metadata: { provider: descriptor.provider, model: descriptor.model, finalAsset: true },
    });

    let result: SocialImageGenerationResult | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= input.maxRetries; attempt += 1) {
      try {
        result = validateSocialImageResult(
          await generateRenderedSocialImage({
            provider: input.provider,
            post: {
              organizationId: input.post.organizationId,
              postId: input.post.id,
              slotIndex: input.post.slotIndex,
              hook: input.post.hook ?? '',
              visualText: input.post.visualText!,
              visualConcept: input.post.visualConcept!,
              caption: input.post.caption ?? '',
              cta: input.post.cta,
              objective: input.post.objective,
              audience: input.post.audience,
            },
          }),
          1,
        );
        break;
      } catch (error) {
        lastError = error;
        if (!retryable(error) || attempt >= input.maxRetries) throw error;
      }
    }
    if (!result) throw lastError ?? new SocialImageProviderError('Generation visuelle indisponible.');

    resultForUsage = { usage: result.usage, provider: result.provider, model: result.model };
    const variant = result.variants[0]!;
    const storagePath = await input.store.uploadImage({
      organizationId: input.post.organizationId,
      postId: input.post.id,
      generationId,
      variant,
    });
    uploadedPaths.push(storagePath);

    const assets = await input.store.insertGeneratedAssets({
      organizationId: input.post.organizationId,
      postId: input.post.id,
      userId: input.userId,
      provider: result.provider,
      variants: [{ variant, storagePath, position: startPosition }],
    });

    await input.store.markPostImageStatus({
      organizationId: input.post.organizationId,
      postId: input.post.id,
      status: 'ready',
      lastError: null,
    });

    await input.store.finalizeUsage({
      usageId,
      organizationId: input.post.organizationId,
      status: 'success',
      result: resultForUsage,
      completedAt: input.now().toISOString(),
    });

    await auditSafe(input.store, {
      organizationId: input.post.organizationId,
      userId: input.userId,
      action: 'social.image_generation_completed',
      entityId: input.post.id,
      metadata: {
        provider: result.provider,
        model: result.model,
        generationCount: result.usage.generationCount,
        promptChars: result.usage.promptChars,
        estimatedCost: result.usage.estimatedCost,
        latencyMs: result.usage.latencyMs,
        finalWidth: variant.width,
        finalHeight: variant.height,
        layout: variant.render.layout,
        renderMs: variant.render.renderMs,
        fileSizeBytes: variant.render.fileSizeBytes,
      },
    });

    return {
      status: 'generated',
      postId: input.post.id,
      assetsCount: assets.length,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
    };
  } catch (error) {
    const failure = errorStatus(error);
    if (uploadedPaths.length > 0) {
      try {
        await input.store.removeStorageObjects(uploadedPaths);
      } catch (cleanupError) {
        console.error('social image cleanup failed', cleanupError instanceof Error ? cleanupError.name : 'unknown');
      }
    }
    if (usageId) {
      try {
        const validationUsage = error instanceof SocialImageValidationError ? error.result : undefined;
        await input.store.finalizeUsage({
          usageId,
          organizationId: input.post.organizationId,
          status: failure.status,
          result: resultForUsage ?? validationUsage,
          errorCode: failure.code,
          completedAt: input.now().toISOString(),
        });
      } catch (usageError) {
        console.error('social image usage finalization failed', usageError instanceof Error ? usageError.name : 'unknown');
      }
    }
    await input.store.markPostImageStatus({
      organizationId: input.post.organizationId,
      postId: input.post.id,
      status: 'failed',
      lastError: failure.code,
    });
    await auditSafe(input.store, {
      organizationId: input.post.organizationId,
      userId: input.userId,
      action: 'social.image_generation_failed',
      entityId: input.post.id,
      metadata: { provider: descriptor.provider, model: descriptor.model, reason: failure.code },
    });
    console.error('social image generation failed', error instanceof Error ? error.name : 'unknown');
    return {
      status: 'failed',
      postId: input.post.id,
      httpStatus: failure.httpStatus,
      message: failure.message,
      code: failure.code,
    };
  }
}

export async function generateSocialImagesForWeek(input: {
  store: SocialImageStore;
  provider: SocialImageProvider;
  env: SocialImageGenerateEnv;
  organizationId: string;
  weekId: string;
  userId: string;
  now: () => Date;
  randomId: () => string;
}): Promise<{ total: number; generated: number; existing: number; failed: number; results: SocialPostImageGenerationOutput[] }> {
  const posts = await input.store.listWeekPosts({ organizationId: input.organizationId, weekId: input.weekId });
  const concurrency = boundedInteger(input.env.maxConcurrency, DEFAULT_MAX_CONCURRENCY, 1, 3);
  const maxRetries = boundedInteger(input.env.maxRetries, DEFAULT_MAX_RETRIES, 0, 4);
  const results: SocialPostImageGenerationOutput[] = [];
  let index = 0;

  async function worker() {
    while (index < posts.length) {
      const post = posts[index]!;
      index += 1;
      const validation = validatePostForGeneration(post);
      if (!validation.ok) {
        await input.store.markPostImageStatus({
          organizationId: post.organizationId,
          postId: post.id,
          status: 'failed',
          lastError: 'post_not_ready_for_visual_generation',
        });
        results.push({
          status: 'failed',
          postId: post.id,
          httpStatus: validation.status,
          message: validation.message,
          code: 'post_not_ready',
        });
        continue;
      }
      results.push(
        await generateSocialImageForPost({
          store: input.store,
          provider: input.provider,
          env: input.env,
          post,
          userId: input.userId,
          force: false,
          now: input.now,
          randomId: input.randomId,
          maxRetries,
        }),
      );
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return {
    total: posts.length,
    generated: results.filter((result) => result.status === 'generated').length,
    existing: results.filter((result) => result.status === 'existing').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
}
