import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import { escapeHtml, type Message, type SendResult } from './email.ts';
import { buildMessageId, buildReplyAddress } from './portal-mail.ts';

/**
 * Expédition d'un message sortant de la messagerie client, une fois qu'il est
 * inséré dans `client_messages`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER
 *
 * Ce bloc vivait dans `portal-message-send/handler.ts`. Les relances de devis
 * ont besoin d'envoyer EXACTEMENT le même courriel — même fil (`In-Reply-To`,
 * `References`), même adresse de réponse signée, même gabarit, même suivi
 * `markSent`/`markFailed` — mais sans utilisateur connecté : c'est le worker
 * qui écrit, au nom de l'entreprise. Copier ce bloc aurait produit deux
 * façons de composer un fil, qui auraient divergé au premier correctif.
 *
 * Ce module ne décide RIEN de l'autorisation : l'insertion du message (sous
 * les droits de l'appelant, ou par service_role) reste la responsabilité de
 * qui l'appelle.
 * ─────────────────────────────────────────────────────────────────────────────
 */

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

export interface EmailAttachmentInput {
  filename: string;
  /** Base64. */
  content: string;
  contentType: string;
}

export interface OutboundStore {
  conversationContext(conversationId: string): Promise<ConversationContext | null>;
  markSent(
    messageId: string,
    input: {
      providerId: string;
      internetMessageId: string;
      recipientEmail: string;
      inReplyTo: string | null;
      references: string | null;
    },
  ): Promise<void>;
  markFailed(messageId: string, error: string): Promise<void>;
}

export interface OutboundConfig {
  store: OutboundStore;
  send: (message: Message) => Promise<SendResult>;
  replySecret: string;
  inboundDomain: string;
  portalUrl: string;
}

export type OutboundResult =
  | { status: 'sent'; providerId: string | null }
  /** `context` : conversation ou contact introuvable (état incohérent) ; `provider` : l'envoi a échoué. */
  | { status: 'failed'; cause: 'context' | 'provider'; error: string };

/** Le courriel envoyé au client : son message, un lien vers le portail, la consigne de réponse. */
export function renderOutboundEmail(input: {
  organizationName: string;
  contactName: string;
  body: string;
  portalUrl: string;
}): { html: string; text: string } {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
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

/**
 * Compose et envoie le courriel d'un message déjà inséré, puis consigne le
 * résultat. Ne lève jamais : un échec d'envoi est un `failed` avec son motif,
 * enregistré sur le message — rien n'est perdu ni masqué.
 */
export async function deliverOutboundMessage(
  config: OutboundConfig,
  message: { id: string; conversation_id: string },
  body: string,
  attachments: EmailAttachmentInput[] = [],
): Promise<OutboundResult> {
  const context = await config.store.conversationContext(message.conversation_id);
  if (context === null) {
    const error = 'Conversation ou contact introuvable.';
    await config.store.markFailed(message.id, error);
    return { status: 'failed', cause: 'context', error };
  }

  const internetMessageId = buildMessageId(message.id, config.inboundDomain);
  const replyTo = await buildReplyAddress(message.conversation_id, config.replySecret, config.inboundDomain);
  const references = [
    ...context.references,
    ...(context.lastInternetMessageId ? [context.lastInternetMessageId] : []),
  ]
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
  const emailSubject =
    context.references.length > 0 || context.lastInternetMessageId
      ? /^re\s*:/i.test(context.subject)
        ? context.subject
        : `Re: ${context.subject}`
      : context.subject;

  try {
    const result = await config.send({
      to: context.contactEmail,
      subject: emailSubject,
      html: rendered.html,
      text: rendered.text,
      replyTo,
      headers,
      attachments,
    });
    await config.store.markSent(message.id, {
      providerId: result.providerId ?? '',
      internetMessageId,
      recipientEmail: context.contactEmail,
      inReplyTo: headers['In-Reply-To'] ?? null,
      references: headers['References'] ?? null,
    });
    return { status: 'sent', providerId: result.providerId ?? null };
  } catch (error) {
    // AC30 — le message reste, en échec, avec le motif : rien n'est perdu ni masqué.
    const reason = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await config.store.markFailed(message.id, reason);
    return { status: 'failed', cause: 'provider', error: reason };
  }
}

/**
 * L'implémentation réelle du suivi, sur le client `service_role`. Partagée
 * entre `portal-message-send` (appel humain) et `quote-reminder-worker`.
 */
export function createOutboundStore(admin: SupabaseClient): OutboundStore {
  return {
    async conversationContext(conversationId): Promise<ConversationContext | null> {
      const { data: conv } = await admin
        .from('client_conversations')
        .select('subject, organization_id, customer_contacts!inner(email, first_name, last_name), organizations!inner(name)')
        .eq('id', conversationId)
        .maybeSingle();
      if (conv === null) return null;
      type Contact = { email: string | null; first_name: string | null; last_name: string | null };
      type Org = { name: string };
      const one = <T,>(v: unknown): T | undefined => (Array.isArray(v) ? (v[0] as T) : (v as T));
      const contact = one<Contact>(conv.customer_contacts);
      const org = one<Org>(conv.organizations);
      if (!contact?.email || !org) return null;

      const { data: settings } = await admin
        .from('client_portal_settings')
        .select('display_name')
        .eq('organization_id', conv.organization_id)
        .maybeSingle();

      const { data: previous } = await admin
        .from('client_messages')
        .select('internet_message_id, direction')
        .eq('conversation_id', conversationId)
        .not('internet_message_id', 'is', null)
        .order('created_at', { ascending: true });
      const ids = (previous ?? []).map((m) => m.internet_message_id as string);

      return {
        subject: conv.subject,
        contactEmail: contact.email,
        contactName: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email,
        organizationName: (settings?.display_name as string | null)?.trim() || org.name,
        lastInternetMessageId: ids.at(-1) ?? null,
        references: ids.slice(0, -1),
      };
    },

    async markSent(messageId, input) {
      await admin
        .from('client_messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          resend_email_id: input.providerId || null,
          internet_message_id: input.internetMessageId,
          recipient_email: input.recipientEmail,
          in_reply_to: input.inReplyTo,
          references_header: input.references,
          error: null,
        })
        .eq('id', messageId);
    },

    async markFailed(messageId, error) {
      await admin.from('client_messages').update({ status: 'failed', error }).eq('id', messageId);
    },
  };
}
