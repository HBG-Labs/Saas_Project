import {
  buildInstagramAuthorizationUrl,
  decryptSecret,
  encryptSecret,
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  INSTAGRAM_GRAPH_API_VERSION,
  INSTAGRAM_SCOPES,
  instagramJson,
  normalizeInstagramProfile,
  randomOAuthState,
  refreshInstagramLongLivedToken,
  sha256Hex,
  type InstagramLongLivedToken,
  type InstagramProfile,
} from '../../../src/features/social/instagram-platform.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

export interface InstagramPublicAccount {
  id: string;
  organization_id: string;
  provider: 'instagram';
  provider_account_id: string | null;
  username: string | null;
  display_name: string | null;
  profile_picture_url: string | null;
  account_type: string | null;
  status: 'disconnected' | 'connected' | 'needs_reconnect' | 'error';
  granted_permissions: string[];
  last_synced_at: string | null;
  connected_at: string | null;
  publishing_suspended_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
}

export interface InstagramCredential {
  account_id: string;
  organization_id: string;
  provider_account_id: string;
  access_token_ciphertext: string;
  token_type: string | null;
  access_token_expires_at: string;
  granted_permissions: string[];
}

export interface InstagramOAuthState {
  organization_id: string;
  user_id: string;
  return_url: string;
  scopes: string[];
}

