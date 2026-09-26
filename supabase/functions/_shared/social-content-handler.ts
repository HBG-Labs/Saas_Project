import { CORS_HEADERS, json } from './billing.ts';
import {
  DEFAULT_SOCIAL_AI_MODEL,
  DEFAULT_SOCIAL_AI_PROVIDER,
  SocialAIProviderError,
  SocialAIValidationError,
  createConfiguredSocialAIProvider,
  type RecentSocialContentItem,
  type SocialAIProvider,
  type SocialAIWeeklyContent,
  type SocialAIWeeklyResult,
} from './social-ai-provider.ts';
import { SOCIAL_CONTENT_GENERATOR_VERSION } from './social-marketing-context.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REQUEST_MAX_BYTES = 16_384;
const GENERATION_STALE_MS = 15 * 60_000;
const DEFAULT_WEEKLY_GENERATION_LIMIT = 3;

export interface SocialContentAccessContext {
  userId: string;
  role: string;
}

export interface SocialContentWeekState {
  weekId: string;
  postsCount: number;
  strategy: Record<string, unknown>;
  createdAt: string;
}

export interface SocialAIUsageReservation {
  usageId: string;
  usedBefore: number;
  remainingAfter: number;
}

export interface SocialContentStore {
  authenticate(authorization: string): Promise<{ userId: string } | null>;
  authorizeGeneration(input: {
    organizationId: string;
    userId: string;
  }): Promise<
    | { ok: true; context: SocialContentAccessContext }
    | { ok: false; status: number; code: string; message: string }
  >;
  findWeek(input: {
    organizationId: string;
    startsOn: string;
  }): Promise<SocialContentWeekState | null>;
  createGenerationWeek(input: {
    organizationId: string;
    startsOn: string;
    userId: string;
    generationId: string;
    nowIso: string;
  }): Promise<{ created: true; weekId: string } | { created: false }>;
  deleteGenerationWeek(input: {
    organizationId: string;
    weekId: string;
    generationId: string;
  }): Promise<void>;
  reserveGeneration(input: {
    organizationId: string;
    userId: string;
    startsOn: string;
    generationId: string;
    provider: string;
    model: string;
    weeklyLimit: number;
  }): Promise<SocialAIUsageReservation | null>;
  finalizeUsage(input: {
    usageId: string;
    organizationId: string;
    status: 'success' | 'provider_error' | 'invalid_response' | 'timeout' | 'cancelled';
    result?: Pick<SocialAIWeeklyResult, 'usage' | 'provider' | 'model'>;
    errorCode?: string;
    completedAt: string;
  }): Promise<void>;
  loadRecentContent(input: { organizationId: string }): Promise<RecentSocialContentItem[]>;
  insertGeneratedContent(input: {
    organizationId: string;
    weekId: string;
    userId: string;
    generationId: string;
    startsOn: string;
    timezoneOffsetMinutes: number;
    result: SocialAIWeeklyResult;
    nowIso: string;
  }): Promise<void>;
  audit(input: {
    organizationId: string;
    userId: string | null;
    action: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface SocialContentGenerateEnv {
  provider?: string | null;
  model?: string | null;
  openaiApiKey?: string | null;
  weeklyGenerationLimit?: string | null;
}

export interface SocialWeekVisualGenerationResult {
  total: number;
  generated: number;
  existing: number;
  failed: number;
}

export interface SocialWeekVisualGenerator {
  generate(input: {
    organizationId: string;
    weekId: string;
    userId: string;
  }): Promise<SocialWeekVisualGenerationResult>;
}

export interface SocialContentGenerateHandlerOptions {
  store: SocialContentStore;
  env: SocialContentGenerateEnv;
  provider?: SocialAIProvider;
  visualGenerator?: SocialWeekVisualGenerator;
  now?: () => Date;
  randomId?: () => string;
}

interface ValidRequestBody {
  organizationId: string;
  startsOn: string;
  timezoneOffsetMinutes: number;
}

function validateRequestBody(value: unknown): { ok: true; value: ValidRequestBody } | { ok: false; message: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, message: 'Corps de requête invalide.' };
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set(['organizationId', 'startsOn', 'timezoneOffsetMinutes']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return { ok: false, message: 'Le corps contient des champs non autorisés.' };
  }
  if (typeof body.organizationId !== 'string' || !UUID_PATTERN.test(body.organizationId)) {
    return { ok: false, message: 'Identifiant d’organisation invalide.' };
  }
  if (typeof body.startsOn !== 'string' || !DATE_PATTERN.test(body.startsOn)) {
    return { ok: false, message: 'Date de semaine invalide.' };
  }
  if (
    typeof body.timezoneOffsetMinutes !== 'number' ||
    !Number.isInteger(body.timezoneOffsetMinutes) ||
    body.timezoneOffsetMinutes < -840 ||
    body.timezoneOffsetMinutes > 840
  ) {
    return { ok: false, message: 'Fuseau horaire invalide.' };
  }

  return {
    ok: true,
    value: {
      organizationId: body.organizationId,
      startsOn: body.startsOn,
      timezoneOffsetMinutes: body.timezoneOffsetMinutes,
    },
  };
}

function weeklyLimit(value: string | null | undefined): number {
  const parsed = Number(value ?? '');
  if (!Number.isInteger(parsed)) return DEFAULT_WEEKLY_GENERATION_LIMIT;
  return Math.min(Math.max(parsed, 1), 20);
}

function configuredProvider(options: SocialContentGenerateHandlerOptions): SocialAIProvider | null {
  if (options.provider) return options.provider;
  return createConfiguredSocialAIProvider({
    provider: options.env.provider,
    model: options.env.model,
    openaiApiKey: options.env.openaiApiKey,
  });
}

function configuredProviderDescriptor(options: SocialContentGenerateHandlerOptions) {
  return {
    provider: options.provider?.id ?? (options.env.provider?.trim() || DEFAULT_SOCIAL_AI_PROVIDER),
    model: options.provider?.model ?? (options.env.model?.trim() || DEFAULT_SOCIAL_AI_MODEL),
  };
}

function isProcessingWeek(week: SocialContentWeekState): boolean {
  return (
    week.strategy.source === 'social_studio_ai' &&
    week.strategy.generation_status === 'processing' &&
    typeof week.strategy.generation_id === 'string'
  );
}

function generationIdOf(week: SocialContentWeekState): string | null {
  return typeof week.strategy.generation_id === 'string' ? week.strategy.generation_id : null;
}

function isStale(week: SocialContentWeekState, now: Date): boolean {
  const startedAt =
    typeof week.strategy.started_at === 'string' ? week.strategy.started_at : week.createdAt;
  const timestamp = Date.parse(startedAt);
  return Number.isFinite(timestamp) && now.getTime() - timestamp > GENERATION_STALE_MS;
}

function existingWeekResponse(week: SocialContentWeekState): Response {
  return json({
    status: 'existing',
    weekId: week.weekId,
    postsCount: week.postsCount,
    generated: false,
  });
}

async function auditSafe(store: SocialContentStore, input: Parameters<SocialContentStore['audit']>[0]) {
  try {
    await store.audit(input);
  } catch (error) {
    console.error('social content audit failed', error instanceof Error ? error.name : 'unknown');
  }
}

function errorStatus(error: unknown): {
  status: 'provider_error' | 'invalid_response' | 'timeout' | 'cancelled';
  httpStatus: number;
  message: string;
  code: string;
} {
  if (error instanceof SocialAIValidationError) {
    return {
      status: 'invalid_response',
      httpStatus: 502,
      message: 'La réponse Social Studio AI n’a pas pu être validée. Aucun brouillon n’a été créé.',
      code: 'invalid_response',
    };
  }
  if (error instanceof SocialAIProviderError && error.code === 'timeout') {
    return {
      status: 'timeout',
      httpStatus: 504,
      message: 'La génération Social Studio AI a expiré. Aucun brouillon n’a été créé.',
      code: 'timeout',
    };
  }
  if (error instanceof SocialAIProviderError) {
    return {
      status: 'provider_error',
      httpStatus: 502,
      message: 'Social Studio AI est momentanément indisponible.',
      code: error.code,
    };
  }
  return {
    status: 'provider_error',
    httpStatus: 502,
    message: 'La génération de la semaine est momentanément indisponible.',
    code: 'unknown',
  };
}

export function createSocialContentGenerateHandler(options: SocialContentGenerateHandlerOptions) {
  const nowFn = options.now ?? (() => new Date());
  const randomId = options.randomId ?? (() => crypto.randomUUID());

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > REQUEST_MAX_BYTES) {
      return json({ error: 'Requête trop volumineuse.' }, 413);
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

    let provider: SocialAIProvider | null;
    try {
      provider = configuredProvider(options);
    } catch (error) {
      console.error('social ai provider configuration failed', error instanceof Error ? error.name : 'unknown');
      return json(
        {
          error: 'SOCIAL_AI_PROVIDER_UNSUPPORTED',
          message: 'Le provider Social Studio AI configuré n’est pas supporté.',
        },
        503,
      );
    }
    if (!provider) {
      return json(
        {
          error: 'SOCIAL_AI_NOT_CONFIGURED',
          message: 'Social Studio AI n’est pas configuré côté serveur.',
        },
        503,
      );
    }

    const auth = await options.store.authenticate(authorization);
    if (!auth) return json({ error: 'Session utilisateur invalide ou expirée.' }, 401);

    const access = await options.store.authorizeGeneration({
      organizationId: parsed.value.organizationId,
      userId: auth.userId,
    });
    if (!access.ok) {
      return json({ error: access.code, message: access.message }, access.status);
    }

    const generationId = randomId();
    const now = nowFn();
    const nowIso = now.toISOString();
    const descriptor = configuredProviderDescriptor(options);
    let weekId: string | null = null;
    let usageId: string | null = null;
    let resultForUsage: Pick<SocialAIWeeklyResult, 'usage' | 'provider' | 'model'> | undefined;

    try {
      const existing = await options.store.findWeek(parsed.value);
      if (existing) {
        if (existing.postsCount >= 7) return existingWeekResponse(existing);

        if (
          existing.postsCount === 0 &&
          isProcessingWeek(existing) &&
          isStale(existing, now) &&
          generationIdOf(existing)
        ) {
          await options.store.deleteGenerationWeek({
            organizationId: parsed.value.organizationId,
            weekId: existing.weekId,
            generationId: generationIdOf(existing)!,
          });
        } else if (isProcessingWeek(existing)) {
          return json(
            {
              error: 'GENERATION_IN_PROGRESS',
              message: 'Une génération Social Studio AI est déjà en cours.',
            },
            409,
          );
        } else {
          return json(
            {
              error: 'WEEK_ALREADY_STARTED',
              message:
                'Une semaine Social Studio existe déjà. Terminez-la ou utilisez une future régénération.',
            },
            409,
          );
        }
      }

      const lock = await options.store.createGenerationWeek({
        organizationId: parsed.value.organizationId,
        startsOn: parsed.value.startsOn,
        userId: auth.userId,
        generationId,
        nowIso,
      });
      if (!lock.created) {
        const racedWeek = await options.store.findWeek(parsed.value);
        if (racedWeek && racedWeek.postsCount >= 7) return existingWeekResponse(racedWeek);
        return json(
          {
            error: 'GENERATION_IN_PROGRESS',
            message: 'Une génération Social Studio AI est déjà en cours.',
          },
          409,
        );
      }
      weekId = lock.weekId;

      const reservation = await options.store.reserveGeneration({
        organizationId: parsed.value.organizationId,
        userId: auth.userId,
        startsOn: parsed.value.startsOn,
        generationId,
        provider: descriptor.provider,
        model: descriptor.model,
        weeklyLimit: weeklyLimit(options.env.weeklyGenerationLimit),
      });
      if (!reservation) {
        await options.store.deleteGenerationWeek({
          organizationId: parsed.value.organizationId,
          weekId,
          generationId,
        });
        weekId = null;
        return json(
          {
            error: 'SOCIAL_AI_WEEKLY_LIMIT_REACHED',
            message: 'La limite interne de générations Social Studio pour cette semaine est atteinte.',
          },
          429,
        );
      }
      usageId = reservation.usageId;

      await auditSafe(options.store, {
        organizationId: parsed.value.organizationId,
        userId: auth.userId,
        action: 'social.content_generation_started',
        entityId: weekId,
        metadata: {
          startsOn: parsed.value.startsOn,
          provider: descriptor.provider,
          model: descriptor.model,
          generatorVersion: SOCIAL_CONTENT_GENERATOR_VERSION,
        },
      });

      const recentContent = await options.store.loadRecentContent({
        organizationId: parsed.value.organizationId,
      });
      const result = await provider.generateWeeklyContent({
        organizationId: parsed.value.organizationId,
        startsOn: parsed.value.startsOn,
        recentContent,
      });
      resultForUsage = { usage: result.usage, provider: result.provider, model: result.model };

      await options.store.insertGeneratedContent({
        organizationId: parsed.value.organizationId,
        weekId,
        userId: auth.userId,
        generationId,
        startsOn: parsed.value.startsOn,
        timezoneOffsetMinutes: parsed.value.timezoneOffsetMinutes,
        result,
        nowIso: nowFn().toISOString(),
      });

      let visualGeneration: SocialWeekVisualGenerationResult | null = null;
      if (options.visualGenerator) {
        try {
          visualGeneration = await options.visualGenerator.generate({
            organizationId: parsed.value.organizationId,
            weekId,
            userId: auth.userId,
          });
        } catch (visualError) {
          visualGeneration = { total: 7, generated: 0, existing: 0, failed: 7 };
          console.error('social visual week generation failed', visualError instanceof Error ? visualError.name : 'unknown');
          await auditSafe(options.store, {
            organizationId: parsed.value.organizationId,
            userId: auth.userId,
            action: 'social.image_week_generation_failed',
            entityId: weekId,
            metadata: { reason: visualError instanceof Error ? visualError.name : 'unknown' },
          });
        }
      }

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
        action: 'social.content_generation_completed',
        entityId: weekId,
        metadata: {
          startsOn: parsed.value.startsOn,
          provider: result.provider,
          model: result.model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          estimatedCost: result.usage.estimatedCost,
          latencyMs: result.usage.latencyMs,
          generatorVersion: result.generatorVersion,
          visualGeneration,
        },
      });

      return json({
        status: 'generated',
        weekId,
        postsCount: 7,
        visualGeneration,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
      });
    } catch (error) {
      const failure = errorStatus(error);

      if (weekId) {
        try {
          await options.store.deleteGenerationWeek({
            organizationId: parsed.value.organizationId,
            weekId,
            generationId,
          });
        } catch (cleanupError) {
          console.error('social content cleanup failed', cleanupError instanceof Error ? cleanupError.name : 'unknown');
        }
      }

      if (usageId) {
        try {
          const validationUsage =
            error instanceof SocialAIValidationError ? error.usage : undefined;
          await options.store.finalizeUsage({
            usageId,
            organizationId: parsed.value.organizationId,
            status: failure.status,
            result: resultForUsage ?? validationUsage,
            errorCode: failure.code,
            completedAt: nowFn().toISOString(),
          });
        } catch (usageError) {
          console.error('social ai usage finalization failed', usageError instanceof Error ? usageError.name : 'unknown');
        }
      }

      await auditSafe(options.store, {
        organizationId: parsed.value.organizationId,
        userId: auth.userId,
        action: 'social.content_generation_failed',
        entityId: weekId,
        metadata: {
          startsOn: parsed.value.startsOn,
          provider: descriptor.provider,
          model: descriptor.model,
          reason: failure.code,
        },
      });

      console.error('social content generation failed', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'SOCIAL_CONTENT_GENERATION_FAILED', message: failure.message }, failure.httpStatus);
    }
  };
}

function addDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function localDateTimeToIso(dateValue: string, timeValue: string, timezoneOffsetMinutes: number): string {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  return new Date(
    Date.UTC(year!, month! - 1, day!, hour!, minute!, 0, 0) + timezoneOffsetMinutes * 60_000,
  ).toISOString();
}

export function socialPostInsertFromGenerated(input: {
  organizationId: string;
  weekId: string;
  userId: string;
  startsOn: string;
  timezoneOffsetMinutes: number;
  content: SocialAIWeeklyContent;
}) {
  return input.content.posts.map((post) => ({
    organization_id: input.organizationId,
    week_id: input.weekId,
    slot_index: post.day,
    status: 'draft',
    format: 'image',
    hook: post.hook,
    marketing_angle: post.angle,
    concept: post.angle,
    visual_brief: post.visual_concept,
    visual_text: post.visual_text,
    caption: post.caption,
    cta: post.cta,
    hashtags: post.hashtags,
    recommendation_reason: post.reasoning_summary,
    created_by: input.userId,
    content: {
      planned_for: localDateTimeToIso(
        addDays(input.startsOn, post.day - 1),
        post.planned_time,
        input.timezoneOffsetMinutes,
      ),
      objective: post.objective,
      audience: post.audience,
      exploration_mode: true,
      performance_context: 'absent',
      generator_version: SOCIAL_CONTENT_GENERATOR_VERSION,
      placeholder_variant: `slot-${post.day}`,
    },
  }));
}
