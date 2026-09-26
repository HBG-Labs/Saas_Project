import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import type { ClaimedSocialPost, InstagramPublishResult } from './social-publisher.ts';

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeClaim(row: Record<string, unknown>): ClaimedSocialPost {
  return {
    postId: stringValue(row.post_id) ?? '',
    organizationId: stringValue(row.organization_id) ?? '',
    weekId: stringValue(row.week_id),
    accountId: stringValue(row.account_id),
    scheduledAt: stringValue(row.scheduled_at) ?? '',
    attemptId: stringValue(row.attempt_id) ?? '',
    attempts: Number(row.attempts ?? 0),
    publishMode: row.publish_mode === 'live' ? 'live' : 'dry_run',
    approvedSnapshot: objectValue(row.approved_snapshot),
  };
}

export interface MarkPublishResultInput {
  postId: string;
  attemptId: string;
  result: 'simulated_success' | 'temporary_failure' | 'permanent_failure' | 'ambiguous_timeout';
  errorKind?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  nowIso: string;
  maxAttempts: number;
}

export interface SocialWorkerStore {
  claimDuePosts(input: {
    limit: number;
    workerId: string;
    nowIso: string;
  }): Promise<ClaimedSocialPost[]>;
  markPublishResult(input: MarkPublishResultInput): Promise<void>;
}

function assertNoError(error: unknown) {
  if (error) throw error;
}

export function resultToMark(
  result: InstagramPublishResult,
):
  | Pick<MarkPublishResultInput, 'result'>
  | Pick<MarkPublishResultInput, 'result' | 'errorKind' | 'errorCode' | 'errorMessage'> {
  if (result.status === 'success') return { result: 'simulated_success' };
  if (result.kind === 'ambiguous_timeout') {
    return {
      result: 'ambiguous_timeout',
      errorKind: result.kind,
      errorCode: result.code,
      errorMessage: result.message,
    };
  }
  return {
    result: result.kind === 'temporary' ? 'temporary_failure' : 'permanent_failure',
    errorKind: result.kind,
    errorCode: result.code,
    errorMessage: result.message,
  };
}

export function createSocialWorkerStore(admin: SupabaseClient): SocialWorkerStore {
  return {
    async claimDuePosts({ limit, workerId, nowIso }) {
      const { data, error } = await admin.rpc('claim_due_social_posts', {
        p_limit: limit,
        p_worker_id: workerId,
        p_now: nowIso,
      });
      assertNoError(error);
      return ((data ?? []) as Record<string, unknown>[]).map(normalizeClaim);
    },

    async markPublishResult(input) {
      const { error } = await admin.rpc('mark_social_post_publish_result', {
        p_post_id: input.postId,
        p_attempt_id: input.attemptId,
        p_result: input.result,
        p_error_kind: input.errorKind ?? null,
        p_error_code: input.errorCode ?? null,
        p_error_message: input.errorMessage ?? null,
        p_now: input.nowIso,
        p_max_attempts: input.maxAttempts,
      });
      assertNoError(error);
    },
  };
}