export interface InstagramConnectionStore {
  authenticate(authorization: string): Promise<{ userId: string } | null>;
  canManage(organizationId: string, authorization: string): Promise<boolean>;
  getAccount(organizationId: string): Promise<InstagramPublicAccount | null>;
  cleanupExpiredOAuthStates(nowIso: string): Promise<void>;
  createOAuthState(input: {
    stateSha256: string;
    organizationId: string;
    userId: string;
    returnUrl: string;
    scopes: string[];
    expiresAt: string;
  }): Promise<void>;
  consumeOAuthState(stateSha256: string, consumedAt: string): Promise<InstagramOAuthState | null>;
  getCredential(organizationId: string): Promise<InstagramCredential | null>;
  completeConnection(input: {
    organizationId: string;
    userId: string;
    profile: InstagramProfile;
    grantedPermissions: string[];
    accessTokenCiphertext: string;
    tokenType: string | null;
    accessTokenExpiresAt: string;
  }): Promise<string>;
  disconnect(organizationId: string, userId: string): Promise<boolean>;
  audit(input: {
    organizationId: string;
    userId: string | null;
    action: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface InstagramMetaClient {
  authorizationUrl(input: { clientId: string; redirectUri: string; state: string }): string;
  exchangeCode(input: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    code: string;
  }): Promise<{
    shortToken: { accessToken: string; userId: string; permissions: string[] };
    longToken: InstagramLongLivedToken;
  }>;
  refreshToken(accessToken: string): Promise<InstagramLongLivedToken>;
  profile(accessToken: string, fallbackId: string): Promise<InstagramProfile>;
}

export interface InstagramConnectionEnv {
  supabaseUrl: string;
  appUrl: string;
  appId: string;
  appSecret: string;
  encryptionKey: string;
}

export interface InstagramConnectionHandlerOptions {
  store: InstagramConnectionStore;
  env: InstagramConnectionEnv;
  meta?: InstagramMetaClient;
  now?: () => Date;
  randomState?: () => string;
}

export function defaultInstagramMetaClient(fetcher: typeof fetch = fetch): InstagramMetaClient {
  return {
    authorizationUrl: ({ clientId, redirectUri, state }) =>
      buildInstagramAuthorizationUrl({ clientId, redirectUri, state }),
    async exchangeCode({ clientId, clientSecret, redirectUri, code }) {
      const shortToken = await exchangeInstagramCode(
        { clientId, clientSecret, redirectUri, code },
        fetcher,
      );
      const longToken = await exchangeInstagramLongLivedToken(
        { clientSecret, shortLivedAccessToken: shortToken.accessToken },
        fetcher,
      );
      return { shortToken, longToken };
    },
    refreshToken: (accessToken) => refreshInstagramLongLivedToken(accessToken, fetcher),
    async profile(accessToken, fallbackId) {
      const payload = await instagramJson<unknown>(
        '/me?fields=id,username,name,profile_picture_url,account_type',
        accessToken,
        {},
        fetcher,
      );
      return normalizeInstagramProfile(payload, fallbackId);
    },
  };
}

function configured(env: InstagramConnectionEnv) {
  return Boolean(env.appId.trim() && env.appSecret.trim() && env.encryptionKey.trim());
}

function redirectUri(env: InstagramConnectionEnv) {
  return `${env.supabaseUrl}/functions/v1/instagram-oauth-callback`;
}

function safeReturnUrl(raw: unknown, appUrl: string): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    const app = new URL(appUrl);
    if (url.origin !== app.origin) return null;
    if (url.pathname !== '/settings') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function htmlError(message: string, status = 400) {
  return new Response(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Connexion Instagram impossible</title><body><h1>Connexion Instagram impossible</h1><p>${message}</p><p>Vous pouvez fermer cette page et revenir dans REZO360.</p></body></html>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    },
  );
}

function redirect(returnUrl: string, result: string) {
  const url = new URL(returnUrl);
  url.searchParams.set('instagram', result);
  return Response.redirect(url, 303);
}

function tokenContext(organizationId: string, providerAccountId: string) {
  return `${organizationId}:instagram:${providerAccountId}`;
}

async function auditSafe(
  store: InstagramConnectionStore,
  input: Parameters<InstagramConnectionStore['audit']>[0],
) {
  try {
    await store.audit(input);
  } catch (error) {
    console.error(
      'instagram connection: audit failed',
      error instanceof Error ? error.name : 'unknown',
    );
  }
}

async function persistConnection(input: {
  store: InstagramConnectionStore;
  env: InstagramConnectionEnv;
  userId: string;
  organizationId: string;
  profile: InstagramProfile;
  permissions: string[];
  token: InstagramLongLivedToken;
}) {
  const accessTokenCiphertext = await encryptSecret(
    input.token.accessToken,
    input.env.encryptionKey,
    tokenContext(input.organizationId, input.profile.id),
  );
  const expiresAt = new Date(Date.now() + input.token.expiresIn * 1000).toISOString();
  return input.store.completeConnection({
    organizationId: input.organizationId,
    userId: input.userId,
    profile: input.profile,
    grantedPermissions: input.permissions,
    accessTokenCiphertext,
    tokenType: input.token.tokenType,
    accessTokenExpiresAt: expiresAt,
  });
}

export function createInstagramConnectionHandler(options: InstagramConnectionHandlerOptions) {
  const meta = options.meta ?? defaultInstagramMetaClient();
  const now = options.now ?? (() => new Date());
  const randomStateFn = options.randomState ?? randomOAuthState;

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Methode non autorisee.' }, 405);

    const authorization = request.headers.get('Authorization') ?? '';
    if (!/^Bearer\s+\S+$/i.test(authorization))
      return json({ error: 'Authentification requise.' }, 401);

    let body: { action?: unknown; organizationId?: unknown; returnUrl?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: 'Requete illisible.' }, 400);
    }
    if (
      !['readiness', 'start', 'sync', 'disconnect'].includes(String(body.action)) ||
      typeof body.organizationId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(body.organizationId)
    )
      return json({ error: 'Action ou organisation invalide.' }, 400);

    const auth = await options.store.authenticate(authorization);
    if (!auth) return json({ error: 'Votre session a expire. Reconnectez-vous.' }, 401);
    const canManage = await options.store.canManage(body.organizationId, authorization);
    if (!canManage)
      return json(
        {
          error: 'Seul un proprietaire ou administrateur avec Social Studio peut gerer Instagram.',
        },
        403,
      );

    if (body.action === 'readiness') {
      return json({
        configured: configured(options.env),
        graphApiVersion: INSTAGRAM_GRAPH_API_VERSION,
        scopes: INSTAGRAM_SCOPES,
      });
    }
    if (!configured(options.env))
      return json({ error: 'La configuration Meta Instagram serveur est incomplete.' }, 503);

    try {
      if (body.action === 'start') {
        const returnUrl = safeReturnUrl(body.returnUrl, options.env.appUrl);
        if (!returnUrl) return json({ error: 'Adresse de retour invalide.' }, 400);
        const state = randomStateFn();
        const stateSha256 = await sha256Hex(state);
        const issuedAt = now();
        await options.store.cleanupExpiredOAuthStates(issuedAt.toISOString());
        await options.store.createOAuthState({
          stateSha256,
          organizationId: body.organizationId,
          userId: auth.userId,
          returnUrl,
          scopes: [...INSTAGRAM_SCOPES],
          expiresAt: new Date(issuedAt.getTime() + 10 * 60_000).toISOString(),
        });
        await auditSafe(options.store, {
          organizationId: body.organizationId,
          userId: auth.userId,
          action: 'instagram.connection_started',
          metadata: { scopes: INSTAGRAM_SCOPES, graphApiVersion: INSTAGRAM_GRAPH_API_VERSION },
        });
        return json({
          url: meta.authorizationUrl({
            clientId: options.env.appId,
            redirectUri: redirectUri(options.env),
            state,
          }),
        });
      }

      if (body.action === 'disconnect') {
        await options.store.disconnect(body.organizationId, auth.userId);
        await auditSafe(options.store, {
          organizationId: body.organizationId,
          userId: auth.userId,
          action: 'instagram.disconnected',
          metadata: { provider: 'instagram' },
        });
        return json({ status: 'disconnected' });
      }

      const credential = await options.store.getCredential(body.organizationId);
      if (!credential) return json({ error: 'Aucune connexion Instagram a synchroniser.' }, 404);
      let accessToken = await decryptSecret(
        credential.access_token_ciphertext,
        options.env.encryptionKey,
        tokenContext(body.organizationId, credential.provider_account_id),
      );
      let token: InstagramLongLivedToken = {
        accessToken,
        tokenType: credential.token_type,
        expiresIn: Math.max(
          1,
          Math.floor((Date.parse(credential.access_token_expires_at) - Date.now()) / 1000),
        ),
      };
      if (
        Date.parse(credential.access_token_expires_at) <=
        now().getTime() + 7 * 24 * 60 * 60_000
      ) {
        token = await meta.refreshToken(accessToken);
        accessToken = token.accessToken;
      }
      const profile = await meta.profile(accessToken, credential.provider_account_id);
      const accountId = await persistConnection({
        store: options.store,
        env: options.env,
        userId: auth.userId,
        organizationId: body.organizationId,
        profile,
        permissions: credential.granted_permissions.length
          ? credential.granted_permissions
          : [...INSTAGRAM_SCOPES],
        token,
      });
      return json({ status: 'connected', accountId });
    } catch (error) {
      await auditSafe(options.store, {
        organizationId: body.organizationId,
        userId: auth.userId,
        action: 'instagram.connection_failed',
        metadata: { reason: error instanceof Error ? error.name : 'unknown' },
      });
      console.error('instagram connection failed', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'La connexion Instagram a echoue.' }, 502);
    }
  };
}

