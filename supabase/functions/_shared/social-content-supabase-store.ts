import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  socialPostInsertFromGenerated,
  type SocialAIUsageReservation,
  type SocialContentStore,
} from './social-content-handler.ts';
import { SOCIAL_CONTENT_GENERATOR_VERSION } from './social-marketing-context.ts';

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

function duplicateError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '23505' || /duplicate key/i.test(error?.message ?? '');
}

export function createSocialContentSupabaseStore(input: {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}): SocialContentStore {
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
          message: 'Accès non autorisé à cette organisation.',
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
          message: "Vous n'avez pas la permission Social Studio nécessaire.",
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

    async findWeek({ organizationId, startsOn }) {
      const { data: week, error: weekError } = await admin
        .from('social_weeks')
        .select('id,strategy,created_at')
        .eq('organization_id', organizationId)
        .eq('starts_on', startsOn)
        .maybeSingle();
      assertNoError(weekError);
      if (!week) return null;

      const { count, error: countError } = await admin
        .from('social_posts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('week_id', week.id);
      assertNoError(countError);

      return {
        weekId: week.id,
        postsCount: count ?? 0,
        strategy: jsonObject(week.strategy),
        createdAt: week.created_at,
      };
    },

    async createGenerationWeek({ organizationId, startsOn, userId, generationId, nowIso }) {
      const { data, error } = await admin
        .from('social_weeks')
        .insert({
          organization_id: organizationId,
          starts_on: startsOn,
          status: 'draft',
          created_by: userId,
          strategy: {
            source: 'social_studio_ai',
            generation_status: 'processing',
            generation_id: generationId,
            started_at: nowIso,
            generator_version: SOCIAL_CONTENT_GENERATOR_VERSION,
            performance_context: 'absent',
          },
        })
        .select('id')
        .single();
      if (duplicateError(error)) return { created: false };
      assertNoError(error);
      if (!data) throw new Error('La semaine Social Studio AI n’a pas été créée.');
      return { created: true, weekId: data.id };
    },

    async deleteGenerationWeek({ organizationId, weekId, generationId }) {
      const query = admin
        .from('social_weeks')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', weekId)
        .eq('strategy->>generation_id', generationId);
      const { error } = await query;
      assertNoError(error);
    },

    async reserveGeneration(input) {
      const { data, error } = await admin
        .rpc('reserve_social_ai_generation', {
          p_organization_id: input.organizationId,
          p_user_id: input.userId,
          p_starts_on: input.startsOn,
          p_generation_id: input.generationId,
          p_provider: input.provider,
          p_model: input.model,
          p_weekly_limit: input.weeklyLimit,
        })
        .maybeSingle();
      assertNoError(error);
      if (!data) return null;
      return {
        usageId: String((data as { usage_id: string }).usage_id),
        usedBefore: Number((data as { used_before: number }).used_before),
        remainingAfter: Number((data as { remaining_after: number }).remaining_after),
      } satisfies SocialAIUsageReservation;
    },

    async finalizeUsage({ usageId, organizationId, status, result, errorCode, completedAt }) {
      const patch: Record<string, unknown> = {
        status,
        input_tokens: result?.usage.inputTokens ?? 0,
        output_tokens: result?.usage.outputTokens ?? 0,
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
        .from('social_ai_usage')
        .update(patch)
        .eq('id', usageId)
        .eq('organization_id', organizationId);
      assertNoError(error);
    },

    async loadRecentContent({ organizationId }) {
      const { data, error } = await admin
        .from('social_posts')
        .select('hook,marketing_angle,cta,content,visual_brief,created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(12);
      assertNoError(error);
      return (data ?? []).map((row) => ({
        hook: row.hook ?? null,
        angle: row.marketing_angle ?? null,
        cta: row.cta ?? null,
        audience: textFromContent(row.content, 'audience'),
        objective: textFromContent(row.content, 'objective'),
        visualConcept: row.visual_brief ?? null,
        createdAt: row.created_at ?? null,
      }));
    },

    async insertGeneratedContent(input) {
      const posts = socialPostInsertFromGenerated({
        organizationId: input.organizationId,
        weekId: input.weekId,
        userId: input.userId,
        startsOn: input.startsOn,
        timezoneOffsetMinutes: input.timezoneOffsetMinutes,
        content: input.result.content,
      });

      const { error: insertPostsError } = await admin.from('social_posts').insert(posts);
      assertNoError(insertPostsError);

      const { error: updateWeekError } = await admin
        .from('social_weeks')
        .update({
          objective: input.result.content.week_strategy.primary_goal,
          audience: input.result.content.week_strategy.audience_focus.join(', '),
          zone: 'France + DOM',
          strategy: {
            source: 'social_studio_ai',
            generation_status: 'completed',
            generation_id: input.generationId,
            generated_at: input.nowIso,
            provider: input.result.provider,
            model: input.result.model,
            generator_version: input.result.generatorVersion,
            performance_context: 'absent',
            week_strategy: input.result.content.week_strategy,
          },
        })
        .eq('organization_id', input.organizationId)
        .eq('id', input.weekId)
        .eq('strategy->>generation_id', input.generationId);
      assertNoError(updateWeekError);
    },

    async audit(event) {
      const { error } = await admin.from('audit_logs').insert({
        organization_id: event.organizationId,
        user_id: event.userId,
        action: event.action,
        entity_type: 'social_week',
        entity_id: event.entityId ?? null,
        metadata: event.metadata ?? {},
      });
      assertNoError(error);
    },
  };
}
