export const INSTAGRAM_GRAPH_API_VERSION = 'v26.0';
export const INSTAGRAM_PROVIDER = 'instagram';
export const INSTAGRAM_OAUTH_URL = 'https://www.instagram.com/oauth/authorize';
export const INSTAGRAM_SHORT_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
export const INSTAGRAM_GRAPH_BASE_URL = 'https://graph.instagram.com';

export const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
] as const;

export type InstagramScope = (typeof INSTAGRAM_SCOPES)[number];

export interface InstagramShortLivedToken {
  accessToken: string;
  userId: string;
  permissions: string[];
}

export interface InstagramLongLivedToken {
  accessToken: string;
  tokenType: string | null;
  expiresIn: number;
}

export interface InstagramProfile {
  id: string;
  username: string | null;
  name: string | null;
  profile_picture_url: string | null;
  account_type: string | null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function randomOAuthState(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function encryptionKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToBytes(base64Key);
  if (raw.byteLength !== 32)
    throw new Error('INSTAGRAM_TOKEN_ENCRYPTION_KEY doit contenir exactement 32 octets.');
  return crypto.subtle.importKey('raw', Uint8Array.from(raw).buffer, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptSecret(secret: string, base64Key: string, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(iv).buffer,
      additionalData: new TextEncoder().encode(context).buffer,
    },
    await encryptionKey(base64Key),
    new TextEncoder().encode(secret),
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(value: string, base64Key: string, context: string) {
  const [version, encodedIv, encodedCiphertext] = value.split('.');
  if (version !== 'v1' || !encodedIv || !encodedCiphertext)
    throw new Error('Jeton Instagram chiffre illisible.');
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: Uint8Array.from(base64ToBytes(encodedIv)).buffer,
      additionalData: new TextEncoder().encode(context).buffer,
    },
    await encryptionKey(base64Key),
    Uint8Array.from(base64ToBytes(encodedCiphertext)).buffer,
  );
  return new TextDecoder().decode(plaintext);
}

export function buildInstagramAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: readonly InstagramScope[];
}) {
  const url = new URL(INSTAGRAM_OAUTH_URL);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', (input.scopes ?? INSTAGRAM_SCOPES).join(','));
  url.searchParams.set('state', input.state);
  return url.toString();
}

function providerMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error;
    if (error && typeof error === 'object') {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 500);
    }
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 500);
  }
  return fallback;
}

async function parseJsonResponse(
  response: Response,
  fallback: string,
): Promise<Record<string, unknown>> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Le statut HTTP reste exploitable si Meta ne renvoie pas de JSON.
  }
  if (!response.ok) throw new Error(providerMessage(payload, fallback));
  if (!payload || typeof payload !== 'object') throw new Error(fallback);
  return payload as Record<string, unknown>;
}

export async function exchangeInstagramCode(
  input: { clientId: string; clientSecret: string; redirectUri: string; code: string },
  fetcher: typeof fetch = fetch,
): Promise<InstagramShortLivedToken> {
  const response = await fetcher(INSTAGRAM_SHORT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
      code: input.code,
    }),
  });
  const payload = await parseJsonResponse(
    response,
    'Meta a retourne une reponse OAuth Instagram incomplete.',
  );
  const accessToken = payload.access_token;
  const userId = payload.user_id;
  const permissions = payload.permissions;
  if (typeof accessToken !== 'string' || !accessToken || typeof userId !== 'string' || !userId)
    throw new Error('Meta a retourne des jetons OAuth Instagram incomplets.');
  return {
    accessToken,
    userId,
    permissions: Array.isArray(permissions)
      ? permissions.filter((permission): permission is string => typeof permission === 'string')
      : [],
  };
}

export async function exchangeInstagramLongLivedToken(
  input: { clientSecret: string; shortLivedAccessToken: string },
  fetcher: typeof fetch = fetch,
): Promise<InstagramLongLivedToken> {
  const url = new URL(`/${INSTAGRAM_GRAPH_API_VERSION}/access_token`, INSTAGRAM_GRAPH_BASE_URL);
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', input.clientSecret);
  url.searchParams.set('access_token', input.shortLivedAccessToken);
  const payload = await parseJsonResponse(
    await fetcher(url),
    'Meta a refuse l’echange du jeton Instagram longue duree.',
  );
  return parseInstagramToken(payload);
}

export async function refreshInstagramLongLivedToken(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<InstagramLongLivedToken> {
  const url = new URL(
    `/${INSTAGRAM_GRAPH_API_VERSION}/refresh_access_token`,
    INSTAGRAM_GRAPH_BASE_URL,
  );
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', accessToken);
  const payload = await parseJsonResponse(
    await fetcher(url),
    'Meta a refuse le renouvellement du jeton Instagram.',
  );
  return parseInstagramToken(payload);
}

function parseInstagramToken(payload: Record<string, unknown>): InstagramLongLivedToken {
  const accessToken = payload.access_token;
  const expiresIn = Number(payload.expires_in);
  const tokenType = payload.token_type;
  if (
    typeof accessToken !== 'string' ||
    !accessToken ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  )
    throw new Error('Meta a retourne un jeton Instagram incomplet.');
  return {
    accessToken,
    expiresIn,
    tokenType: typeof tokenType === 'string' ? tokenType : null,
  };
}

export async function instagramJson<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const url = new URL(`/${INSTAGRAM_GRAPH_API_VERSION}${path}`, INSTAGRAM_GRAPH_BASE_URL);
  url.searchParams.set('access_token', accessToken);
  const response = await fetcher(url, init);
  return (await parseJsonResponse(
    response,
    `Meta a refuse la requete Instagram (${response.status}).`,
  )) as T;
}

export function normalizeInstagramProfile(payload: unknown, fallbackId: string): InstagramProfile {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Le profil Instagram retourne par Meta est incomplet.');
  }
  const row = payload as Record<string, unknown>;
  const id = typeof row.id === 'string' && row.id ? row.id : fallbackId;
  return {
    id,
    username: typeof row.username === 'string' && row.username ? row.username : null,
    name: typeof row.name === 'string' && row.name ? row.name : null,
    profile_picture_url:
      typeof row.profile_picture_url === 'string' && row.profile_picture_url
        ? row.profile_picture_url
        : null,
    account_type:
      typeof row.account_type === 'string' && row.account_type ? row.account_type : null,
  };
}
