import type { Message, SendResult } from '../_shared/email.ts';
import {
  deliverOutboundMessage,
  renderOutboundEmail,
  type ConversationContext,
  type EmailAttachmentInput,
  type OutboundStore,
} from '../_shared/portal-outbound.ts';

// Réexportés : les tests et `index.ts` les importaient d'ici.
export { renderOutboundEmail, type ConversationContext, type EmailAttachmentInput };

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
  /**
   * Joindre le PDF de cette facture au courriel. Le serveur vérifie que la
   * facture est celle du client de la conversation, qu'elle est émise, et
   * que son PDF existe — sinon il refuse avant tout envoi.
   */
  attachInvoiceId?: string;
}

export interface InsertedMessage {
  id: string;
  conversation_id: string;
  organization_id: string;
  direction: 'outbound' | 'inbound';
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

export interface AdminStore extends OutboundStore {
  /**
   * Le PDF d'une facture, seulement si elle appartient au client de la
   * conversation et n'est plus un brouillon. `null` sinon — sans distinguer.
   */
  invoiceAttachment(invoiceId: string, conversationId: string): Promise<EmailAttachmentInput | null>;
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

    const attachInvoiceId = optionalId(raw.attachInvoiceId);
    let attachments: EmailAttachmentInput[] = [];
    if (attachInvoiceId !== null) {
      const piece = await config.admin.invoiceAttachment(attachInvoiceId, inserted.conversation_id);
      if (piece === null) {
        // Le message est déjà écrit ; le courriel, lui, n'est pas parti : on le dit.
        await config.admin.markFailed(inserted.id, 'PDF de la facture introuvable ou facture étrangère au client.');
        return json(
          { messageId: inserted.id, conversationId: inserted.conversation_id, status: 'failed', error: 'Le PDF de la facture est introuvable. Générez-le, puis réessayez.' },
          409,
        );
      }
      attachments = [piece];
    }

    const delivered = await deliverOutboundMessage(
      {
        store: config.admin,
        send: config.send,
        replySecret: config.replySecret,
        inboundDomain: config.inboundDomain,
        portalUrl: config.portalUrl,
      },
      inserted,
      body,
      attachments,
    );
    if (delivered.status === 'sent') {
      return json({ messageId: inserted.id, conversationId: inserted.conversation_id, status: 'sent', providerId: delivered.providerId });
    }
    // Conversation introuvable : 500 (état incohérent) ; échec du fournisseur :
    // 502 avec le motif — mêmes réponses qu'avant l'extraction.
    if (delivered.cause === 'context') {
      return json({ messageId: inserted.id, conversationId: inserted.conversation_id, status: 'failed' }, 500);
    }
    return json({ messageId: inserted.id, conversationId: inserted.conversation_id, status: 'failed', error: delivered.error }, 502);
  };
}
