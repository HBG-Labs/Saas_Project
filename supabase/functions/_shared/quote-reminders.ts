import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

/**
 * Relances automatiques des devis — la partie qui se teste sans base ni réseau.
 *
 * La base PLANIFIE (trigger `app.plan_quote_reminders`) ; le worker EXPÉDIE ce
 * qui est dû. Entre les deux, une semaine a passé : ce fichier revérifie donc
 * l'état du devis au moment de l'envoi, et sait dire pourquoi il ne relance
 * pas — ce motif est montré à l'entreprise sur la fiche du devis.
 */

export interface ClaimedReminder {
  id: string;
  organization_id: string;
  quote_id: string;
  sequence: number;
  attempts: number;
  /** Message déjà écrit par un essai précédent, à renvoyer plutôt qu'à dupliquer. */
  message_id: string | null;
}

/** Ce que le worker relit juste avant d'envoyer. */
export interface ReminderContext {
  quote: {
    id: string;
    reference: string;
    title: string | null;
    status: string;
    valid_until: string | null;
    sent_at: string | null;
    reminders_enabled: boolean;
    customer_id: string | null;
  };
  /** Total TTC en centimes, ou `null` si les lignes sont illisibles. */
  totalCents: number | null;
  /** La conversation du portail rattachée à ce devis (la plus récente), ou `null`. */
  conversation: { id: string; status: string } | null;
  /** Le client a écrit dans ce fil depuis l'envoi du devis. */
  clientRepliedSinceSent: boolean;
  /** Le portail de l'entreprise est activé (sans lui, plus d'adresse de réponse valide). */
  portalEnabled: boolean;
  /** Nombre total de relances prévues pour ce devis (pour dire « dernière relance »). */
  plannedCount: number;
}

export type ReminderDecision = { action: 'send' } | { action: 'skip'; reason: string };

/**
 * Faut-il encore relancer ? Chaque refus porte un motif lisible.
 *
 * Le trigger a déjà retiré les relances d'un devis accepté, refusé ou expiré ;
 * on revérifie quand même — la file peut avoir été tirée juste avant un
 * changement de statut, et une relance de trop coûte plus qu'une relance
 * manquée.
 */
export function decideReminder(ctx: ReminderContext, now: Date): ReminderDecision {
  const q = ctx.quote;
  if (q.status !== 'sent') return { action: 'skip', reason: `Devis ${statusLabel(q.status)}` };
  if (!q.reminders_enabled) return { action: 'skip', reason: 'Relances désactivées sur ce devis' };
  if (q.valid_until !== null && new Date(`${q.valid_until}T00:00:00Z`).getTime() <= startOfUtcDay(now)) {
    return { action: 'skip', reason: 'Date de validité atteinte' };
  }
  if (q.customer_id === null) return { action: 'skip', reason: 'Devis non rattaché à un client' };
  if (ctx.conversation === null) {
    return { action: 'skip', reason: 'Devis non envoyé depuis REZO360 (aucune conversation)' };
  }
  if (ctx.conversation.status !== 'open') return { action: 'skip', reason: 'Conversation close' };
  if (!ctx.portalEnabled) return { action: 'skip', reason: 'Espace client désactivé' };
  if (ctx.clientRepliedSinceSent) return { action: 'skip', reason: 'Le client a déjà répondu dans le fil' };
  return { action: 'send' };
}

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function statusLabel(status: string): string {
  return (
    { accepted: 'accepté', refused: 'refusé', expired: 'expiré', draft: 'repassé en brouillon' }[status] ??
    status
  );
}

/** Montant en euros, à la française : `1 234,50 €`. Sans dépendre d'ICU. */
export function formatEuros(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const centimes = String(abs % 100).padStart(2, '0');
  return `${sign}${euros},${centimes} €`;
}

export interface ReminderBodyInput {
  sequence: number;
  plannedCount: number;
  reference: string;
  title: string | null;
  /** Déjà formatée par l'appelant (`dateLisible` lit l'environnement). */
  validUntilLabel: string | null;
  totalCents: number | null;
}

/**
 * Le texte de la relance, tel qu'il apparaît dans le fil et dans le courriel
 * (le gabarit ajoute « Bonjour … », le lien vers l'espace client et la
 * signature). Sobre : c'est l'entreprise qui parle à son client.
 */
