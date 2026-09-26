import { CORS_HEADERS, json } from './billing.ts';
import {
  DEFAULT_SOCIAL_IMAGE_MODEL,
  DEFAULT_SOCIAL_IMAGE_PROVIDER,
  SocialImageProviderError,
  SocialImageValidationError,
  createConfiguredSocialImageProvider,
  validateSocialImageResult,
  type SocialGeneratedImageVariant,
  type SocialImageGenerationResult,
  type SocialImageProvider,
} from './social-image-provider.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_MAX_BYTES = 8_192;
const DEFAULT_WEEKLY_IMAGE_LIMIT = 21;
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
  weeklyGenerationLimit?: string | null;
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
  variantCount: number;
}

function validateRequestBody(value: unknown): { ok: true; value: ValidRequestBody } | { ok: false; message: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, message: 'Corps de requete invalide.' };
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set(['organizationId', 'postId', 'variantCount']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return { ok: false, message: 'Le corps contient des champs non autorises.' };
  }
  if (typeof body.organizationId !== 'string' || !UUID_PATTERN.test(body.organizationId)) {
    return { ok: false, message: "Identifiant d'organisation invalide." };
  }
  if (typeof body.postId !== 'string' || !UUID_PATTERN.test(body.postId)) {
    return { ok: false, message: 'Identifiant de publication invalide.' };
  }
  const variantCount = body.variantCount === undefined ? 3 : body.variantCount;
  if (
    typeof variantCount !== 'number' ||
    !Number.isInteger(variantCount) ||
    variantCount < 1 ||
    variantCount > 3
  ) {
    return { ok: false, message: 'Le nombre de variantes doit etre compris entre 1 et 3.' };
  }
  return { ok: true, value: { organizationId: body.organizationId, postId: body.postId, variantCount } };
}

function weeklyLimit(value: string | null | undefined): number {
  const parsed = Number(value ?? '');
  if (!Number.isInteger(parsed)) return DEFAULT_WEEKLY_IMAGE_LIMIT;
  return Math.min(Math.max(parsed, 1), 70);
}

function configuredProvider(options: SocialImageGenerateHandlerOptions): SocialImageProvider | null {
  if (options.provider) return options.provider;
  return createConfiguredSocialImageProvider({
    provider: options.env.provider,
    model: options.env.model,
    allowMock: options.env.allowMock,
  });
}

function configuredProviderDescriptor(options: SocialImageGenerateHandlerOptions) {
  return {
    provider: options.provider?.id ?? (options.env.provider?.trim() || DEFAULT_SOCIAL_IMAGE_PROVIDER),
    model: options.provider?.model ?? (options.env.model?.trim() || DEFAULT_SOCIAL_IMAGE_MODEL),
  };
}

function usableExistingAssets(assets: SocialImageAssetState[]) {
  return assets.filter((asset) => asset.kind === 'generated' || asset.kind === 'selected');
}

