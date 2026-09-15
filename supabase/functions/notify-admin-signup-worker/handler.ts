import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  buildOneSignalPayload,
  buildSignupAlertEmail,
  buildSignupAlertLinks,
  fetchSignupEnrichment,
  recordSignupAlertResult,
  type ChannelResult,
  type ClaimedSignupAlert,
  type EmailContent,
  type SignupEnrichment,
} from '../_shared/admin-signup-alerts.ts';
import { workerSecretMatches } from '../_shared/worker-secret.ts';

/**
 * Envoie l'alerte administrateur (e-mail + push) pour chaque inscription en
 * attente, sans jamais bloquer ni dupliquer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * L'ENVOI EST INJECTÉ, PAS LU DEPUIS L'ENVIRONNEMENT
 *
 * Même choix que `portal-request-access` : `sendEmail`/`sendPush` sont des
 * fonctions déjà closes sur leur transport (ou `null`, si non configuré).
 * `index.ts` les construit une fois depuis les secrets réels ; ce fichier ne
 * lit jamais `Deno.env` et se teste donc sans réseau ni configuration.
 *
 * DEUX CANAUX, DEUX ÉTATS
 *
 * Une ligne peut arriver ici avec l'e-mail déjà envoyé et seul le push en
 * attente (reprise après échec partiel). Chaque canal `pending` est tenté ;
 * un canal déjà `sent`/`skipped` ne l'est jamais — c'est ce qui rend une
 * reprise idempotente canal par canal, pas seulement ligne par ligne.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BATCH_SIZE = 25;
const BUDGET_MS = 50_000;

export interface SignupAlertWorkerConfig {
  url: string;
  serviceRoleKey: string;
  secret: string;
  /** Destinataire administrateur. `undefined` = e-mail non configuré. */
  adminEmail: string | undefined;
  /** `${APP_URL}/dashboard` — voir `buildSignupAlertLinks`. */
  appUrl: string | undefined;
  /** `null` : transport e-mail non configuré, le canal est tenté et échoue proprement. */
  sendEmail: ((content: EmailContent, to: string) => Promise<{ providerId: string | null }>) | null;
  /** Identifiants nécessaires à la CONSTRUCTION de la charge OneSignal (pas la clé REST, qui reste dans `sendPush`). */
  oneSignalAppId: string | undefined;
  oneSignalExternalUserId: string | undefined;
  /** `null` : OneSignal non configuré. */
  sendPush: ((payload: Record<string, unknown>) => Promise<void>) | null;
  /**
   * Met `signed_up_at` en forme lisible pour le corps du courriel.
   *
   * Injectée plutôt qu'appelée directement : `horodatage()` (`_shared/email.ts`)
   * lit `SUPPORT_TIMEZONE` dans l'environnement, ce que ce fichier ne doit
   * jamais faire pour rester testable sans permission Deno. `index.ts` passe
   * la vraie fonction ; les tests, un formateur trivial.
   */
  formatSignedUpAt: (iso: string) => string;
  fetch?: typeof fetch;
  now?: () => Date;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const EMPTY_ENRICHMENT: SignupEnrichment = {
  displayName: null,
  organizationId: null,
  organizationName: null,
  industryLabel: null,
  planLabel: null,
  subscriptionStatus: null,
  trialEndsAt: null,
};

export function createSignupAlertWorkerHandler(config: SignupAlertWorkerConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

    const providedSecret = request.headers.get('x-worker-secret') ?? '';
    if (!(await workerSecretMatches(providedSecret, config.secret))) {
      return json({ error: 'Accès refusé.' }, 401);
    }

    const clock = config.now ?? (() => new Date());
    const startedAt = clock().getTime();
    const withinBudget = () => clock().getTime() - startedAt < BUDGET_MS;
    const result = { attempted: 0, sent: 0, failed: 0 };

    const admin: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
      ...(config.fetch ? { global: { fetch: config.fetch } } : {}),
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.rpc('claim_admin_signup_alerts', { p_limit: BATCH_SIZE });
    if (error) return json({ error: "File d'alertes illisible." }, 503);

    for (const rawAlert of data ?? []) {
      if (!withinBudget()) break;
      const alert = rawAlert as ClaimedSignupAlert;
      result.attempted += 1;

      const results: ChannelResult[] = [];

      // Best-effort : une entreprise, un secteur ou une formule absents ne
      // doivent jamais empêcher l'alerte de partir avec ce qui est disponible.
      const enrichment = await fetchSignupEnrichment(admin, alert.user_id).catch(() => EMPTY_ENRICHMENT);

      if (alert.email_status === 'pending') {
        if (!config.sendEmail || !config.adminEmail) {
          results.push({
            channel: 'email',
            outcome: 'failed',
            error: new Error('ADMIN_SIGNUP_EMAIL ou le transport e-mail ne sont pas configurés.'),
          });
        } else {
          try {
            const links = buildSignupAlertLinks(config.url, config.appUrl, alert.email);
            const when = config.formatSignedUpAt(alert.signed_up_at);
            const content = buildSignupAlertEmail(alert, when, enrichment, links);
            const sent = await config.sendEmail(content, config.adminEmail);
            results.push({ channel: 'email', outcome: 'sent', providerId: sent.providerId });
          } catch (failure) {
            results.push({ channel: 'email', outcome: 'failed', error: failure });
          }
        }
      }

      if (alert.push_status === 'pending') {
        if (!config.sendPush || !config.oneSignalAppId || !config.oneSignalExternalUserId) {
          results.push({
            channel: 'push',
            outcome: 'failed',
            error: new Error('OneSignal (ONESIGNAL_APP_ID / ONESIGNAL_ADMIN_EXTERNAL_ID / clé REST) non configuré.'),
          });
        } else {
          try {
            const payload = buildOneSignalPayload(alert, enrichment, {
              appId: config.oneSignalAppId,
              externalUserId: config.oneSignalExternalUserId,
            });
            await config.sendPush(payload);
            results.push({ channel: 'push', outcome: 'sent' });
          } catch (failure) {
            results.push({ channel: 'push', outcome: 'failed', error: failure });
          }
        }
      }

      let rowOk = results.every((entry) => entry.outcome === 'sent');
      try {
        await recordSignupAlertResult(admin, alert, results, clock());
      } catch (recordFailure) {
        rowOk = false;
        console.error('notify-admin-signup-worker: résultat non enregistré', recordFailure);
      }

      if (rowOk) result.sent += 1;
      else result.failed += 1;
    }

    const durationMs = clock().getTime() - startedAt;
    const { error: heartbeatError } = await admin.from('admin_signup_alert_worker_runs').insert({
      ran_at: clock().toISOString(),
      attempted: result.attempted,
      sent: result.sent,
      failed: result.failed,
      duration_ms: durationMs,
    });
    if (heartbeatError) {
      console.error('notify-admin-signup-worker: battement de cœur impossible', heartbeatError);
    }

    return json({ ...result, durationMs });
  };
}
