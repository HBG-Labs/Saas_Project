import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  createSocialWorkerStore,
  resultToMark,
  type SocialWorkerStore,
} from '../_shared/social-worker-store.ts';
import type { InstagramPublisher } from '../_shared/social-publisher.ts';
import { workerSecretMatches } from '../_shared/worker-secret.ts';

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_ATTEMPTS = 5;
const BUDGET_MS = 50_000;

export interface SocialWorkerConfig {
  url: string;
  serviceRoleKey: string;
  secret: string;
  missing: string[];
  publisher: InstagramPublisher;
  stores?: { social: SocialWorkerStore };
  fetch?: typeof fetch;
  now?: () => Date;
  randomId?: () => string;
  batchSize?: number;
  maxAttempts?: number;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

function boundedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

export function createSocialWorkerHandler(config: SocialWorkerConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

    const providedSecret = request.headers.get('x-worker-secret') ?? '';
    if (!(await workerSecretMatches(providedSecret, config.secret))) {
      return json({ error: 'Accès refusé.' }, 401);
    }

    if (config.missing.length > 0) {
      return json(
        { error: `Worker Social Studio non configuré : ${config.missing.join(', ')}.` },
        503,
      );
    }

    if (config.publisher.mode !== 'dry_run' || config.publisher.id !== 'mock') {
      return json(
        {
          error: 'SOCIAL_WORKER_DRY_RUN_REQUIRED',
          message: 'Le worker Social Studio Phase F refuse tout publisher non dry-run.',
        },
        503,
      );
    }

    const clock = config.now ?? (() => new Date());
    const startedAt = clock().getTime();
    const withinBudget = () => clock().getTime() - startedAt < BUDGET_MS;
    const workerId = config.randomId?.() ?? crypto.randomUUID();
    const maxAttempts = boundedInteger(config.maxAttempts, DEFAULT_MAX_ATTEMPTS, 1, 10);
    const result = {
      claimed: 0,
      simulated: 0,
      retried: 0,
      failed: 0,
      reconciliationRequired: 0,
      skipped: 0,
      durationMs: 0,
    };

    const admin: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
      ...(config.fetch ? { global: { fetch: config.fetch } } : {}),
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const store = config.stores?.social ?? createSocialWorkerStore(admin);

    let claimed;
    try {
      claimed = await store.claimDuePosts({
        limit: boundedInteger(config.batchSize, DEFAULT_BATCH_SIZE, 1, 25),
        workerId,
        nowIso: clock().toISOString(),
      });
    } catch (error) {
      console.error('social-worker: claim failed', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'File Social Studio illisible.' }, 503);
    }

    for (const post of claimed) {
      if (!withinBudget()) break;
      result.claimed += 1;

      if (post.publishMode !== 'dry_run') {
        await store.markPublishResult({
          postId: post.postId,
          attemptId: post.attemptId,
          result: 'permanent_failure',
          errorKind: 'configuration',
          errorCode: 'non_dry_run_claim_refused',
          errorMessage: 'Le worker Phase F refuse un post non dry-run.',
          nowIso: clock().toISOString(),
          maxAttempts,
        });
        result.failed += 1;
        continue;
      }

      try {
        const publishResult = await config.publisher.publish(post);
        const mark = resultToMark(publishResult);
        await store.markPublishResult({
          postId: post.postId,
          attemptId: post.attemptId,
          ...mark,
          nowIso: clock().toISOString(),
          maxAttempts,
        });

        if (mark.result === 'simulated_success') result.simulated += 1;
        else if (mark.result === 'temporary_failure') {
          if (post.attempts >= maxAttempts) result.failed += 1;
          else result.retried += 1;
        } else if (mark.result === 'ambiguous_timeout') result.reconciliationRequired += 1;
        else result.failed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur worker inconnue.';
        try {
          await store.markPublishResult({
            postId: post.postId,
            attemptId: post.attemptId,
            result: 'temporary_failure',
            errorKind: 'temporary',
            errorCode: 'worker_exception',
            errorMessage: message.slice(0, 500),
            nowIso: clock().toISOString(),
            maxAttempts,
          });
        } catch (markError) {
          console.error(
            'social-worker: mark failed',
            markError instanceof Error ? markError.name : 'unknown',
          );
        }
        if (post.attempts >= maxAttempts) result.failed += 1;
        else result.retried += 1;
      }
    }

    result.durationMs = clock().getTime() - startedAt;
    return json(result);
  };
}
