/**
 * Messagerie du portail client — la partie pure, sans réseau ni base.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMMENT UNE RÉPONSE RETROUVE SA CONVERSATION
 *
 * Chaque message sortant porte une adresse de réponse propre à sa
 * conversation :
 *
 *     reply+<identifiant sans tirets>.<hmac tronqué>@inbound.rezo360.fr
 *
 * Le HMAC est calculé côté serveur à partir d'un secret d'environnement. Le
 * webhook entrant recalcule et compare en temps constant. Rien n'est stocké :
 * l'identifiant de conversation n'est pas un secret, c'est le HMAC qui fait
 * autorité. Une rotation du secret invalide toutes les adresses émises — c'est
 * la révocation globale.
 *
 * Deux indices de plus, par ordre de fiabilité décroissante : `In-Reply-To`
 * puis `References`, qui portent le `Message-ID` que nous avons posé nous-mêmes
 * sur le message d'origine. Un entrant qu'aucun indice ne rattache de façon
 * SÛRE n'est jamais affecté « au mieux » : il est mis en quarantaine.
 *
 * SIGNATURE DES WEBHOOKS
 *
 * Resend signe avec Svix : `svix-id`, `svix-timestamp`, `svix-signature`
 * (`v1,<base64>`), HMAC-SHA256 de « id.timestamp.corps » avec le secret
 * `whsec_…` décodé de base64. Une signature absente, invalide ou trop vieille
 * (cinq minutes) est rejetée avant toute lecture du corps.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: ArrayBuffer): string {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Comparaison en temps constant : la longueur du préfixe commun ne fuit pas. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256(key: Uint8Array | string, message: string): Promise<ArrayBuffer> {
  const keyBytes = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

// ---------------------------------------------------------------- adresses

/** Seize hexadécimaux : 64 bits, assez pour rendre la forge impraticable. */
const TAG_LENGTH = 16;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function compactUuid(id: string): string {
  return id.toLowerCase().replaceAll('-', '');
}

function expandUuid(compact: string): string {
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

async function replyTag(conversationId: string, secret: string): Promise<string> {
  const mac = await hmacSha256(secret, `reply:${conversationId.toLowerCase()}`);
  return toHex(mac).slice(0, TAG_LENGTH);
}

/** Adresse de réponse d'une conversation. */
export async function buildReplyAddress(
  conversationId: string,
  secret: string,
  inboundDomain: string,
): Promise<string> {
  if (!UUID_RE.test(conversationId)) throw new Error('Identifiant de conversation invalide.');
  const tag = await replyTag(conversationId, secret);
  return `reply+${compactUuid(conversationId)}.${tag}@${inboundDomain.toLowerCase()}`;
}

/**
 * Retrouve la conversation depuis une adresse de destination. `null` si
 * l'adresse n'est pas la nôtre, n'a pas la bonne forme, ou porte un HMAC qui
 * ne correspond pas — sans distinguer ces cas pour l'appelant.
 */
export async function parseReplyAddress(
  address: string,
  secret: string,
  inboundDomain: string,
): Promise<string | null> {
  const match = /^reply\+([0-9a-f]{32})\.([0-9a-f]{16})@(.+)$/i.exec(address.trim());
  if (match === null) return null;
  const [, compact, tag, domain] = match;
  if (domain === undefined || domain.toLowerCase() !== inboundDomain.toLowerCase()) return null;
  if (compact === undefined || tag === undefined) return null;
  const conversationId = expandUuid(compact.toLowerCase());
  const expected = await replyTag(conversationId, secret);
  return constantTimeEqual(expected, tag.toLowerCase()) ? conversationId : null;
}

// --------------------------------------------------------------- Message-ID

export function buildMessageId(messageId: string, inboundDomain: string): string {
  return `<msg-${messageId.toLowerCase()}@${inboundDomain.toLowerCase()}>`;
}

/** L'identifiant de message porté par un `Message-ID` que NOUS avons émis. */
export function parseMessageId(header: string | null | undefined, inboundDomain: string): string | null {
  if (!header) return null;
  const match = /<msg-([0-9a-f-]{36})@([^>]+)>/i.exec(header);
  if (match === null) return null;
  const [, id, domain] = match;
  if (id === undefined || domain === undefined) return null;
  if (domain.toLowerCase() !== inboundDomain.toLowerCase()) return null;
  return UUID_RE.test(id) ? id.toLowerCase() : null;
}

/** Tous nos identifiants présents dans un `References`, dans l'ordre. */
export function parseReferences(header: string | null | undefined, inboundDomain: string): string[] {
  if (!header) return [];
  const ids: string[] = [];
  for (const piece of header.match(/<[^>]+>/g) ?? []) {
    const id = parseMessageId(piece, inboundDomain);
    if (id !== null) ids.push(id);
  }
  return ids;
}

// ----------------------------------------------------------------- Svix

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

/** Cinq minutes : la tolérance recommandée par Svix contre le rejeu. */
const SVIX_TOLERANCE_SECONDS = 300;

export async function verifySvixSignature(
  headers: SvixHeaders,
  rawBody: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!headers.id || !headers.timestamp || !headers.signature || !secret) return false;

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > SVIX_TOLERANCE_SECONDS) return false;

  const keyMaterial = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let key: Uint8Array;
  try {
    key = fromBase64(keyMaterial);
  } catch {
    return false;
  }

  const expected = toBase64(await hmacSha256(key, `${headers.id}.${headers.timestamp}.${rawBody}`));

  // Plusieurs signatures peuvent être présentes (rotation de secret) :
  // « v1,xxx v1,yyy ». Une seule doit correspondre.
  for (const candidate of headers.signature.split(' ')) {
    const [version, value] = candidate.split(',');
    if (version !== 'v1' || value === undefined) continue;
    if (constantTimeEqual(value, expected)) return true;
  }
  return false;
}

