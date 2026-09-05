export const SUPERPDP_API_URL = 'https://api.superpdp.tech';
export const SUPERPDP_PROVIDER_CODE = 'superpdp';

export type NormalizedTransmissionStatus = 'submitted' | 'delivered' | 'accepted' | 'rejected';

export interface SuperPdpToken {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface SuperPdpSession {
  client_id: string;
  created_at: string;
  company_verification_status: 'verified' | 'needs_review' | 'failed';
  user_identity_verification_status?: 'verified' | 'needs_review' | 'failed' | 'not_verified';
}

export interface SuperPdpCompany {
  id: number;
  env: 'sandbox' | 'production';
  number: string;
  formal_name: string;
  trade_name: string;
}

export function frenchSiren(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, '') ?? '';
  return digits.length === 9 || digits.length === 14 ? digits.slice(0, 9) : null;
}

export interface SuperPdpInvoiceEvent {
  id: number;
  invoice_id: number;
  status_code: string;
  status_text: string;
  created_at: string;
  data?: { reason?: unknown };
  details?: Array<{
    reason?: unknown;
    notes?: Array<{
      subject?: unknown;
      contents?: Array<{ content?: unknown }>;
    }>;
    reported_data?: Array<{
      description?: unknown;
      name?: unknown;
      value?: unknown;
      code?: unknown;
    }>;
  }>;
}

function conciseText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text || null;
}

export function superPdpEventMessage(event: SuperPdpInvoiceEvent): string {
  const parts: string[] = [];
  const add = (value: unknown) => {
    const text = conciseText(value);
    if (text && !parts.includes(text)) parts.push(text);
  };

  add(event.status_text);
  add(event.data?.reason);
  for (const detail of event.details ?? []) {
    add(detail.reason);
    for (const note of detail.notes ?? []) {
      const contents = (note.contents ?? [])
        .map((content) => conciseText(content.content))
        .filter((content): content is string => content !== null);
      const subject = conciseText(note.subject);
      if (subject && contents.length > 0) add(`${subject} : ${contents.join(' ')}`);
      else {
        add(subject);
        for (const content of contents) add(content);
      }
    }
    for (const reported of detail.reported_data ?? []) {
      add(reported.description);
      if (!conciseText(reported.description)) {
        const label = conciseText(reported.name) ?? conciseText(reported.code);
        const value = conciseText(reported.value);
        add(label && value ? `${label} : ${value}` : (label ?? value));
      }
    }
  }
  return parts.join(' · ').slice(0, 1000) || event.status_code.slice(0, 1000);
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
    throw new Error('SUPERPDP_TOKEN_ENCRYPTION_KEY doit contenir exactement 32 octets.');
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
    throw new Error('Jeton chiffre illisible.');
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

export function buildSuperPdpAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  loginHint?: string;
  siren?: string;
}) {
  const url = new URL('/oauth2/authorize', SUPERPDP_API_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  url.searchParams.set('superpdp_send_and_receive', 'send');
  if (input.loginHint) url.searchParams.set('login_hint', input.loginHint);
  if (input.siren) {
    url.searchParams.set('superpdp_company_number', input.siren);
    url.searchParams.set('superpdp_company_number_scheme', 'fr_siren');
  }
  return url.toString();
}

function providerMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 500);
  }
  return fallback;
}

async function formRequest(
  path: string,
  params: URLSearchParams,
  fetcher: typeof fetch,
): Promise<Record<string, unknown>> {
  const response = await fetcher(`${SUPERPDP_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Le statut HTTP reste exploitable si la plateforme ne renvoie pas de JSON.
  }
  if (!response.ok)
    throw new Error(
      providerMessage(payload, `SUPER PDP a refuse la requete (${response.status}).`),
    );
  if (!payload || typeof payload !== 'object')
    throw new Error('SUPER PDP a retourne une reponse OAuth incomplete.');
  return payload as Record<string, unknown>;
}

function parseToken(
  payload: Record<string, unknown>,
  previousRefreshToken?: string,
): SuperPdpToken {
  const accessToken = payload.access_token;
  const refreshToken = payload.refresh_token ?? previousRefreshToken;
  const tokenType = payload.token_type ?? 'Bearer';
  const expiresIn = Number(payload.expires_in);
  if (
    typeof accessToken !== 'string' ||
    !accessToken ||
    typeof refreshToken !== 'string' ||
    !refreshToken ||
    typeof tokenType !== 'string' ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  )
    throw new Error('SUPER PDP a retourne des jetons OAuth incomplets.');
  return { accessToken, refreshToken, tokenType, expiresIn };
}

export async function exchangeSuperPdpCode(
  input: { clientId: string; clientSecret: string; redirectUri: string; code: string },
  fetcher: typeof fetch = fetch,
) {
  const payload = await formRequest(
    '/oauth2/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    }),
    fetcher,
  );
  return parseToken(payload);
}

export async function refreshSuperPdpToken(
  input: { clientId: string; clientSecret: string; refreshToken: string },
  fetcher: typeof fetch = fetch,
) {
  const payload = await formRequest(
    '/oauth2/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
    }),
    fetcher,
  );
  return parseToken(payload, input.refreshToken);
}

export async function revokeSuperPdpToken(token: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`${SUPERPDP_API_URL}/oauth2/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  });
  return response.ok;
}

export async function superPdpJson<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const response = await fetcher(`${SUPERPDP_API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...init.headers },
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Le message de repli ci-dessous reste actionnable.
  }
  if (!response.ok)
    throw new Error(
      providerMessage(payload, `SUPER PDP a refuse la requete (${response.status}).`),
    );
  return payload as T;
}

export function normalizeSuperPdpStatus(code: string): NormalizedTransmissionStatus | null {
  if (
    code === 'api:invalid' ||
    code === 'api:rejected' ||
    ['fr:210', 'fr:213', 'fr:501'].includes(code) ||
    /-(?:ack-error|rejected)$/.test(code)
  )
    return 'rejected';
  if (code === 'api:accepted' || code === 'fr:205') return 'accepted';
  if (['api:sent', 'api:received', 'api:acknowledged'].includes(code) || /^fr:20[1-9]$/.test(code))
    return 'delivered';
  if (['api:uploaded', 'api:validated', 'fr:200'].includes(code)) return 'submitted';
  return null;
}

export function connectionStatus(session: SuperPdpSession) {
  if (session.company_verification_status === 'verified') return 'connected' as const;
  if (session.company_verification_status === 'failed') return 'action_required' as const;
  return 'pending_verification' as const;
}
