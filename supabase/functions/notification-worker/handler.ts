import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  buildNotificationEmail,
  wantsEmail,
  type ClaimedDelivery,
  type NotificationEmail,
} from '../_shared/notification-emails.ts';
import { workerSecretMatches } from '../_shared/worker-secret.ts';

/**
 * Envoie les e-mails de notification en attente (affectation, congé, compte
 * rendu), sans jamais bloquer ni dupliquer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MÊME PATRON QUE notify-admin-signup-worker
 *
 * Le tirage est atomique côté base (`claim_notification_deliveries`, SKIP
 * LOCKED) ; chaque ligne finit par `record_notification_delivery_result`, qui
 * décide seul du recul et de l'abandon. Ici : décider d'envoyer (le réglage du
 * destinataire, évalué MAINTENANT — arbitrage D), envoyer, rendre compte.
 *
 * `sendEmail` est injectée, déjà close sur son transport : ce fichier ne lit
 * jamais `Deno.env` et se teste sans réseau.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BATCH_SIZE = 25;
const BUDGET_MS = 50_000;

export interface NotificationWorkerConfig {
  url: string;
  serviceRoleKey: string;
  secret: string;
  appUrl: string | undefined;
  timeZone: string;
  /** `null` : transport e-mail non configuré — chaque ligne échoue proprement et sera retentée. */
  sendEmail:
    ((content: NotificationEmail, to: string) => Promise<{ providerId: string | null }>) | null;
  fetch?: typeof fetch;
  now?: () => Date;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export function createNotificationWorkerHandler(config: NotificationWorkerConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

    const providedSecret = request.headers.get('x-worker-secret') ?? '';
    if (!(await workerSecretMatches(providedSecret, config.secret))) {
      return json({ error: 'Accès refusé.' }, 401);
    }

    const clock = config.now ?? (() => new Date());
    const startedAt = clock().getTime();
    const withinBudget = () => clock().getTime() - startedAt < BUDGET_MS;
    const result = { attempted: 0, sent: 0, skipped: 0, failed: 0 };

    const admin: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
      ...(config.fetch ? { global: { fetch: config.fetch } } : {}),
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.rpc('claim_notification_deliveries', {
      p_limit: BATCH_SIZE,
    });
    if (error) return json({ error: 'File de notifications illisible.' }, 503);

    for (const raw of data ?? []) {
      if (!withinBudget()) break;
      const delivery = raw as ClaimedDelivery;
      result.attempted += 1;

      let outcome: 'sent' | 'skipped' | 'error' = 'error';
      let providerId: string | null = null;
      let errorMessage: string | null = null;

      if (!wantsEmail(delivery)) {
        outcome = 'skipped';
      } else if (!delivery.recipient_email) {
        outcome = 'skipped';
      } else if (!config.sendEmail) {
        errorMessage =
          "Le transport e-mail n'est pas configuré (RESEND_API_KEY / SMTP, INVITATION_FROM_EMAIL).";
      } else {
        try {
          const content = buildNotificationEmail(delivery, {
            appUrl: config.appUrl,
            timeZone: config.timeZone,
          });
          const sent = await config.sendEmail(content, delivery.recipient_email);
          outcome = 'sent';
          providerId = sent.providerId;
        } catch (failure) {
          errorMessage = failure instanceof Error ? failure.message : String(failure);
        }
      }

      const { error: recordError } = await admin.rpc('record_notification_delivery_result', {
        p_id: delivery.id,
        p_outcome: outcome,
        p_provider_id: providerId,
        p_error: errorMessage,
      });
      if (recordError) {
        console.error('notification-worker: résultat non enregistré', recordError);
        result.failed += 1;
        continue;
      }
      if (outcome === 'sent') result.sent += 1;
      else if (outcome === 'skipped') result.skipped += 1;
      else result.failed += 1;
    }

    const durationMs = clock().getTime() - startedAt;
    const { error: heartbeatError } = await admin.from('notification_worker_runs').insert({
      ran_at: clock().toISOString(),
      attempted: result.attempted,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
      duration_ms: durationMs,
    });
    if (heartbeatError)
      console.error('notification-worker: battement de cœur impossible', heartbeatError);

    return json({ ...result, durationMs });
  };
}
