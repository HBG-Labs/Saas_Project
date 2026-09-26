import assert from 'node:assert/strict';

import {
  createInstagramConnectionHandler,
  createInstagramOAuthCallbackHandler,
  type InstagramConnectionStore,
  type InstagramMetaClient,
} from './instagram-connection-handler.ts';
import { decryptSecret, sha256Hex } from '../../../src/features/social/instagram-platform.ts';

const ORG = '00000000-0000-4000-8000-000000000360';
const USER = '00000000-0000-4000-8000-000000000001';
const KEY = btoa('0123456789abcdef0123456789abcdef');

function env() {
  return {
    supabaseUrl: 'https://project.supabase.co',
    appUrl: 'https://app.rezo360.test',
    appId: 'instagram-app-id',
    appSecret: 'instagram-app-secret',
    encryptionKey: KEY,
  };
}

function request(body: unknown, token = 'jwt') {
  return new Request('https://project.supabase.co/functions/v1/instagram-connection', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setup(options: { canManage?: boolean; existingConnected?: boolean } = {}) {
  const oauthStates = new Map<string, Record<string, unknown>>();
  const calls = {
    states: [] as Record<string, unknown>[],
    completed: [] as Record<string, unknown>[],
    audit: [] as Record<string, unknown>[],
    disconnected: [] as Record<string, unknown>[],
    metaCodes: [] as string[],
  };

  const store: InstagramConnectionStore = {
    authenticate: async () => ({ userId: USER }),
    canManage: async () => options.canManage ?? true,
    getAccount: async () =>
      options.existingConnected
        ? ({
            id: 'account-id',
            organization_id: ORG,
            provider: 'instagram',
            provider_account_id: '1784',
            username: 'rezo.360',
            display_name: 'REZO360',
            profile_picture_url: null,
            account_type: 'BUSINESS',
            status: 'connected',
            granted_permissions: ['instagram_business_basic'],
            last_synced_at: null,
            connected_at: null,
            publishing_suspended_at: null,
            last_error_code: null,
            last_error_message: null,
          } as const)
        : null,
    cleanupExpiredOAuthStates: async () => undefined,
    createOAuthState: async (input) => {
      calls.states.push(input);
      oauthStates.set(input.stateSha256, {
        organization_id: input.organizationId,
        user_id: input.userId,
        return_url: input.returnUrl,
        scopes: input.scopes,
        expires_at: input.expiresAt,
        consumed_at: null,
      });
    },
    consumeOAuthState: async (stateSha256, consumedAt) => {
      const state = oauthStates.get(stateSha256);
      if (!state || state.consumed_at || String(state.expires_at) <= consumedAt) return null;
      state.consumed_at = consumedAt;
      return {
        organization_id: String(state.organization_id),
        user_id: String(state.user_id),
        return_url: String(state.return_url),
        scopes: state.scopes as string[],
      };
    },
    getCredential: async () => null,
    completeConnection: async (input) => {
      calls.completed.push(input);
      return 'account-id';
    },
    disconnect: async (organizationId, userId) => {
      calls.disconnected.push({ organizationId, userId });
      return true;
    },
    audit: async (input) => {
      calls.audit.push(input);
    },
  };

  const meta: InstagramMetaClient = {
    authorizationUrl: ({ state }) => `https://www.instagram.com/oauth/authorize?state=${state}`,
    exchangeCode: async ({ code }) => {
      calls.metaCodes.push(code);
      if (code === 'meta-fail') throw new Error('MetaError');
      return {
        shortToken: {
          accessToken: 'short-token-secret',
          userId: '1784140000001',
          permissions: ['instagram_business_basic', 'instagram_business_content_publish'],
        },
        longToken: { accessToken: 'long-token-secret', tokenType: 'bearer', expiresIn: 3600 },
      };
    },
    refreshToken: async () => ({
      accessToken: 'refreshed-token-secret',
      tokenType: 'bearer',
      expiresIn: 3600,
    }),
    profile: async () => ({
      id: '1784140000001',
      username: 'rezo.360',
      name: 'REZO360',
      profile_picture_url: 'https://cdn.example/avatar.jpg',
      account_type: 'BUSINESS',
    }),
  };

  return { store, meta, calls, oauthStates };
}

Deno.test('OAuth start refuse un manager sans social.publish', async () => {
  const { store, meta, calls } = setup({ canManage: false });
  const handler = createInstagramConnectionHandler({ store, meta, env: env() });

  const res = await handler(
    request({
      action: 'start',
      organizationId: ORG,
      returnUrl: 'https://app.rezo360.test/settings',
    }),
  );

  assert.equal(res.status, 403);
  assert.equal(calls.states.length, 0);
});

Deno.test('OAuth start cree un state hashe, expire, single-use cote serveur', async () => {
  const { store, meta, calls } = setup();
  const handler = createInstagramConnectionHandler({
    store,
    meta,
    env: env(),
    randomState: () => 'plain-state',
    now: () => new Date('2026-09-26T12:00:00.000Z'),
  });

  const res = await handler(
    request({
      action: 'start',
      organizationId: ORG,
      returnUrl: 'https://app.rezo360.test/settings',
    }),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { url: string };
  assert.equal(body.url, 'https://www.instagram.com/oauth/authorize?state=plain-state');
  assert.equal(calls.states.length, 1);
  assert.equal(calls.states[0].stateSha256, await sha256Hex('plain-state'));
  assert.notEqual(calls.states[0].stateSha256, 'plain-state');
  assert.equal(calls.states[0].expiresAt, '2026-09-26T12:10:00.000Z');
  assert.equal(calls.audit[0].action, 'instagram.connection_started');
});

Deno.test('callback valide chiffre le jeton et audite sans secret', async () => {
  const { store, meta, calls } = setup();
  const start = createInstagramConnectionHandler({
    store,
    meta,
    env: env(),
    randomState: () => 'plain-state',
  });
  await start(
    request({
      action: 'start',
      organizationId: ORG,
      returnUrl: 'https://app.rezo360.test/settings',
    }),
  );

  const callback = createInstagramOAuthCallbackHandler({ store, meta, env: env() });
  const res = await callback(
    new Request(
      'https://project.supabase.co/functions/v1/instagram-oauth-callback?state=plain-state&code=code-ok',
    ),
  );

  assert.equal(res.status, 303);
  assert.equal(calls.completed.length, 1);
  const completed = calls.completed[0] as {
    organizationId: string;
    accessTokenCiphertext: string;
    profile: { id: string };
  };
  assert.equal(completed.organizationId, ORG);
  assert.notEqual(completed.accessTokenCiphertext.includes('long-token-secret'), true);
  assert.equal(
    await decryptSecret(
      completed.accessTokenCiphertext,
      KEY,
      `${ORG}:instagram:${completed.profile.id}`,
    ),
    'long-token-secret',
  );
  assert.equal(calls.audit.at(-1)?.action, 'instagram.connected');
  assert.equal(JSON.stringify(calls.audit).includes('code-ok'), false);
  assert.equal(JSON.stringify(calls.audit).includes('long-token-secret'), false);
});

Deno.test('callback invalide, expire ou reutilise ne contacte jamais Meta', async () => {
  const { store, meta, calls } = setup();
  const callback = createInstagramOAuthCallbackHandler({ store, meta, env: env() });

  assert.equal(
    (
      await callback(
        new Request(
          'https://project.supabase.co/functions/v1/instagram-oauth-callback?state=inconnu&code=code-ok',
        ),
      )
    ).status,
    400,
  );
  assert.equal(calls.metaCodes.length, 0);
});

Deno.test('callback sans code et echec Meta sont traces sans secret', async () => {
  const { store, meta, calls } = setup();
  const start = createInstagramConnectionHandler({
    store,
    meta,
    env: env(),
    randomState: () => 'plain-state',
  });
  await start(
    request({
      action: 'start',
      organizationId: ORG,
      returnUrl: 'https://app.rezo360.test/settings',
    }),
  );

  const callback = createInstagramOAuthCallbackHandler({ store, meta, env: env() });
  assert.equal(
    (
      await callback(
        new Request(
          'https://project.supabase.co/functions/v1/instagram-oauth-callback?state=plain-state',
        ),
      )
    ).status,
    303,
  );
  assert.equal(calls.audit.at(-1)?.action, 'instagram.connection_failed');

  const second = createInstagramConnectionHandler({
    store,
    meta,
    env: env(),
    randomState: () => 'second-state',
  });
  await second(
    request({
      action: 'start',
      organizationId: ORG,
      returnUrl: 'https://app.rezo360.test/settings',
    }),
  );
  assert.equal(
    (
      await callback(
        new Request(
          'https://project.supabase.co/functions/v1/instagram-oauth-callback?state=second-state&code=meta-fail',
        ),
      )
    ).status,
    303,
  );
  assert.equal(calls.audit.at(-1)?.action, 'instagram.connection_failed');
  assert.equal(JSON.stringify(calls.audit).includes('meta-fail'), false);
});

Deno.test('disconnect coupe la connexion locale et audite sans token', async () => {
  const { store, meta, calls } = setup();
  const handler = createInstagramConnectionHandler({ store, meta, env: env() });
  const res = await handler(request({ action: 'disconnect', organizationId: ORG }));

  assert.equal(res.status, 200);
  assert.equal(calls.disconnected.length, 1);
  assert.equal(calls.audit.at(-1)?.action, 'instagram.disconnected');
});
