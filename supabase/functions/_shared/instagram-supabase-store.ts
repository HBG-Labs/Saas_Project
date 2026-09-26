import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

import type {
  InstagramConnectionStore,
  InstagramCredential,
  InstagramOAuthState,
  InstagramPublicAccount,
} from './instagram-connection-handler.ts';

const accountColumns =
  'id,organization_id,provider,provider_account_id,username,display_name,profile_picture_url,account_type,status,granted_permissions,last_synced_at,connected_at,publishing_suspended_at,last_error_code,last_error_message';

function assertNoError(error: unknown) {
  if (error) throw error;
}

export function createInstagramSupabaseStore(input: {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}): InstagramConnectionStore {
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

    async canManage(organizationId, authorization) {
      const { data, error } = await caller(authorization).rpc('can_manage_social_connection', {
        p_organization_id: organizationId,
      });
      if (error) throw error;
      return Boolean(data);
    },

    async getAccount(organizationId) {
      const { data, error } = await admin
        .from('social_accounts')
        .select(accountColumns)
        .eq('organization_id', organizationId)
        .eq('provider', 'instagram')
        .maybeSingle();
      assertNoError(error);
      return (data ?? null) as InstagramPublicAccount | null;
    },

    async cleanupExpiredOAuthStates(nowIso) {
      const { error } = await admin
        .schema('app')
        .from('social_oauth_states')
        .delete()
        .lt('expires_at', nowIso);
      assertNoError(error);
    },

    async createOAuthState(state) {
      const { error } = await admin.schema('app').from('social_oauth_states').insert({
        state_sha256: state.stateSha256,
        organization_id: state.organizationId,
        user_id: state.userId,
        return_url: state.returnUrl,
        scopes: state.scopes,
        expires_at: state.expiresAt,
      });
      assertNoError(error);
    },

    async consumeOAuthState(stateSha256, consumedAt) {
      const { data, error } = await admin
        .schema('app')
        .from('social_oauth_states')
        .update({ consumed_at: consumedAt })
        .eq('state_sha256', stateSha256)
        .is('consumed_at', null)
        .gt('expires_at', consumedAt)
        .select('organization_id,user_id,return_url,scopes')
        .maybeSingle();
      assertNoError(error);
      return (data ?? null) as InstagramOAuthState | null;
    },

    async getCredential(organizationId) {
      const { data, error } = await admin
        .schema('app')
        .from('social_account_credentials')
        .select(
          'account_id,organization_id,provider_account_id,access_token_ciphertext,token_type,access_token_expires_at,granted_permissions',
        )
        .eq('organization_id', organizationId)
        .eq('provider', 'instagram')
        .maybeSingle();
      assertNoError(error);
      return (data ?? null) as InstagramCredential | null;
    },

    async completeConnection(payload) {
      const { data, error } = await admin.rpc('complete_instagram_connection', {
        p_organization_id: payload.organizationId,
        p_user_id: payload.userId,
        p_provider_account_id: payload.profile.id,
        p_username: payload.profile.username,
        p_display_name: payload.profile.name,
        p_profile_picture_url: payload.profile.profile_picture_url,
        p_account_type: payload.profile.account_type,
        p_granted_permissions: payload.grantedPermissions,
        p_access_token_ciphertext: payload.accessTokenCiphertext,
        p_token_type: payload.tokenType,
        p_access_token_expires_at: payload.accessTokenExpiresAt,
      });
      assertNoError(error);
      return String(data);
    },

    async disconnect(organizationId, userId) {
      const { data, error } = await admin.rpc('disconnect_instagram_connection', {
        p_organization_id: organizationId,
        p_user_id: userId,
      });
      assertNoError(error);
      return Boolean(data);
    },

    async audit(event) {
      const { error } = await admin.from('audit_logs').insert({
        organization_id: event.organizationId,
        user_id: event.userId,
        action: event.action,
        entity_type: 'social_account',
        entity_id: event.entityId ?? null,
        metadata: event.metadata ?? {},
      });
      assertNoError(error);
    },
  };
}
