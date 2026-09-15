import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import type { Message, SendResult } from '../_shared/email.ts';
import { createOutboundStore, deliverOutboundMessage, type OutboundStore } from '../_shared/portal-outbound.ts';
import {
  buildReminderBody,
  createReminderStore,
  decideReminder,
  MAX_REMINDER_ATTEMPTS,
  nextReminderAttempt,
  type ClaimedReminder,
  type ReminderStore,
} from '../_shared/quote-reminders.ts';
import { workerSecretMatches } from '../_shared/worker-secret.ts';

/**
 * Expédie les relances de devis dues.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Réveillé par pg_cron toutes les 15 minutes (`app.trigger_quote_reminder_worker`).
 * Tire les relances dues (`claim_quote_reminders`, SKIP LOCKED), revérifie
 * l'état du devis, écrit le message sortant au nom de l'entreprise dans le
 * fil du devis, et l'envoie EXACTEMENT comme « Envoyer au client » — via
 * `_shared/portal-outbound.ts`.
 *
 * Tout ce qui touche l'environnement (transport, secrets, fuseau) est injecté
 * par `index.ts` ; ce fichier se teste sans permission Deno.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BATCH_SIZE = 25;
const BUDGET_MS = 50_000;

export interface QuoteReminderWorkerConfig {
  url: string;
  serviceRoleKey: string;
  secret: string;
  /** Défauts de configuration du transport ; non vide = on ne tente rien. */
  missing: string[];
  send: (message: Message) => Promise<SendResult>;
  replySecret: string;
  inboundDomain: string;
  portalUrl: string;
  /** `dateLisible` de `_shared/email.ts` (lit `SUPPORT_TIMEZONE`) — injectée. */
  formatDate: (iso: string) => string;
  /** Pour les tests : remplace les accès base par des doubles. */
  stores?: { reminders: ReminderStore; outbound: OutboundStore };
  fetch?: typeof fetch;
  now?: () => Date;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export function createQuoteReminderWorkerHandler(config: QuoteReminderWorkerConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

    const providedSecret = request.headers.get('x-worker-secret') ?? '';
    if (!(await workerSecretMatches(providedSecret, config.secret))) {
      return json({ error: 'Accès refusé.' }, 401);
    }

    if (config.missing.length > 0) {
      // Rien n'est tiré : les relances restent dues et partiront une fois la
      // configuration complète — sans s'entasser en échecs.
      return json({ error: `Envoi non configuré : ${config.missing.join(', ')}.` }, 503);
    }

    const clock = config.now ?? (() => new Date());
    const startedAt = clock().getTime();
    const withinBudget = () => clock().getTime() - startedAt < BUDGET_MS;
    const result = { attempted: 0, sent: 0, skipped: 0, failed: 0 };

    const admin: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
      ...(config.fetch ? { global: { fetch: config.fetch } } : {}),
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const stores = config.stores ?? {
      reminders: createReminderStore(admin),
      outbound: createOutboundStore(admin),
    };

    const { data, error } = await admin.rpc('claim_quote_reminders', { p_limit: BATCH_SIZE });
    if (error) return json({ error: 'File de relances illisible.' }, 503);

    for (const raw of data ?? []) {
      if (!withinBudget()) break;
      const reminder = raw as ClaimedReminder;
      result.attempted += 1;
      const now = clock();

      try {
        const ctx = await stores.reminders.context(reminder.quote_id);
        if (ctx === null) {
          await stores.reminders.markReminder(reminder.id, {
            status: 'skipped',
            reason: 'Devis introuvable',
            locked_at: null,
          });
          result.skipped += 1;
          continue;
        }

        const decision = decideReminder(ctx, now);
        if (decision.action === 'skip') {
          await stores.reminders.markReminder(reminder.id, {
            status: 'skipped',
            reason: decision.reason,
            locked_at: null,
          });
          result.skipped += 1;
          continue;
        }

        const body = buildReminderBody({
          sequence: reminder.sequence,
          plannedCount: ctx.plannedCount,
          reference: ctx.quote.reference,
          title: ctx.quote.title,
          validUntilLabel: ctx.quote.valid_until ? config.formatDate(ctx.quote.valid_until) : null,
          totalCents: ctx.totalCents,
        });

        // `conversation` est non nul : `decideReminder` l'a exigé.
        const conversationId = ctx.conversation!.id;
        let inserted: { id: string; conversation_id: string };
        if (reminder.message_id !== null) {
          // Reprise après un échec d'envoi : le message existe déjà dans le
          // fil, en échec. On le renvoie — pas de doublon côté client.
          inserted = { id: reminder.message_id, conversation_id: conversationId };
        } else {
          const written = await stores.reminders.insertOutboundMessage({
            conversationId,
            organizationId: reminder.organization_id,
            body,
          });
          if ('error' in written) throw new Error(`Message non écrit : ${written.error}`);
          inserted = written;
          await stores.reminders.markReminder(reminder.id, { message_id: inserted.id });
        }

        const delivered = await deliverOutboundMessage(
          {
            store: stores.outbound,
            send: config.send,
            replySecret: config.replySecret,
            inboundDomain: config.inboundDomain,
            portalUrl: config.portalUrl,
          },
          inserted,
          body,
        );

        if (delivered.status === 'sent') {
          await stores.reminders.markReminder(reminder.id, {
            status: 'sent',
            sent_at: now.toISOString(),
            message_id: inserted.id,
            reason: null,
            locked_at: null,
          });
          result.sent += 1;
        } else {
          // Le message est dans le fil, en échec, avec son motif (AC30). La
          // relance sera retentée, et renverra CE message.
          throw new Error(delivered.error);
        }
      } catch (failure) {
        result.failed += 1;
        const attempts = reminder.attempts + 1;
        const reason = (failure instanceof Error ? failure.message : String(failure)).slice(0, 500);
        try {
          await stores.reminders.markReminder(
            reminder.id,
            attempts >= MAX_REMINDER_ATTEMPTS
              ? { status: 'failed', reason, attempts, locked_at: null }
              : { attempts, reason, next_attempt_at: nextReminderAttempt(attempts, now).toISOString(), locked_at: null },
          );
        } catch (markFailure) {
          console.error('quote-reminder-worker: reprise impossible', markFailure);
        }
      }
    }

    const durationMs = clock().getTime() - startedAt;
    return json({ ...result, durationMs });
  };
}
