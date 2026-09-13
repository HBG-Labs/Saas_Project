import { escapeHtml, type Message, type SendResult } from '../_shared/email.ts';
import { buildMessageId, buildReplyAddress } from '../_shared/portal-mail.ts';

/**
 * Envoi d'un message de la messagerie client.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUI DÉCIDE DE QUOI
 *
 * L'appelant — membre de l'entreprise ou contact du portail — INSÈRE le
 * message sous ses propres droits : la RLS et le trigger `enforce_client_message`
 * décident s'il peut écrire, dans quelle direction, et refusent le reste. Cette
 * fonction ne réécrit aucune de ces règles.
 *
 * Ce qu'elle ajoute, et que le navigateur ne peut pas faire : envoyer le
 * courriel par Resend, avec la clé qui ne sort jamais du serveur, puis
 * consigner l'identifiant fournisseur et le statut — champs que le trigger
 * efface sur toute écriture venue du navigateur.
 *
 * Un message DU CLIENT (portail) n'est pas envoyé par courriel : il est déjà
 * là où l'entreprise le lit. Seul un message DE L'ENTREPRISE part par Resend,
 * avec une adresse de réponse propre à sa conversation et les en-têtes de fil
 * qui permettent au client de répondre depuis sa boîte.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface SendInput {
  conversationId?: string;
  /** Pour ouvrir une conversation — l'entreprise désigne le contact ; le client, lui, est déjà connu. */
  contactId?: string;
  subject?: string;
  body: string;
  missionId?: string;
  quoteId?: string;
  invoiceId?: string;
}

export interface InsertedMessage {
  id: string;
  conversation_id: string;
  organization_id: string;
  direction: 'outbound' | 'inbound';
}

export interface ConversationContext {
  subject: string;
  contactEmail: string;
  contactName: string;
  organizationName: string;
  /** `Message-ID` du dernier message du fil, pour `In-Reply-To`. */
  lastInternetMessageId: string | null;
  /** Nos identifiants déjà émis dans ce fil, pour `References`. */
  references: string[];
}

export interface CallerStore {
  /** Ouvre une conversation sous les droits de l'appelant ; `null` si refusé. */
  createConversation(input: {
    contactId: string | null;
    subject: string;
    missionId: string | null;
    quoteId: string | null;
    invoiceId: string | null;
  }): Promise<{ id: string } | { error: string }>;
  /** Insère sous les droits de l'appelant ; l'erreur RLS/trigger est renvoyée telle quelle. */
  insertMessage(input: { conversationId: string; body: string; subject: string | null }): Promise<InsertedMessage | { error: string }>;
}

export interface AdminStore {
  conversationContext(conversationId: string): Promise<ConversationContext | null>;
  markSent(messageId: string, input: { providerId: string; internetMessageId: string; recipientEmail: string; inReplyTo: string | null; references: string | null }): Promise<void>;
  markFailed(messageId: string, error: string): Promise<void>;
}

export interface SendConfig {
  caller: CallerStore;
  admin: AdminStore;
  send: (message: Message) => Promise<SendResult>;
  replySecret: string;
  inboundDomain: string;
  portalUrl: string;
  /** Défauts du transport, pour répondre 500 avant toute écriture. */
  missing: string[];
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

const MAX_BODY = 20000;
const MAX_SUBJECT = 200;

function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.length > max ? null : trimmed;
}

function optionalId(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

/** Le courriel envoyé au client : son message, un lien vers le portail, la consigne de réponse. */
export function renderOutboundEmail(input: {
  organizationName: string;
  contactName: string;
  body: string;
  portalUrl: string;
}): { html: string; text: string } {
  const paragraphs = input.body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111827;max-width:600px">',
    `<p style="margin:0 0 16px">Bonjour ${escapeHtml(input.contactName)},</p>`,
    paragraphs,
    `<p style="margin:16px 0 0;color:#4b5563;font-size:13px">Vous pouvez répondre directement à cet e-mail, ou consulter l'échange complet sur votre espace client : <a href="${escapeHtml(input.portalUrl)}">${escapeHtml(input.portalUrl)}</a></p>`,
    `<p style="margin:12px 0 0;color:#6b7280;font-size:12px">${escapeHtml(input.organizationName)} · via REZO360</p>`,
    '</div>',
  ].join('');
  const text = [
    `Bonjour ${input.contactName},`,
    '',
    input.body,
    '',
    `Vous pouvez répondre directement à cet e-mail, ou consulter l'échange complet sur votre espace client : ${input.portalUrl}`,
    '',
    `${input.organizationName} · via REZO360`,
  ].join('\n');
  return { html, text };
}

