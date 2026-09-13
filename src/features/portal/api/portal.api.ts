import { AppError } from '@/lib/errors';
import { messageDeLaFonction, supabase, unwrap } from '@/services/supabase';
import type {
  PortalContext,
  PortalDocument,
  PortalInvoice,
  PortalMission,
  PortalMissionDetail,
  PortalQuote,
  PortalQuoteDetail,
  Tables,
} from '@/types/database';

/**
 * Portail client, côté client.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Le contact du portail n'est membre d'aucune organisation : toutes les
 * policies de l'espace entreprise lui renvoient zéro ligne. Ce qu'il voit
 * passe par des fonctions `portal_*` qui ne renvoient que des colonnes
 * choisies, et qui se taisent hors session portail. Le frontend ne filtre
 * rien : il affiche ce que la base a déjà décidé de montrer.
 *
 * Les fichiers ne sont jamais lus par une policy Storage — le contact n'en a
 * aucune. `portal-file-url` demande à la base (`portal_can_read_file`) puis
 * signe une URL de cinq minutes pour ce seul fichier.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type PortalConversation = Tables<'client_conversations'>;
export type PortalMessage = Tables<'client_messages'> & { attachments: Tables<'client_message_attachments'>[] };

// -----------------------------------------------------------------------------
// Connexion
// -----------------------------------------------------------------------------

/** Demande un code. La réponse est neutre : elle ne dit pas si l'adresse a accès. */
export async function requestAccessCode(email: string): Promise<void> {
  const response = await supabase.functions.invoke<{ ok: boolean }>('portal-request-access', {
    body: { email },
  });
  if (response.error) {
    throw new AppError('unknown', await messageDeLaFonction(response.error, 'Le code n’a pas pu être envoyé.'));
  }
}

export async function verifyAccessCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) {
    throw new AppError('validation', 'Code invalide ou expiré. Demandez-en un nouveau.', { cause: error });
  }
}

// -----------------------------------------------------------------------------
// Lectures
// -----------------------------------------------------------------------------

export async function getPortalContext(): Promise<PortalContext | null> {
  const rows = await unwrap(supabase.rpc('portal_my_context'));
  return rows[0] ?? null;
}

export async function touchLastSeen(): Promise<void> {
  await supabase.rpc('portal_touch_last_seen');
}

export async function listPortalMissions(): Promise<PortalMission[]> {
  return unwrap(supabase.rpc('portal_list_missions'));
}

export async function getPortalMission(missionId: string): Promise<PortalMissionDetail | null> {
  const data = await unwrap(supabase.rpc('portal_mission_detail', { p_mission_id: missionId }));
  return data === null ? null : (data as unknown as PortalMissionDetail);
}

export async function listPortalQuotes(): Promise<PortalQuote[]> {
  return unwrap(supabase.rpc('portal_list_quotes'));
}

export async function getPortalQuote(quoteId: string): Promise<PortalQuoteDetail | null> {
  const data = await unwrap(supabase.rpc('portal_quote_detail', { p_quote_id: quoteId }));
  return data === null ? null : (data as unknown as PortalQuoteDetail);
}

/** Accepte ou refuse un devis « envoyé » — la base vérifie tout et journalise. */
export async function respondPortalQuote(quoteId: string, decision: 'accepted' | 'refused'): Promise<PortalQuoteDetail> {
  const data = await unwrap(supabase.rpc('portal_respond_quote', { p_quote_id: quoteId, p_decision: decision }));
  return data as unknown as PortalQuoteDetail;
}

export async function listPortalInvoices(): Promise<PortalInvoice[]> {
  return unwrap(supabase.rpc('portal_list_invoices'));
}

export async function listPortalDocuments(): Promise<PortalDocument[]> {
  return unwrap(supabase.rpc('portal_list_documents'));
}

export type PortalBucket =
  | 'intervention-attachments'
  | 'organization-documents'
  | 'invoice-electronic-documents'
  | 'client-message-attachments';

export async function getPortalFileUrl(bucket: PortalBucket, path: string): Promise<string> {
  const response = await supabase.functions.invoke<{ url: string }>('portal-file-url', { body: { bucket, path } });
  if (response.error) {
    throw new AppError('not_found', await messageDeLaFonction(response.error, 'Fichier introuvable.'));
  }
  if (!response.data?.url) throw new AppError('not_found', 'Fichier introuvable.');
  return response.data.url;
}

// -----------------------------------------------------------------------------
// Messagerie
// -----------------------------------------------------------------------------

export async function listPortalConversations(): Promise<Array<PortalConversation & { unread_count: number }>> {
  const rows = await unwrap(
    supabase
      .from('client_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false }),
  );
  const unread = await unwrap(
    supabase
      .from('client_messages')
      .select('conversation_id')
      .eq('direction', 'outbound')
      .is('read_by_client_at', null),
  );
  const counts = new Map<string, number>();
  for (const m of unread) counts.set(m.conversation_id, (counts.get(m.conversation_id) ?? 0) + 1);
  return rows.map((row) => ({ ...row, unread_count: counts.get(row.id) ?? 0 }));
}

export async function listPortalMessages(conversationId: string): Promise<PortalMessage[]> {
  const rows = await unwrap(
    supabase
      .from('client_messages')
      .select('*, attachments:client_message_attachments(*)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  );
  return rows.map((row) => ({
    ...(row as Tables<'client_messages'>),
    attachments: (row as { attachments?: Tables<'client_message_attachments'>[] }).attachments ?? [],
  }));
}

export async function countUnreadForClient(): Promise<number> {
  const { count, error } = await supabase
    .from('client_messages')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .is('read_by_client_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markConversationReadByClient(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('client_messages')
    .update({ read_by_client_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('direction', 'outbound')
    .is('read_by_client_at', null);
  if (error) throw error;
}

export interface PortalSendInput {
  conversationId?: string;
  subject?: string;
  body: string;
  missionId?: string;
  quoteId?: string;
  invoiceId?: string;
}

export async function sendPortalMessage(input: PortalSendInput): Promise<{ conversationId: string; messageId: string }> {
  const response = await supabase.functions.invoke<{ conversationId: string; messageId: string }>(
    'portal-message-send',
    { body: input },
  );
  if (response.error) {
    throw new AppError('unknown', await messageDeLaFonction(response.error, 'Le message n’a pas pu être envoyé.'));
  }
  if (!response.data) throw new AppError('unknown', 'Le message n’a pas pu être envoyé.');
  return response.data;
}
