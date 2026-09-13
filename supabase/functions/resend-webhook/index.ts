import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  createResendWebhookHandler,
  type ConversationRef,
  type ReceivedEmail,
  type ResendReceiving,
  type WebhookStore,
} from './handler.ts';

/**
 * Point d'entrée : câble le gestionnaire pur sur Supabase et sur l'API Resend.
 *
 * `verify_jwt = false` dans `config.toml` : Resend n'a pas de jeton Supabase.
 * C'est la signature Svix, vérifiée dans `handler.ts`, qui authentifie.
 *
 * Le client `service_role` est nécessaire ici — le webhook n'agit pour aucun
 * utilisateur — et les triggers `enforce_client_message` le reconnaissent par
 * la claim `role`. Il ne quitte jamais cette fonction.
 */

function env(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === '') throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

const BUCKET = 'client-message-attachments';

function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'piece-jointe';
  return base.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'piece-jointe';
}

const store: WebhookStore = {
  async recordEvent({ id, type, emailId, payload }) {
    // Insertion « si absent » : la clé primaire est le `svix-id`. Un rejeu
    // d'un événement déjà traité ne passe pas ; un rejeu d'un événement en
    // échec est repris (la ligne est remise à `received`).
    const { data: existing } = await admin
      .from('resend_events')
      .select('outcome')
      .eq('id', id)
      .maybeSingle();
    if (existing !== null && existing.outcome !== 'failed') return 'duplicate';

    const row = { id, event_type: type, email_id: emailId, outcome: 'received', detail: null, payload, processed_at: null };
    const { error } = existing === null
      ? await admin.from('resend_events').insert(row)
      : await admin.from('resend_events').update(row).eq('id', id);
    if (error !== null) {
      // Deux livraisons simultanées : la seconde perd la course sur la clé.
      if (error.code === '23505') return 'duplicate';
      throw new Error(`resend_events : ${error.message}`);
    }
    return 'new';
  },

  async finishEvent(id, outcome, detail) {
    await admin
      .from('resend_events')
      .update({ outcome, detail: detail ?? null, processed_at: new Date().toISOString() })
      .eq('id', id);
  },

  async findConversationById(id) {
    const { data } = await admin
      .from('client_conversations')
      .select('id, organization_id, status, customer_contacts!inner(email)')
      .eq('id', id)
      .maybeSingle();
    return toRef(data);
  },

  async findConversationByMessageId(messageId) {
    const { data: message } = await admin
      .from('client_messages')
      .select('conversation_id')
      .eq('id', messageId)
      .eq('direction', 'outbound')
      .maybeSingle();
    if (message === null) return null;
    return store.findConversationById(message.conversation_id as string);
  },

  async insertInboundMessage(input) {
    const { data, error } = await admin
      .from('client_messages')
      .insert({
        organization_id: input.organizationId,
        conversation_id: input.conversationId,
        direction: 'inbound',
        channel: 'email',
        sender_email: input.senderEmail,
        recipient_email: input.recipientEmail,
        subject: input.subject,
        body_text: input.bodyText,
        body_html: input.bodyHtml,
        resend_email_id: input.resendEmailId,
        internet_message_id: input.internetMessageId,
        in_reply_to: input.inReplyTo,
        references_header: input.referencesHeader,
        status: 'received',
        received_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error !== null) throw new Error(`client_messages : ${error.message}`);
    return { id: data.id as string };
  },

  async storeAttachment(input) {
    const path = `${input.organizationId}/${input.conversationId}/${input.messageId}/${crypto.randomUUID()}-${safeFileName(input.filename)}`;
    const upload = await admin.storage.from(BUCKET).upload(path, input.bytes, {
      contentType: input.contentType,
      upsert: false,
    });
    if (upload.error !== null) throw new Error(`storage : ${upload.error.message}`);
    const { error } = await admin.from('client_message_attachments').insert({
      organization_id: input.organizationId,
      message_id: input.messageId,
      file_name: input.filename.slice(0, 255),
      storage_path: path,
      mime_type: input.contentType,
      file_size: input.bytes.byteLength,
    });
    if (error !== null) {
      await admin.storage.from(BUCKET).remove([path]);
      throw new Error(`client_message_attachments : ${error.message}`);
    }
  },

  async updateDeliveryStatus(resendEmailId, status, at) {
    const patch = status === 'delivered'
      ? { status, delivered_at: at }
      : { status, error: status === 'bounced' ? 'Adresse refusée par le serveur destinataire.' : 'Signalé comme indésirable.' };
    const { data } = await admin
      .from('client_messages')
      .update(patch)
      .eq('resend_email_id', resendEmailId)
      .eq('direction', 'outbound')
      .select('id');
    return (data?.length ?? 0) > 0;
  },
};

function toRef(row: unknown): ConversationRef | null {
  if (row === null || typeof row !== 'object') return null;
  const r = row as { id: string; organization_id: string; status: 'open' | 'closed'; customer_contacts: { email: string | null } | { email: string | null }[] };
  const contact = Array.isArray(r.customer_contacts) ? r.customer_contacts[0] : r.customer_contacts;
  if (!contact?.email) return null;
  return { id: r.id, organization_id: r.organization_id, status: r.status, contact_email: contact.email };
}

// ------------------------------------------------------------ API Resend

const RESEND_API = 'https://api.resend.com';

function resendHeaders(): HeadersInit {
  return { Authorization: `Bearer ${env('RESEND_API_KEY')}` };
}

/** Les en-têtes arrivent en objet ou en liste `{ name, value }` : on aplatit. */
function flattenHeaders(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string') {
        const { name, value } = item as { name: string; value?: unknown };
        if (typeof value === 'string') out[name] = value;
      }
    }
  } else if (raw && typeof raw === 'object') {
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'string') out[name] = value;
    }
  }
  return out;
}

