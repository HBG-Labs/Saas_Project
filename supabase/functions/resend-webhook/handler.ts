import {
  extractReplyText,
  normalizeEmail,
  resolveInbound,
  verifySvixSignature,
} from '../_shared/portal-mail.ts';

/**
 * Webhook Resend : réponses entrantes et statuts de distribution.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TROIS BARRIÈRES AVANT D'ÉCRIRE QUOI QUE CE SOIT
 *
 *   1. La signature Svix. Absente ou fausse : 401, et rien n'est lu.
 *   2. L'idempotence. `svix-id` est la clé de `resend_events` : un événement
 *      rejoué est absorbé et répond 200 sans rien refaire — sauf si son
 *      traitement précédent avait ÉCHOUÉ, auquel cas le rejeu est le second
 *      essai qu'on attendait.
 *   3. Le rattachement. Une réponse n'est écrite que si l'adresse de réponse
 *      (HMAC) ou l'un de nos `Message-ID` la désigne sans ambiguïté, ET si
 *      l'expéditeur est le contact de cette conversation. Tout le reste est
 *      mis en quarantaine, journalisé, jamais deviné.
 *
 * Le stockage et l'API Resend sont injectés : ce fichier ne connaît ni
 * supabase-js ni `fetch`, et se teste avec des doublures.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ConversationRef {
  id: string;
  organization_id: string;
  contact_email: string;
  status: 'open' | 'closed';
}

export interface InboundAttachmentMeta {
  id: string;
  filename: string;
  content_type: string;
  size: number;
}

export interface ReceivedEmail {
  from: string;
  to: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
  headers: Record<string, string>;
  attachments: InboundAttachmentMeta[];
}

export interface WebhookStore {
  /** `new` si jamais vu — ou vu mais en échec ; `duplicate` sinon. */
  recordEvent(input: { id: string; type: string; emailId: string | null; payload: unknown }): Promise<'new' | 'duplicate'>;
  finishEvent(id: string, outcome: 'processed' | 'ignored' | 'unmatched' | 'rejected' | 'failed', detail?: string): Promise<void>;
  findConversationById(id: string): Promise<ConversationRef | null>;
  findConversationByMessageId(messageId: string): Promise<ConversationRef | null>;
  insertInboundMessage(input: {
    conversationId: string;
    organizationId: string;
    senderEmail: string;
    recipientEmail: string | null;
    subject: string | null;
    bodyText: string;
    bodyHtml: string | null;
    resendEmailId: string;
    internetMessageId: string | null;
    inReplyTo: string | null;
    referencesHeader: string | null;
  }): Promise<{ id: string }>;
  storeAttachment(input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
    filename: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<void>;
  /** Vrai si un message portait cet identifiant fournisseur. */
  updateDeliveryStatus(resendEmailId: string, status: 'delivered' | 'bounced' | 'complained', at: string): Promise<boolean>;
}

export interface ResendReceiving {
  getReceived(emailId: string): Promise<ReceivedEmail | null>;
  getAttachment(emailId: string, attachmentId: string): Promise<Uint8Array | null>;
}

export interface WebhookConfig {
  webhookSecret: string;
  replySecret: string;
  inboundDomain: string;
  store: WebhookStore;
  resend: ResendReceiving;
  now?: () => Date;
}

/** Ce qu'une pièce jointe entrante a le droit d'être. Le reste est ignoré, pas refusé en bloc. */
const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
const ATTACHMENT_MIME_ALLOWLIST = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

interface WebhookPayload {
  type?: unknown;
  data?: { email_id?: unknown };
}

function header(headers: Record<string, string>, name: string): string | null {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return null;
}

