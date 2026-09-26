import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

import type {
  SocialImageReservation,
  SocialImageStore,
  StoredSocialImageAsset,
} from './social-image-handler.ts';

const BUCKET = 'social-media-assets';

function assertNoError(error: unknown) {
  if (error) throw error;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textFromContent(content: unknown, key: string): string | null {
  const value = jsonObject(content)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function createSocialImageSupabaseStore(input: {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}): SocialImageStore {
  const admin = createClient(input.url, input.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const caller = (authorization: string) =>
    createClient(input.url, input.anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

  return {
    async authenticate(authorization) {
      const { data, error } = await caller(authorization).auth.getUser(
        authorization.replace(/^Bearer\s+/i, ''),
      );
      if (error || !data.user) return null;
      return { userId: data.user.id };
    },

    async authorizeGeneration({ organizationId, userId }) {
      const { data: membership, error: membershipError } = await admin
        .from('organization_members')
        .select('role,status')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership || membership.status !== 'active') {
        return {
          ok: false,
          status: 403,
          code: 'SOCIAL_ORGANIZATION_FORBIDDEN',
          message: 'Acces non autorise a cette organisation.',
        };
      }

      const [{ data: permission }, { data: organization }] = await Promise.all([
        admin
          .from('role_permissions')
          .select('permission')
          .eq('role', membership.role)
          .eq('permission', 'social.manage')
          .maybeSingle(),
        admin.from('organizations').select('plan_code').eq('id', organizationId).maybeSingle(),
      ]);
      if (!permission) {
        return {
          ok: false,
          status: 403,
          code: 'SOCIAL_MANAGE_REQUIRED',
          message: "Vous n'avez pas la permission Social Studio necessaire.",
        };
      }

      const planCode = organization?.plan_code ?? 'free';
      const { data: feature, error: featureError } = await admin
        .from('plan_features')
        .select('limit_value')
        .eq('plan_code', planCode)
        .eq('feature_key', 'social_studio')
        .maybeSingle();
      if (featureError) throw featureError;
      if (!feature || (feature.limit_value !== null && feature.limit_value <= 0)) {
        return {
          ok: false,
          status: 403,
          code: 'SOCIAL_STUDIO_NOT_INCLUDED',
          message: 'Social Studio n’est pas inclus dans cette formule.',
        };
      }

      return { ok: true, context: { userId, role: membership.role } };
    },

    async loadPost({ organizationId, postId }) {
      const { data: post, error: postError } = await admin
        .from('social_posts')
        .select(
          'id,organization_id,week_id,slot_index,status,hook,visual_text,visual_brief,caption,cta,content',
        )
        .eq('organization_id', organizationId)
        .eq('id', postId)
        .maybeSingle();
      assertNoError(postError);
      if (!post) return null;

      const { data: week, error: weekError } = await admin
        .from('social_weeks')
        .select('id,starts_on')
        .eq('organization_id', organizationId)
        .eq('id', post.week_id)
        .maybeSingle();
      assertNoError(weekError);
      if (!week) return null;

      return {
        id: post.id,
        organizationId: post.organization_id,
        weekId: post.week_id,
        startsOn: week.starts_on,
        slotIndex: post.slot_index,
        status: post.status,
        hook: post.hook ?? null,
        visualText: post.visual_text ?? null,
        visualConcept: post.visual_brief ?? null,
        caption: post.caption ?? null,
        cta: post.cta ?? null,
        objective: textFromContent(post.content, 'objective'),
        audience: textFromContent(post.content, 'audience'),
      };
    },

    async listAssets({ organizationId, postId }) {
      const { data, error } = await admin
        .from('social_post_assets')
        .select('id,post_id,kind,position,storage_path,provider')
        .eq('organization_id', organizationId)
        .eq('post_id', postId)
        .order('position');
      assertNoError(error);
      return (data ?? []).map((asset) => ({
        id: asset.id,
        postId: asset.post_id,
        kind: asset.kind,
        position: asset.position,
        storagePath: asset.storage_path,
        provider: asset.provider ?? null,
      }));
    },

    async reserveGeneration(input) {
      const { data, error } = await admin
        .rpc('reserve_social_image_generation', {
          p_organization_id: input.organizationId,
          p_user_id: input.userId,
          p_post_id: input.postId,
          p_generation_id: input.generationId,
          p_provider: input.provider,
          p_model: input.model,
          p_weekly_limit: input.weeklyLimit,
        })
        .maybeSingle();
      assertNoError(error);
      if (!data) {
        return {
          status: 'limit_reached',
          usageId: null,
          startsOn: '',
          usedBefore: 0,
          remainingAfter: 0,
        } satisfies SocialImageReservation;
      }
      const row = data as {
        reservation_status: SocialImageReservation['status'];
        usage_id: string | null;
        starts_on: string;
        used_before: number;
        remaining_after: number;
      };
      return {
        status: row.reservation_status,
        usageId: row.usage_id,
        startsOn: row.starts_on,
        usedBefore: Number(row.used_before),
        remainingAfter: Number(row.remaining_after),
      } satisfies SocialImageReservation;
    },

    async uploadImage({ organizationId, postId, generationId, variant }) {
      const extension = variant.mimeType === 'image/png' ? 'png' : variant.mimeType === 'image/webp' ? 'webp' : 'jpg';
      const storagePath = `${organizationId}/social-studio/generated/${postId}/${generationId}/variant-${variant.index}.${extension}`;
      const body = variant.bytes.buffer.slice(
        variant.bytes.byteOffset,
        variant.bytes.byteOffset + variant.bytes.byteLength,
      ) as ArrayBuffer;
      const { error } = await admin.storage.from(BUCKET).upload(
        storagePath,
        new Blob([body], { type: variant.mimeType }),
        {
          contentType: variant.mimeType,
          upsert: false,
          cacheControl: '3600',
        },
      );
      assertNoError(error);
      return storagePath;
    },

    async insertGeneratedAssets({ organizationId, postId, userId, provider, variants }) {
      const { data, error } = await admin
        .from('social_post_assets')
        .insert(
          variants.map(({ variant, storagePath, position }) => ({
            organization_id: organizationId,
            post_id: postId,
            kind: 'generated',
            position,
            storage_path: storagePath,
            original_filename: variant.originalFilename,
            mime_type: variant.mimeType,
            width: variant.width,
            height: variant.height,
            alt_text: variant.altText,
            provider,
            created_by: userId,
          })),
        )
        .select('id,storage_path,position');
      assertNoError(error);
      return (data ?? []).map((asset) => ({
        id: asset.id,
        storagePath: asset.storage_path,
        position: asset.position,
      })) satisfies StoredSocialImageAsset[];
    },

    async removeStorageObjects(paths) {
      if (paths.length === 0) return;
      const { error } = await admin.storage.from(BUCKET).remove(paths);
      assertNoError(error);
    },

    async finalizeUsage({ usageId, organizationId, status, result, errorCode, completedAt }) {
      const patch: Record<string, unknown> = {
        status,
        variant_count: result?.usage.variantCount ?? 0,
        prompt_chars: result?.usage.promptChars ?? 0,
        estimated_cost: result?.usage.estimatedCost ?? 0,
        latency_ms: result?.usage.latencyMs ?? null,
        error_code: errorCode ?? null,
        completed_at: completedAt,
      };
      if (result) {
        patch.provider = result.provider;
        patch.model = result.model;
      }

      const { error } = await admin
        .from('social_image_usage')
        .update(patch)
        .eq('id', usageId)
        .eq('organization_id', organizationId);
      assertNoError(error);
    },

    async audit(event) {
      const { error } = await admin.from('audit_logs').insert({
        organization_id: event.organizationId,
        user_id: event.userId,
        action: event.action,
        entity_type: 'social_post',
        entity_id: event.entityId ?? null,
        metadata: event.metadata ?? {},
      });
      assertNoError(error);
    },
  };
}