const resend: ResendReceiving = {
  async getReceived(emailId): Promise<ReceivedEmail | null> {
    const res = await fetch(`${RESEND_API}/emails/receiving/${encodeURIComponent(emailId)}`, { headers: resendHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Resend ${res.status} à la lecture du courriel.`);
    const body = await res.json() as {
      from?: unknown; to?: unknown; subject?: unknown; text?: unknown; html?: unknown;
      headers?: unknown; message_id?: unknown; in_reply_to?: unknown; references?: unknown;
      attachments?: unknown;
    };
    const headers = flattenHeaders(body.headers);
    // Certains identifiants sont aussi exposés à plat : on les prend si l'en-tête manque.
    if (typeof body.message_id === 'string' && !('Message-ID' in headers)) headers['Message-ID'] = body.message_id;
    if (typeof body.in_reply_to === 'string' && !('In-Reply-To' in headers)) headers['In-Reply-To'] = body.in_reply_to;
    if (typeof body.references === 'string' && !('References' in headers)) headers['References'] = body.references;

    const attachments = Array.isArray(body.attachments)
      ? body.attachments.flatMap((a: unknown) => {
        if (!a || typeof a !== 'object') return [];
        const { id, filename, content_type, size } = a as Record<string, unknown>;
        if (typeof id !== 'string') return [];
        return [{
          id,
          filename: typeof filename === 'string' ? filename : 'piece-jointe',
          content_type: typeof content_type === 'string' ? content_type : 'application/octet-stream',
          size: typeof size === 'number' ? size : 0,
        }];
      })
      : [];

    return {
      from: typeof body.from === 'string' ? body.from : '',
      to: Array.isArray(body.to) ? body.to.filter((t): t is string => typeof t === 'string') : [],
      subject: typeof body.subject === 'string' ? body.subject : null,
      text: typeof body.text === 'string' ? body.text : null,
      html: typeof body.html === 'string' ? body.html : null,
      headers,
      attachments,
    };
  },

  async getAttachment(emailId, attachmentId): Promise<Uint8Array | null> {
    const meta = await fetch(
      `${RESEND_API}/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { headers: resendHeaders() },
    );
    if (!meta.ok) return null;
    const body = await meta.json() as { download_url?: unknown; content?: unknown };
    if (typeof body.download_url === 'string') {
      const file = await fetch(body.download_url);
      if (!file.ok) return null;
      return new Uint8Array(await file.arrayBuffer());
    }
    if (typeof body.content === 'string') {
      return Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0));
    }
    return null;
  },
};

Deno.serve(
  createResendWebhookHandler({
    webhookSecret: env('RESEND_WEBHOOK_SECRET'),
    replySecret: env('PORTAL_REPLY_SECRET'),
    inboundDomain: env('PORTAL_INBOUND_DOMAIN'),
    store,
    resend,
  }),
);