function firstAvailablePosition(assets: SocialImageAssetState[], variantCount: number): number | null {
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
      message: 'La reponse du moteur visuel Social Studio est invalide. Aucun asset n’a ete cree.',
      code: 'invalid_response',
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

    const existingAssets = await options.store.listAssets(parsed.value);
    const existingUsableAssets = usableExistingAssets(existingAssets);
    if (existingUsableAssets.length >= parsed.value.variantCount) {
      return json({
        status: 'existing',
        postId: post.id,
        assetsCount: existingUsableAssets.length,
        generated: false,
      });
    }

    const startPosition = firstAvailablePosition(existingAssets, parsed.value.variantCount);
    if (startPosition === null) {
      return json(
        {
          error: 'SOCIAL_IMAGE_ASSET_LIMIT',
          message: 'Cette publication a deja trop de variantes visuelles.',
        },
        409,
      );
    }

    const generationId = randomId();
    const descriptor = configuredProviderDescriptor(options);
    let usageId: string | null = null;
    let resultForUsage: Pick<SocialImageGenerationResult, 'usage' | 'provider' | 'model'> | undefined;
    const uploadedPaths: string[] = [];

    try {
      const reservation = await options.store.reserveGeneration({
        organizationId: parsed.value.organizationId,
        userId: auth.userId,
        postId: post.id,
        generationId,
        provider: descriptor.provider,
        model: descriptor.model,
        weeklyLimit: weeklyLimit(options.env.weeklyGenerationLimit),
      });
      if (reservation.status === 'in_progress') {
        return json(
          {
            error: 'SOCIAL_IMAGE_GENERATION_IN_PROGRESS',
            message: 'Une generation visuelle est deja en cours pour cette publication.',
          },
          409,
        );
      }
      if (reservation.status === 'limit_reached' || !reservation.usageId) {
        return json(
          {
            error: 'SOCIAL_IMAGE_WEEKLY_LIMIT_REACHED',
            message: 'La limite interne de generations visuelles pour cette semaine est atteinte.',
          },
          429,
        );
      }
      usageId = reservation.usageId;

      await auditSafe(options.store, {
        organizationId: parsed.value.organizationId,
        userId: auth.userId,
        action: 'social.image_generation_started',
        entityId: post.id,
        metadata: {
          provider: descriptor.provider,
          model: descriptor.model,
          variantCount: parsed.value.variantCount,
        },
      });

      const result = validateSocialImageResult(
        await provider.generatePostImages({
          post: {
            organizationId: post.organizationId,
            postId: post.id,
            slotIndex: post.slotIndex,
            hook: post.hook ?? '',
            visualText: post.visualText!,
            visualConcept: post.visualConcept!,
            caption: post.caption ?? '',
            cta: post.cta,
            objective: post.objective,
            audience: post.audience,
          },
          variantCount: parsed.value.variantCount,
        }),
        parsed.value.variantCount,
      );
      resultForUsage = { usage: result.usage, provider: result.provider, model: result.model };

      const variantsWithPaths: Array<{ variant: SocialGeneratedImageVariant; storagePath: string; position: number }> = [];
      for (const variant of result.variants) {
        const storagePath = await options.store.uploadImage({
          organizationId: parsed.value.organizationId,
          postId: post.id,
          generationId,
          variant,
        });
        uploadedPaths.push(storagePath);
        variantsWithPaths.push({
          variant,
          storagePath,
          position: startPosition + variant.index - 1,
        });
      }

      const assets = await options.store.insertGeneratedAssets({
        organizationId: parsed.value.organizationId,
        postId: post.id,
        userId: auth.userId,
        provider: result.provider,
        variants: variantsWithPaths,
      });

      await options.store.finalizeUsage({
        usageId,
        organizationId: parsed.value.organizationId,
        status: 'success',
        result: resultForUsage,
        completedAt: nowFn().toISOString(),
      });

      await auditSafe(options.store, {
        organizationId: parsed.value.organizationId,
        userId: auth.userId,
        action: 'social.image_generation_completed',
        entityId: post.id,
        metadata: {
          provider: result.provider,
          model: result.model,
          variantCount: result.variants.length,
          promptChars: result.usage.promptChars,
          estimatedCost: result.usage.estimatedCost,
          latencyMs: result.usage.latencyMs,
        },
      });

      return json({
        status: 'generated',
        postId: post.id,
        assetsCount: assets.length,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
      });
    } catch (error) {
      const failure = errorStatus(error);

      if (uploadedPaths.length > 0) {
        try {
          await options.store.removeStorageObjects(uploadedPaths);
        } catch (cleanupError) {
          console.error('social image cleanup failed', cleanupError instanceof Error ? cleanupError.name : 'unknown');
        }
      }

      if (usageId) {
        try {
          const validationUsage =
            error instanceof SocialImageValidationError ? error.result : undefined;
          await options.store.finalizeUsage({
            usageId,
            organizationId: parsed.value.organizationId,
            status: failure.status,
            result: resultForUsage ?? validationUsage,
            errorCode: failure.code,
            completedAt: nowFn().toISOString(),
          });
        } catch (usageError) {
          console.error('social image usage finalization failed', usageError instanceof Error ? usageError.name : 'unknown');
        }
      }

      await auditSafe(options.store, {
        organizationId: parsed.value.organizationId,
        userId: auth.userId,
        action: 'social.image_generation_failed',
        entityId: post.id,
        metadata: {
          provider: descriptor.provider,
          model: descriptor.model,
          reason: failure.code,
        },
      });

      console.error('social image generation failed', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'SOCIAL_IMAGE_GENERATION_FAILED', message: failure.message }, failure.httpStatus);
    }
  };
}