export function createPortalMessageSendHandler(config: SendConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

    if (config.missing.length > 0) {
      return json({ error: `Envoi non configuré : ${config.missing.join(', ')} absent(s) des secrets de la fonction.` }, 500);
    }

    let raw: Record<string, unknown>;
    try {
      raw = await request.json() as Record<string, unknown>;
    } catch {
      return json({ error: 'Corps de requête invalide.' }, 400);
    }

    const body = str(raw.body, MAX_BODY);
    if (body === null) return json({ error: `Le message doit contenir entre 1 et ${MAX_BODY} caractères.` }, 400);

    let conversationId = optionalId(raw.conversationId);
    const subject = str(raw.subject, MAX_SUBJECT);

    if (conversationId === null) {
      if (subject === null) return json({ error: 'Un objet est requis pour ouvrir une conversation.' }, 400);
      const created = await config.caller.createConversation({
        contactId: optionalId(raw.contactId),
        subject,
        missionId: optionalId(raw.missionId),
        quoteId: optionalId(raw.quoteId),
        invoiceId: optionalId(raw.invoiceId),
      });
      if ('error' in created) return json({ error: created.error }, 403);
      conversationId = created.id;
    }

    // L'insertion sous les droits de l'appelant EST l'autorisation.
    const inserted = await config.caller.insertMessage({ conversationId, body, subject });
    if ('error' in inserted) return json({ error: inserted.error }, 403);

    if (inserted.direction === 'inbound') {
      // Écrit par le client depuis le portail : rien ne part par courriel.
      return json({ messageId: inserted.id, conversationId: inserted.conversation_id, status: 'received' });
    }

    const context = await config.admin.conversationContext(inserted.conversation_id);
    if (context === null) {
      await config.admin.markFailed(inserted.id, 'Conversation ou contact introuvable.');
      return json({ messageId: inserted.id, conversationId: inserted.conversation_id, status: 'failed' }, 500);
    }

    const internetMessageId = buildMessageId(inserted.id, config.inboundDomain);
    const replyTo = await buildReplyAddress(inserted.conversation_id, config.replySecret, config.inboundDomain);
    const references = [...context.references, ...(context.lastInternetMessageId ? [context.lastInternetMessageId] : [])]
      .filter((v, i, all) => all.indexOf(v) === i)
      .slice(-20);
    const headers: Record<string, string> = { 'Message-ID': internetMessageId };
    if (context.lastInternetMessageId) headers['In-Reply-To'] = context.lastInternetMessageId;
    if (references.length > 0) headers['References'] = references.join(' ');

    const rendered = renderOutboundEmail({
      organizationName: context.organizationName,
      contactName: context.contactName,
      body,
      portalUrl: config.portalUrl,
    });
    const emailSubject = context.references.length > 0 || context.lastInternetMessageId
      ? (/^re\s*:/i.test(context.subject) ? context.subject : `Re: ${context.subject}`)
      : context.subject;

    try {
      const result = await config.send({
        to: context.contactEmail,
        subject: emailSubject,
        html: rendered.html,
        text: rendered.text,
        replyTo,
        headers,
      });
      await config.admin.markSent(inserted.id, {
        providerId: result.providerId ?? '',
        internetMessageId,
        recipientEmail: context.contactEmail,
        inReplyTo: headers['In-Reply-To'] ?? null,
        references: headers['References'] ?? null,
      });
      return json({ messageId: inserted.id, conversationId: inserted.conversation_id, status: 'sent', providerId: result.providerId ?? null });
    } catch (error) {
      // AC30 — le message reste, en échec, avec le motif : rien n'est perdu ni masqué.
      const reason = error instanceof Error ? error.message : String(error);
      await config.admin.markFailed(inserted.id, reason.slice(0, 500));
      return json({ messageId: inserted.id, conversationId: inserted.conversation_id, status: 'failed', error: reason }, 502);
    }
  };
}