export function createInstagramOAuthCallbackHandler(options: InstagramConnectionHandlerOptions) {
  const meta = options.meta ?? defaultInstagramMetaClient();
  const now = options.now ?? (() => new Date());

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') return htmlError('Methode non autorisee.', 405);
    if (!configured(options.env)) return htmlError('Configuration Instagram incomplete.', 503);

    const requestUrl = new URL(request.url);
    const rawState = requestUrl.searchParams.get('state') ?? '';
    if (!rawState) return htmlError('Le jeton de retour est absent.');

    const consumedAt = now().toISOString();
    const state = await options.store.consumeOAuthState(await sha256Hex(rawState), consumedAt);
    if (!state) return htmlError('Ce retour a expire ou a deja ete utilise.');

    const previous = await options.store.getAccount(state.organization_id);
    if (requestUrl.searchParams.has('error')) {
      await auditSafe(options.store, {
        organizationId: state.organization_id,
        userId: state.user_id,
        action: 'instagram.connection_failed',
        metadata: { reason: 'oauth_error' },
      });
      return redirect(state.return_url, 'annulee');
    }

    const code = requestUrl.searchParams.get('code') ?? '';
    if (!code) {
      await auditSafe(options.store, {
        organizationId: state.organization_id,
        userId: state.user_id,
        action: 'instagram.connection_failed',
        metadata: { reason: 'missing_code' },
      });
      return redirect(state.return_url, 'erreur');
    }

    try {
      const tokens = await meta.exchangeCode({
        clientId: options.env.appId,
        clientSecret: options.env.appSecret,
        redirectUri: redirectUri(options.env),
        code,
      });
      const profile = await meta.profile(tokens.longToken.accessToken, tokens.shortToken.userId);
      const grantedPermissions = tokens.shortToken.permissions.length
        ? tokens.shortToken.permissions
        : state.scopes;
      const accountId = await persistConnection({
        store: options.store,
        env: options.env,
        userId: state.user_id,
        organizationId: state.organization_id,
        profile,
        permissions: grantedPermissions,
        token: tokens.longToken,
      });
      await auditSafe(options.store, {
        organizationId: state.organization_id,
        userId: state.user_id,
        action: previous?.status === 'connected' ? 'instagram.reconnected' : 'instagram.connected',
        entityId: accountId,
        metadata: { provider: 'instagram', scopes: grantedPermissions },
      });
      return redirect(state.return_url, 'ok');
    } catch (error) {
      await auditSafe(options.store, {
        organizationId: state.organization_id,
        userId: state.user_id,
        action: 'instagram.connection_failed',
        metadata: { reason: error instanceof Error ? error.name : 'unknown' },
      });
      console.error(
        'instagram oauth callback failed',
        error instanceof Error ? error.name : 'unknown',
      );
      return redirect(state.return_url, 'erreur');
    }
  };
}
