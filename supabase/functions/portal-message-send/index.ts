import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import { readTransport, sendMessage } from '../_shared/email.ts';
import {
  createPortalMessageSendHandler,
  type AdminStore,
  type CallerStore,
  type ConversationContext,
  type InsertedMessage,
} from './handler.ts';

/**
 * Point d'entrée : deux clients Supabase, deux rôles.
 *
 *   - `callerClient` porte le jeton de l'appelant : c'est lui qui insère, et la
 *     RLS décide.
 *   - `admin` (service_role) ne fait que relire le contexte d'une conversation
 *     déjà autorisée et consigner le résultat de l'envoi. Il ne sort pas d'ici.
 *
 * Le transport EXIGE Resend : un envoi SMTP n'aurait ni identifiant fournisseur
 * ni retour de statut, et la réponse du client ne reviendrait nulle part.
 */

function env(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === '') throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

function callerClient(authorization: string): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
}

function makeCallerStore(caller: SupabaseClient): CallerStore {
  return {
    async createConversation(input) {
      let parties: { organization_id: string; customer_id: string; contact_id: string; initiated_by: 'organization' | 'client' };

      if (input.contactId !== null) {
        // L'entreprise ouvre vers un contact : sa lecture du contact, sous RLS,
        // prouve qu'il est dans son organisation.
        const { data } = await caller
          .from('customer_contacts')
          .select('id, organization_id, customer_id, portal_enabled')
          .eq('id', input.contactId)
          .maybeSingle();
        if (data === null) return { error: 'Contact introuvable.' };
        if (data.portal_enabled !== true) return { error: 'Ce contact n’a pas accès au portail client.' };
        parties = { organization_id: data.organization_id, customer_id: data.customer_id, contact_id: data.id, initiated_by: 'organization' };
      } else {
        // Le client ouvre depuis le portail : son identité vient du jeton.
        const { data } = await caller.rpc('portal_my_context');
        const me = Array.isArray(data) ? data[0] : null;
        if (!me) return { error: 'Accès au portail introuvable.' };
        parties = { organization_id: me.organization_id, customer_id: me.customer_id, contact_id: me.contact_id, initiated_by: 'client' };
      }

      const { data, error } = await caller
        .from('client_conversations')
        .insert({
          ...parties,
          subject: input.subject,
          mission_id: input.missionId,
          quote_id: input.quoteId,
          invoice_id: input.invoiceId,
        })
        .select('id')
        .single();
      if (error !== null) return { error: error.message };
      return { id: data.id as string };
    },

    async insertMessage(input) {
      // Lire la conversation sous RLS : invisible = introuvable, sans distinguer.
      const { data: conv } = await caller
        .from('client_conversations')
        .select('organization_id')
        .eq('id', input.conversationId)
        .maybeSingle();
      if (conv === null) return { error: 'Conversation introuvable.' };

      const { data, error } = await caller
        .from('client_messages')
        .insert({
          conversation_id: input.conversationId,
          organization_id: conv.organization_id,
          // La direction est réécrite par le trigger depuis l'identité de
          // l'appelant ; la valeur posée ici ne remplit qu'une colonne non nulle.
          direction: 'outbound',
          body_text: input.body,
          subject: input.subject,
        })
        .select('id, conversation_id, organization_id, direction')
        .single();
      if (error !== null) return { error: error.message };
      return data as InsertedMessage;
    },
  };
}

const adminStore: AdminStore = {
  async conversationContext(conversationId): Promise<ConversationContext | null> {
    const { data: conv } = await admin
      .from('client_conversations')
      .select('subject, organization_id, customer_contacts!inner(email, first_name, last_name), organizations!inner(name)')
      .eq('id', conversationId)
      .maybeSingle();
    if (conv === null) return null;
    type Contact = { email: string | null; first_name: string | null; last_name: string | null };
    type Org = { name: string };
    const one = <T,>(v: unknown): T | undefined => (Array.isArray(v) ? v[0] as T : v as T);
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return new Response(JSON.stringify({ error: 'Authentification requise.' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const state = readTransport('PORTAL_FROM_EMAIL', { require: 'resend' });
  const missing = [...state.missing];
  for (const name of ['PORTAL_REPLY_SECRET', 'PORTAL_INBOUND_DOMAIN', 'APP_URL']) {
    if (!Deno.env.get(name)) missing.push(name);
  }

  const handler = createPortalMessageSendHandler({
    caller: makeCallerStore(callerClient(authorization)),
    admin: adminStore,
    send: (message) => sendMessage(message, state),
    replySecret: Deno.env.get('PORTAL_REPLY_SECRET') ?? '',
    inboundDomain: Deno.env.get('PORTAL_INBOUND_DOMAIN') ?? '',
    portalUrl: `${(Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')}/portail`,
    missing,
  });
  return handler(request);
});