export function createResendWebhookHandler(config: WebhookConfig) {
  const clock = config.now ?? (() => new Date());

  async function handleReceived(eventId: string, emailId: string): Promise<Response> {
    const { store, resend } = config;
    const received = await resend.getReceived(emailId);
    if (received === null) {
      await store.finishEvent(eventId, 'failed', 'Contenu introuvable chez le fournisseur.');
      return json({ error: 'Contenu introuvable.' }, 502);
    }

    const resolution = await resolveInbound(
      {
        to: received.to,
        inReplyTo: header(received.headers, 'In-Reply-To'),
        references: header(received.headers, 'References'),
      },
      config.replySecret,
      config.inboundDomain,
    );

    let conversation: ConversationRef | null = null;
    if (resolution.kind === 'conversation') {
      conversation = await store.findConversationById(resolution.conversationId);
    } else if (resolution.kind === 'message') {
      conversation = await store.findConversationByMessageId(resolution.messageId);
    }

    if (conversation === null) {
      // AC29 — jamais affecté au mieux. On garde assez pour comprendre.
      await store.finishEvent(
        eventId,
        'unmatched',
        `de=${normalizeEmail(received.from)} vers=${received.to.join(',')} indice=${resolution.kind}`,
      );
      return json({ received: true, matched: false });
    }

    // L'adresse de réponse ou le fil désignent la conversation ; l'expéditeur
    // doit encore être le contact de cette conversation. Un tiers qui aurait
    // intercepté l'adresse n'écrit pas au nom du client.
    const sender = normalizeEmail(received.from);
    if (sender !== normalizeEmail(conversation.contact_email)) {
      await store.finishEvent(eventId, 'rejected', `expediteur=${sender} attendu=${normalizeEmail(conversation.contact_email)}`);
      return json({ received: true, matched: false });
    }

    if (conversation.status !== 'open') {
      await store.finishEvent(eventId, 'rejected', 'conversation close');
      return json({ received: true, matched: false });
    }

    const text = received.text ?? '';
    const bodyText = extractReplyText(text) || text.trim() || '(message vide)';

    const inserted = await store.insertInboundMessage({
      conversationId: conversation.id,
      organizationId: conversation.organization_id,
      senderEmail: sender,
      recipientEmail: received.to[0] ?? null,
      subject: received.subject,
      bodyText: bodyText.slice(0, 20000),
      bodyHtml: received.html,
      resendEmailId: emailId,
      internetMessageId: header(received.headers, 'Message-ID'),
      inReplyTo: header(received.headers, 'In-Reply-To'),
      referencesHeader: header(received.headers, 'References'),
    });

    let kept = 0;
    let skipped = 0;
    for (const piece of received.attachments) {
      if (piece.size > ATTACHMENT_MAX_BYTES || !ATTACHMENT_MIME_ALLOWLIST.has(piece.content_type.toLowerCase())) {
        skipped += 1;
        continue;
      }
      const bytes = await resend.getAttachment(emailId, piece.id);
      if (bytes === null) {
        skipped += 1;
        continue;
      }
      await store.storeAttachment({
        organizationId: conversation.organization_id,
        conversationId: conversation.id,
        messageId: inserted.id,
        filename: piece.filename,
        contentType: piece.content_type,
        bytes,
      });
      kept += 1;
    }

    const via = resolution.kind === 'unmatched' ? 'aucun' : resolution.via;
    await store.finishEvent(eventId, 'processed', `message=${inserted.id} via=${via} pj=${kept}/${kept + skipped}`);
    return json({ received: true, matched: true });
  }

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

    const rawBody = await request.text();
    const ok = await verifySvixSignature(
      {
        id: request.headers.get('svix-id'),
        timestamp: request.headers.get('svix-timestamp'),
        signature: request.headers.get('svix-signature'),
      },
      rawBody,
      config.webhookSecret,
      Math.floor(clock().getTime() / 1000),
    );
    if (!ok) return json({ error: 'Signature invalide.' }, 401);

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      return json({ error: 'Corps invalide.' }, 400);
    }
    const type = typeof payload?.type === 'string' ? payload.type : '';
    const emailId = typeof payload?.data?.email_id === 'string' ? payload.data.email_id : null;
    const eventId = request.headers.get('svix-id') ?? '';

    const { store } = config;
    const state = await store.recordEvent({ id: eventId, type, emailId, payload });
    if (state === 'duplicate') return json({ duplicate: true });

    try {
      if (type === 'email.received') {
        if (emailId === null) {
          await store.finishEvent(eventId, 'rejected', 'email_id absent');
          return json({ error: 'email_id absent.' }, 400);
        }
        return await handleReceived(eventId, emailId);
      }

      if (type === 'email.delivered' || type === 'email.bounced' || type === 'email.complained') {
        const status = type.slice('email.'.length) as 'delivered' | 'bounced' | 'complained';
        const touched = emailId === null ? false : await store.updateDeliveryStatus(emailId, status, clock().toISOString());
        await store.finishEvent(eventId, touched ? 'processed' : 'ignored', touched ? undefined : 'aucun message pour cet identifiant');
        return json({ received: true, updated: touched });
      }

      await store.finishEvent(eventId, 'ignored', `type=${type}`);
      return json({ received: true, ignored: true });
    } catch (error) {
      // Marqué en échec : un rejeu de Resend sera traité comme un nouvel essai.
      await store.finishEvent(eventId, 'failed', error instanceof Error ? error.message : String(error));
      return json({ error: 'Traitement échoué.' }, 500);
    }
  };
}
