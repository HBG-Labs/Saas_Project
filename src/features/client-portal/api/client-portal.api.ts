import { AppError } from '@/lib/errors';
import { messageDeLaFonction, supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { Tables, TablesUpdate } from '@/types/database';

/**
 * Portail client, côté entreprise.
 *
 * Seul endroit de la feature autorisé à parler à Supabase. Ce qui est décidé
 * ici ne l'est jamais vraiment : chaque écriture est rejugée par la base.
 *
 *   • `client_portal_settings` : `client_portal.manage` (policies) ;
 *   • `customer_contacts.portal_enabled` : trigger `guard_contact_portal_update`,
 *     qui exige `client_portal.manage` et journalise ;
 *   • partage d'une photo ou d'un document : trigger `guard_*_share_update`,
 *     qui n'autorise QUE les colonnes de partage et exige `client_content.share` ;
 *   • messages : l'insertion passe par la fonction Edge `portal-message-send`,
 *     qui insère sous les droits de l'appelant puis envoie par Resend — la clé
 *     ne quitte jamais le serveur.
 */

export type ClientPortalSettings = Tables<'client_portal_settings'>;
export type ClientConversation = Tables<'client_conversations'>;
export type ClientMessage = Tables<'client_messages'>;
export type ClientMessageAttachment = Tables<'client_message_attachments'>;

export interface ClientConversationWithContact extends ClientConversation {
  contact: Pick<Tables<'customer_contacts'>, 'id' | 'first_name' | 'last_name' | 'email'> | null;
  customer: Pick<Tables<'customers'>, 'id' | 'name'> | null;
  /** Messages du client non encore lus par l'entreprise. */
  unread_count: number;
}

// -----------------------------------------------------------------------------
// Réglages
// -----------------------------------------------------------------------------

export async function getPortalSettings(organizationId: string): Promise<ClientPortalSettings | null> {
  return unwrapMaybe(
    supabase.from('client_portal_settings').select('*').eq('organization_id', organizationId).maybeSingle(),
  );
}

export async function upsertPortalSettings(
  organizationId: string,
  patch: TablesUpdate<'client_portal_settings'>,
): Promise<ClientPortalSettings> {
  return unwrap(
    supabase
      .from('client_portal_settings')
      .upsert({ organization_id: organizationId, ...patch }, { onConflict: 'organization_id' })
      .select('*')
      .single(),
  );
}

// -----------------------------------------------------------------------------
// Accès d'un contact
// -----------------------------------------------------------------------------

export async function setContactPortalAccess(contactId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('customer_contacts')
    .update({ portal_enabled: enabled })
    .eq('id', contactId);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Partage de contenu
// -----------------------------------------------------------------------------

/** Partage (ou retire) plusieurs photos d'un coup — une seule requête, un seul refus possible. */
export async function setAttachmentsShared(attachmentIds: string[], shared: boolean): Promise<void> {
  if (attachmentIds.length === 0) return;
  const { error } = await supabase
    .from('intervention_attachments')
    .update({ shared_with_client: shared })
    .in('id', attachmentIds);
  if (error) throw error;
}

export type DocumentShare = Tables<'organization_document_shares'>;

/** Tous les partages ciblés de l'organisation — une requête, pas une par document. */
export async function listDocumentShares(organizationId: string): Promise<DocumentShare[]> {
  return unwrap(
    supabase.from('organization_document_shares').select('*').eq('organization_id', organizationId),
  );
}

/**
 * Aligne les partages ciblés d'un document sur une liste de clients. Le trigger
 * réécrit `organization_id` ; la valeur envoyée n'est qu'un remplissage.
 */
export async function setDocumentCustomerShares(input: {
  documentId: string;
  organizationId: string;
  add: string[];
  remove: string[];
}): Promise<void> {
  if (input.remove.length > 0) {
    const { error } = await supabase
      .from('organization_document_shares')
      .delete()
      .eq('document_id', input.documentId)
      .in('customer_id', input.remove);
    if (error) throw error;
  }
  if (input.add.length > 0) {
    const { error } = await supabase.from('organization_document_shares').insert(
      input.add.map((customerId) => ({
        document_id: input.documentId,
        customer_id: customerId,
        organization_id: input.organizationId,
      })),
    );
    if (error) throw error;
  }
}

export async function setDocumentShared(documentId: string, shared: boolean): Promise<void> {
  const { error } = await supabase
    .from('organization_documents')
    .update({ shared_with_client: shared })
    .eq('id', documentId);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Conversations et messages
// -----------------------------------------------------------------------------

export async function listConversations(
  organizationId: string,
  customerId?: string,
): Promise<ClientConversationWithContact[]> {
  let query = supabase
    .from('client_conversations')
    .select(
      '*, contact:customer_contacts(id, first_name, last_name, email), customer:customers(id, name), client_messages(id)',
    )
    .eq('organization_id', organizationId)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (customerId !== undefined) query = query.eq('customer_id', customerId);

  const rows = await unwrap(query);

  // Le compte de non-lus vient d'une seconde requête ciblée : la relation
  // embarquée ne filtre pas, et rapatrier tous les messages pour les compter
  // serait disproportionné.
  const unread = await unwrap(
    supabase
      .from('client_messages')
      .select('conversation_id')
      .eq('organization_id', organizationId)
      .eq('direction', 'inbound')
      .is('read_by_staff_at', null),
  );
  const unreadByConversation = new Map<string, number>();
  for (const m of unread) {
    unreadByConversation.set(m.conversation_id, (unreadByConversation.get(m.conversation_id) ?? 0) + 1);
  }

  return rows.map((row) => {
    const { client_messages: _ignored, ...rest } = row as typeof row & { client_messages: unknown };
    return {
      ...(rest as ClientConversation),
      contact: (row as { contact: ClientConversationWithContact['contact'] }).contact ?? null,
      customer: (row as { customer: ClientConversationWithContact['customer'] }).customer ?? null,
      unread_count: unreadByConversation.get(row.id) ?? 0,
    };
  });
}

export async function listMessages(
  conversationId: string,
): Promise<Array<ClientMessage & { attachments: ClientMessageAttachment[] }>> {
  const rows = await unwrap(
    supabase
      .from('client_messages')
      .select('*, attachments:client_message_attachments(*)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  );
  return rows.map((row) => ({
    ...(row as ClientMessage),
    attachments: ((row as { attachments?: ClientMessageAttachment[] }).attachments ?? []),
  }));
}

/** Nombre de messages clients non lus par l'entreprise — pour le badge. */
export async function countUnreadForStaff(organizationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('client_messages')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('direction', 'inbound')
    .is('read_by_staff_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** Marque lus tous les messages entrants d'une conversation. */
export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('client_messages')
    .update({ read_by_staff_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .is('read_by_staff_at', null);
  if (error) throw error;
}

export async function closeConversation(conversationId: string, closed: boolean): Promise<void> {
  const { error } = await supabase
    .from('client_conversations')
    .update({ status: closed ? 'closed' : 'open' })
    .eq('id', conversationId);
  if (error) throw error;
}

export interface SendMessageInput {
  conversationId?: string;
  contactId?: string;
  subject?: string;
  body: string;
  missionId?: string;
  quoteId?: string;
  invoiceId?: string;
  /** Joint le PDF de cette facture au courriel — vérifié côté serveur. */
  attachInvoiceId?: string;
}

export interface SendMessageResult {
  messageId: string;
  conversationId: string;
  status: 'sent' | 'received' | 'failed';
  providerId?: string | null;
  error?: string;
}

/**
 * Envoie un message par la fonction Edge. Un échec d'envoi Resend n'est PAS
 * une exception : le message existe, en `failed`, et la réponse le dit.
 */
export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const response = await supabase.functions.invoke<SendMessageResult>('portal-message-send', { body: input });

  if (response.error) {
    const contexte: unknown = (response.error as { context?: unknown }).context;
    if (contexte instanceof Response && (contexte.status === 502 || contexte.status === 409)) {
      try {
        const corps = (await contexte.clone().json()) as SendMessageResult;
        if (corps.status === 'failed' && typeof corps.messageId === 'string') return corps;
      } catch {
        // Corps illisible : traité comme une erreur ordinaire ci-dessous.
      }
    }
    throw new AppError('unknown', await messageDeLaFonction(response.error, 'Le message n’a pas pu être envoyé.'));
  }
  if (!response.data) throw new AppError('unknown', 'La fonction d’envoi n’a renvoyé aucune donnée.');
  return response.data;
}

/** URL signée d'une pièce jointe de message — la policy Storage juge. */
export async function getMessageAttachmentUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('client-message-attachments')
    .createSignedUrl(storagePath, 300);
  if (error) return null;
  return data.signedUrl;
}
