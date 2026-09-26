import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import { decryptSecret } from '../../../src/features/social/instagram-platform.ts';
import type {
  ClaimedSocialPost,
  InstagramPublishResult,
  MetaInstagramCredential,
  MetaInstagramPublisherStore,
} from './social-publisher.ts';

const SOCIAL_MEDIA_BUCKET = 'social-media-assets';

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

export interface MarkLivePublishSuccessInput {
  postId: string;
  attemptId: string;
  mediaId: string;
  permalink?: string | null;
  metadata?: Record<string, unknown>;
  nowIso: string;
}

export interface SocialWorkerStore {
  claimDuePosts(input: {
    limit: number;
    workerId: string;
    nowIso: string;
    publishMode: 'dry_run' | 'live';
    publisher: string;
  }): Promise<ClaimedSocialPost[]>;
  markPublishResult(input: MarkPublishResultInput): Promise<void>;
  markLivePublishSuccess(input: MarkLivePublishSuccessInput): Promise<void>;
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
    async claimDuePosts({ limit, workerId, nowIso, publishMode, publisher }) {
      const { data, error } = await admin.rpc('claim_due_social_posts_for_publisher', {
        p_limit: limit,
        p_worker_id: workerId,
        p_now: nowIso,
        p_publish_mode: publishMode,
        p_publisher: publisher,
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

    async markLivePublishSuccess(input) {
      const { error } = await admin.rpc('mark_social_post_publish_live_success', {
        p_post_id: input.postId,
        p_attempt_id: input.attemptId,
        p_media_id: input.mediaId,
        p_permalink: input.permalink ?? null,
        p_provider_metadata: input.metadata ?? {},
        p_now: input.nowIso,
      });
      assertNoError(error);
    },
  };
}

function tokenContext(organizationId: string, providerAccountId: string) {
  return `${organizationId}:instagram:${providerAccountId}`;
}

export function createMetaInstagramPublisherStore(input: {
  admin: SupabaseClient;
  encryptionKey: string;
}): MetaInstagramPublisherStore {
  return {
    async loadCredential(post): Promise<MetaInstagramCredential | null> {
      if (!post.accountId) return null;
      const { data, error } = await input.admin
        .schema('app')
        .from('social_account_credentials')
        .select(
          'account_id,organization_id,provider_account_id,access_token_ciphertext,access_token_expires_at,granted_permissions',
        )
        .eq('account_id', post.accountId)
        .eq('organization_id', post.organizationId)
        .eq('provider', 'instagram')
        .maybeSingle();
      assertNoError(error);
      if (!data) return null;
      const providerAccountId = stringValue(data.provider_account_id);
      const ciphertext = stringValue(data.access_token_ciphertext);
      const expiresAt = stringValue(data.access_token_expires_at);
      if (!providerAccountId || !ciphertext || !expiresAt) return null;
      return {
        providerAccountId,
        accessToken: await decryptSecret(
          ciphertext,
          input.encryptionKey,
          tokenContext(post.organizationId, providerAccountId),
        ),
        expiresAt,
        grantedPermissions: Array.isArray(data.granted_permissions)
          ? data.granted_permissions.filter(
              (permission): permission is string => typeof permission === 'string',
            )
          : [],
      };
    },

    async createSignedAssetUrl(storagePath, expiresInSeconds) {
      const { data, error } = await input.admin.storage
        .from(SOCIAL_MEDIA_BUCKET)
        .createSignedUrl(storagePath, expiresInSeconds);
      assertNoError(error);
      if (!data?.signedUrl) throw new Error('URL signee Social Studio indisponible.');
      return data.signedUrl;
    },

    async markContainer({ postId, attemptId, containerId, status, nowIso }) {
      const { error } = await input.admin.rpc('mark_social_post_instagram_container', {
        p_post_id: postId,
        p_attempt_id: attemptId,
        p_container_id: containerId,
        p_status: status,
        p_now: nowIso,
      });
      assertNoError(error);
    },
  };
}