export function buildReminderBody(input: ReminderBodyInput): string {
  const designation = input.title ? `${input.reference} — ${input.title}` : input.reference;
  const montant = input.totalCents === null ? '' : ` d'un montant de ${formatEuros(input.totalCents)} TTC`;
  const isLast = input.sequence >= input.plannedCount;

  const lines = [
    input.sequence === 1
      ? `Nous nous permettons de revenir vers vous au sujet de notre devis ${designation}${montant}, que nous vous avons transmis récemment.`
      : `Sauf erreur de notre part, nous restons sans réponse concernant notre devis ${designation}${montant}.`,
    '',
    input.validUntilLabel
      ? isLast
        ? `Il reste valable jusqu'au ${input.validUntilLabel} ; passé cette date, il faudra le mettre à jour.`
        : `Il reste valable jusqu'au ${input.validUntilLabel}.`
      : 'Il reste valable.',
    '',
    'Vous pouvez l’accepter ou le refuser en un clic depuis votre espace client, ou simplement nous répondre si vous avez une question ou souhaitez un ajustement.',
    '',
    'Nous restons à votre disposition.',
  ];
  return lines.join('\n');
}

/** Délai avant nouvel essai après un échec d'envoi — même courbe que les autres workers. */
export function nextReminderAttempt(attempts: number, now = new Date()): Date {
  const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(Math.max(attempts, 0), 7));
  return new Date(now.getTime() + delaySeconds * 1000);
}

/** Au-delà, on cesse d'essayer : le motif reste sur la relance, l'entreprise le voit. */
export const MAX_REMINDER_ATTEMPTS = 5;

// ---------------------------------------------------------------- accès base

export interface ReminderStore {
  context(quoteId: string): Promise<ReminderContext | null>;
  /** Insère le message sortant sous `service_role` ; le trigger accepte tel quel. */
  insertOutboundMessage(input: {
    conversationId: string;
    organizationId: string;
    body: string;
  }): Promise<{ id: string; conversation_id: string } | { error: string }>;
  markReminder(id: string, patch: Record<string, unknown>): Promise<void>;
}

export function createReminderStore(admin: SupabaseClient): ReminderStore {
  return {
    async context(quoteId) {
      const { data: quote } = await admin
        .from('quotes')
        .select('id, reference, title, status, valid_until, sent_at, reminders_enabled, customer_id, organization_id')
        .eq('id', quoteId)
        .maybeSingle();
      if (quote === null) return null;

      const { data: items } = await admin
        .from('quote_items')
        .select('quantity, unit_price_cents')
        .eq('quote_id', quoteId);
      const { data: header } = await admin.from('quotes').select('vat_rate').eq('id', quoteId).maybeSingle();
      let totalCents: number | null = null;
      if (items !== null && header !== null) {
        const ht = items.reduce(
          (sum, it) => sum + Number(it.quantity) * Number(it.unit_price_cents),
          0,
        );
        totalCents = Math.round(ht * (1 + Number(header.vat_rate) / 100));
      }

      const { data: conv } = await admin
        .from('client_conversations')
        .select('id, status')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let clientRepliedSinceSent = false;
      if (conv !== null && quote.sent_at !== null) {
        const { count } = await admin
          .from('client_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('direction', 'inbound')
          .gt('created_at', quote.sent_at as string);
        clientRepliedSinceSent = (count ?? 0) > 0;
      }

      const { data: portal } = await admin
        .from('client_portal_settings')
        .select('enabled')
        .eq('organization_id', quote.organization_id)
        .maybeSingle();

      const { count: planned } = await admin
        .from('quote_reminders')
        .select('id', { count: 'exact', head: true })
        .eq('quote_id', quoteId);

      return {
        quote: {
          id: quote.id as string,
          reference: quote.reference as string,
          title: (quote.title as string | null) ?? null,
          status: quote.status as string,
          valid_until: (quote.valid_until as string | null) ?? null,
          sent_at: (quote.sent_at as string | null) ?? null,
          reminders_enabled: Boolean(quote.reminders_enabled),
          customer_id: (quote.customer_id as string | null) ?? null,
        },
        totalCents,
        conversation: conv === null ? null : { id: conv.id as string, status: conv.status as string },
        clientRepliedSinceSent,
        portalEnabled: portal?.enabled === true,
        plannedCount: planned ?? 0,
      };
    },

    async insertOutboundMessage(input) {
      const { data, error } = await admin
        .from('client_messages')
        .insert({
          conversation_id: input.conversationId,
          organization_id: input.organizationId,
          direction: 'outbound',
          channel: 'portal',
          status: 'queued',
          body_text: input.body,
        })
        .select('id, conversation_id')
        .single();
      if (error !== null) return { error: error.message };
      return { id: data.id as string, conversation_id: data.conversation_id as string };
    },

    async markReminder(id, patch) {
      await admin.from('quote_reminders').update(patch).eq('id', id);
    },
  };
}