// ------------------------------------------------------ nettoyage de réponse

/**
 * Garde ce que la personne a écrit, retire ce que son logiciel a cité.
 *
 * Volontairement conservateur : on ne coupe qu'aux marques universelles — les
 * lignes citées par « > » et l'en-tête « Le … a écrit : » ou « On … wrote: ».
 * Couper trop serait perdre une phrase du client ; ne pas couper assez
 * n'affiche que du texte qu'il a lui-même envoyé.
 */
export function extractReplyText(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(Le .+ a écrit\s*:|On .+ wrote\s*:|-{2,}\s*Original Message\s*-{2,}|_{5,})$/i.test(trimmed)) break;
    if (trimmed.startsWith('>')) continue;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ------------------------------------------------------------ rattachement

export interface InboundHints {
  to: string[];
  inReplyTo?: string | null;
  references?: string | null;
}

export type InboundResolution =
  | { kind: 'conversation'; conversationId: string; via: 'reply_address' }
  | { kind: 'message'; messageId: string; via: 'in_reply_to' | 'references' }
  | { kind: 'unmatched' };

/**
 * Cherche un indice SÛR, dans l'ordre : adresse de réponse (HMAC), puis
 * `In-Reply-To`, puis `References`. Ne devine jamais.
 */
export async function resolveInbound(
  hints: InboundHints,
  secret: string,
  inboundDomain: string,
): Promise<InboundResolution> {
  for (const address of hints.to) {
    const conversationId = await parseReplyAddress(address, secret, inboundDomain);
    if (conversationId !== null) return { kind: 'conversation', conversationId, via: 'reply_address' };
  }
  const replied = parseMessageId(hints.inReplyTo, inboundDomain);
  if (replied !== null) return { kind: 'message', messageId: replied, via: 'in_reply_to' };
  const refs = parseReferences(hints.references, inboundDomain);
  const last = refs.at(-1);
  if (last !== undefined) return { kind: 'message', messageId: last, via: 'references' };
  return { kind: 'unmatched' };
}

// ------------------------------------------------------------ adresse email

/** Une adresse nue, minuscule, extraite de « Nom <adresse> » ou « adresse ». */
export function normalizeEmail(value: string): string {
  const match = /<([^>]+)>/.exec(value);
  return (match?.[1] ?? value).trim().toLowerCase();
}
