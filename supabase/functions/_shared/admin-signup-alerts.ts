import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import { escapeHtml, readTransport, sendMessage, type TransportState } from './email.ts';

/**
 * Domaine de l'alerte administrateur à chaque inscription réelle.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER, PLUTÔT QUE D'ÉCRIRE DANS LE WORKER
 *
 * Même raison que `_shared/subscription-seats.ts` : la construction du courriel,
 * la charge OneSignal et le calcul de reprise sont des fonctions PURES, donc
 * testables sans réseau ni variable d'environnement. Le worker
 * (`notify-admin-signup-worker/handler.ts`) ne fait que les enchaîner.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Ligne renvoyée par `claim_admin_signup_alerts`. */
export interface ClaimedSignupAlert {
  user_id: string;
  email: string;
  signed_up_at: string;
  attempts: number;
  email_status: 'pending' | 'sent' | 'skipped';
  push_status: 'pending' | 'sent' | 'skipped';
}

/**
 * Ce qu'on sait du nouvel inscrit AU MOMENT DE L'ENVOI — souvent partiel.
 *
 * L'entreprise se crée par un écran séparé, APRÈS l'inscription (voir la
 * migration). `null` est donc l'état normal, pas une anomalie : le courriel et
 * la notification doivent rester corrects avec ou sans ces informations.
 */
export interface SignupEnrichment {
  displayName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  industryLabel: string | null;
  planLabel: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
}

const EMPTY_ENRICHMENT: SignupEnrichment = {
  displayName: null,
  organizationId: null,
  organizationName: null,
  industryLabel: null,
  planLabel: null,
  subscriptionStatus: null,
  trialEndsAt: null,
};

/**
 * Rassemble ce qui est disponible sur l'inscrit : profil, première entreprise
 * rejointe, métier, formule ou essai en cours.
 *
 * Best-effort par construction : chaque lecture manquante retombe sur `null`
 * plutôt que d'interrompre l'envoi. Une erreur réseau sur UNE requête ne doit
 * jamais empêcher le courriel de partir avec le peu qu'on a déjà.
 */
export async function fetchSignupEnrichment(
  admin: SupabaseClient,
  userId: string,
): Promise<SignupEnrichment> {
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();

  const { data: membership } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const organizationId = (membership?.organization_id as string | undefined) ?? null;
  if (!organizationId) {
    return { ...EMPTY_ENRICHMENT, displayName: (profile?.display_name as string | undefined) ?? null };
  }

  const { data: organization } = await admin
    .from('organizations')
    .select('name, industry')
    .eq('id', organizationId)
    .maybeSingle();

  const industryCode = (organization?.industry as string | undefined) ?? null;
  const { data: industry } = industryCode
    ? await admin.from('industries').select('label').eq('code', industryCode).maybeSingle()
    : { data: null };

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('plan_code, status, trial_ends_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const planCode = (subscription?.plan_code as string | undefined) ?? null;
  const { data: plan } = planCode
    ? await admin.from('plans').select('name').eq('code', planCode).maybeSingle()
    : { data: null };

  return {
    displayName: (profile?.display_name as string | undefined) ?? null,
    organizationId,
    organizationName: (organization?.name as string | undefined) ?? null,
    industryLabel: (industry?.label as string | undefined) ?? null,
    planLabel: (plan?.name as string | undefined) ?? null,
    subscriptionStatus: (subscription?.status as string | undefined) ?? null,
    trialEndsAt: (subscription?.trial_ends_at as string | undefined) ?? null,
  };
}

/** Délai avant nouvel essai : identique à la synchronisation des sièges. */
export function nextSignupAlertAttempt(attempts: number, now = new Date()): Date {
  const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(Math.max(attempts, 0), 7));
  return new Date(now.getTime() + delaySeconds * 1000);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface SignupAlertLinks {
  /** `${APP_URL}/dashboard`, ou `null` si `APP_URL` n'est pas configuré. */
  appUrl: string | null;
  /** Fiche Auth de Supabase Studio, filtrée sur l'e-mail — la seule « fiche
   * utilisateur » qui existe aujourd'hui, faute de page admin dans REZO360. */
  studioUrl: string | null;
}

/** `https://<ref>.supabase.co` → `https://supabase.com/dashboard/project/<ref>`. */
export function studioProjectUrl(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname;
    const ref = host.split('.')[0];
    return ref ? `https://supabase.com/dashboard/project/${ref}` : null;
  } catch {
    return null;
  }
}

export function buildSignupAlertLinks(
  supabaseUrl: string,
  appUrl: string | undefined,
  email: string,
): SignupAlertLinks {
  const trimmedAppUrl = appUrl?.trim();
  const project = studioProjectUrl(supabaseUrl);

  return {
    appUrl: trimmedAppUrl ? `${trimmedAppUrl.replace(/\/$/, '')}/dashboard` : null,
    studioUrl: project ? `${project}/auth/users?filter=${encodeURIComponent(email)}` : null,
  };
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const PLAN_STATUS_LABEL: Record<string, string> = {
  trialing: 'essai en cours',
  active: 'actif',
  past_due: 'paiement en retard',
  canceled: 'résilié',
};

/**
 * Le courriel administrateur. Chaque champ optionnel n'apparaît QUE s'il est
 * disponible — voir `SignupEnrichment`. Jamais de mot de passe, jeton ou clé :
 * rien de ce qui suit n'en manipule.
 *
 * `when` est déjà formatée par l'appelant (`horodatage()` de `_shared/email.ts`,
 * qui lit `SUPPORT_TIMEZONE`) plutôt que recalculée ici : cette fonction reste
 * ainsi pure, sans accès à l'environnement, et se teste sans permission Deno.
 */
export function buildSignupAlertEmail(
  alert: Pick<ClaimedSignupAlert, 'email'>,
  when: string,
  enrichment: SignupEnrichment,
  links: SignupAlertLinks,
): EmailContent {
  const subject = '🎉 Nouvelle inscription sur REZO360';

  const planLine =
    enrichment.planLabel && enrichment.subscriptionStatus
      ? `${enrichment.planLabel} (${PLAN_STATUS_LABEL[enrichment.subscriptionStatus] ?? enrichment.subscriptionStatus})`
      : (enrichment.planLabel ?? null);

  const rows: Array<[string, string | null]> = [
    ['Nom', enrichment.displayName],
    ['Entreprise', enrichment.organizationName],
    ['E-mail', alert.email],
    ["Secteur d'activité", enrichment.industryLabel],
    ['Formule / essai', planLine],
    ['Inscrit le', when],
  ];

  const textRows = rows
    .filter(([, value]) => value !== null && value !== '')
    .map(([label, value]) => `${label} : ${value}`)
    .join('\n');

  const htmlRows = rows
    .filter(([, value]) => value !== null && value !== '')
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0;font-weight:600;">${escapeHtml(value ?? '')}</td></tr>`,
    )
    .join('');

  const ctaHtml = links.appUrl
    ? `<p style="margin:24px 0;">
        <a href="${escapeHtml(links.appUrl)}"
           style="background:#111827;color:#ffffff;padding:10px 20px;border-radius:8px;
                  text-decoration:none;font-weight:600;display:inline-block;">
          Voir dans REZO360
        </a>
      </p>`
    : '';

  const studioHtml = links.studioUrl
    ? `<p style="margin:8px 0;font-size:13px;">
        <a href="${escapeHtml(links.studioUrl)}" style="color:#6b7280;">Ouvrir la fiche dans Supabase</a>
      </p>`
    : '';

  const html = `
<!doctype html>
<html lang="fr">
  <body style="font-family:system-ui,-apple-system,sans-serif;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:18px;margin:0 0 12px;">🎉 Nouvelle inscription sur REZO360</h1>
    <p style="margin:0 0 16px;">Un nouvel utilisateur vient de s'inscrire sur REZO360.</p>
    <table style="border-collapse:collapse;font-size:14px;">${htmlRows}</table>
    ${ctaHtml}
    ${studioHtml}
  </body>
</html>`.trim();

  const text = [
    'Un nouvel utilisateur vient de s\'inscrire sur REZO360.',
    '',
    textRows,
    '',
    links.appUrl ? `Voir dans REZO360 : ${links.appUrl}` : null,
    links.studioUrl ? `Fiche Supabase : ${links.studioUrl}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject, html, text };
}

/** Envoie le courriel administrateur avec le transport déjà configuré ailleurs. */
export async function sendSignupAlertEmail(
  content: EmailContent,
  destination: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ providerId: string | null }> {
  const state: TransportState = readTransport('INVITATION_FROM_EMAIL');
  if (state.transport === null || state.from === undefined) {
    throw new Error(`Envoi non configuré : ${state.missing.join(', ')}.`);
  }
  const result = await sendMessage(
    { to: destination, subject: content.subject, html: content.html, text: content.text },
    state,
    fetchImpl,
  );
  return { providerId: result.providerId };
}

export interface OneSignalConfig {
  appId: string;
  restApiKey: string;
  externalUserId: string;
}

/** Charge utile REST OneSignal — exportée pour les tests. */
export function buildOneSignalPayload(
  alert: Pick<ClaimedSignupAlert, 'email'>,
  enrichment: SignupEnrichment,
  config: Pick<OneSignalConfig, 'appId' | 'externalUserId'>,
): Record<string, unknown> {
  const message = enrichment.organizationName
    ? `Nouvelle entreprise inscrite : ${enrichment.organizationName}`
    : `Nouvel utilisateur inscrit : ${alert.email}`;

  return {
    app_id: config.appId,
    include_external_user_ids: [config.externalUserId],
    channel_for_external_user_ids: 'push',
    headings: { fr: '🎉 Nouvelle inscription REZO360', en: '🎉 New REZO360 signup' },
    contents: { fr: message, en: message },
    // Interprété côté client (voir `src/lib/push-notifications.ts`) : ouvre la
    // fiche entreprise si elle existe déjà, sinon le tableau de bord.
    data: {
      type: 'admin_signup_alert',
      deepLink: enrichment.organizationId ? `/organizations/${enrichment.organizationId}` : '/dashboard',
    },
  };
}

/** Envoie la notification push via l'API REST de OneSignal. */
export async function sendSignupAlertPush(
  payload: Record<string, unknown>,
  config: Pick<OneSignalConfig, 'restApiKey'>,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${config.restApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Le corps de réponse OneSignal ne contient ni clé ni jeton — seulement un
    // motif d'erreur (app_id invalide, destinataire inconnu…) : sûr à logger.
    throw new Error(`OneSignal ${response.status} : ${await response.text()}`);
  }
}

/**
 * Marque le résultat d'UN canal, sans toucher à l'autre.
 *
 * Pas d'état « skipped » ici : un canal tenté réussit ou échoue, c'est tout.
 * La colonne SQL en garde un pour un usage futur (désactivation manuelle d'un
 * canal), mais rien dans ce worker ne le produit aujourd'hui.
 */
export interface ChannelResult {
  channel: 'email' | 'push';
  outcome: 'sent' | 'failed';
  providerId?: string | null;
  error?: unknown;
}

/**
 * Applique les résultats des deux canaux à la ligne, et planifie — ou non —
 * un nouvel essai.
 *
 * Un canal `sent` ou `skipped` ne sera plus jamais retenté : `claim` l'exclut
 * dès que les deux valent l'un de ces deux états. C'est ce qui rend une
 * reprise idempotente canal par canal (test « erreur e-mail, push OK »).
 */
export async function recordSignupAlertResult(
  admin: SupabaseClient,
  alert: ClaimedSignupAlert,
  results: ChannelResult[],
  now = new Date(),
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: now.toISOString() };
  const errors: string[] = [];

  for (const result of results) {
    if (result.channel === 'email') {
      if (result.outcome === 'sent') {
        patch.email_status = 'sent';
        patch.email_sent_at = now.toISOString();
        patch.email_provider_id = result.providerId ?? null;
        patch.email_error = null;
      } else {
        patch.email_error = errorMessage(result.error).slice(0, 500);
        errors.push(`e-mail : ${patch.email_error}`);
      }
    } else if (result.channel === 'push') {
      if (result.outcome === 'sent') {
        patch.push_status = 'sent';
        patch.push_sent_at = now.toISOString();
        patch.push_error = null;
      } else {
        patch.push_error = errorMessage(result.error).slice(0, 500);
        errors.push(`push : ${patch.push_error}`);
      }
    }
  }

  const isDone = (status: string) => status === 'sent' || status === 'skipped';
  const finalEmailStatus = (patch.email_status as string | undefined) ?? alert.email_status;
  const finalPushStatus = (patch.push_status as string | undefined) ?? alert.push_status;
  const stillPending = !(isDone(finalEmailStatus) && isDone(finalPushStatus));

  const attempts = alert.attempts + 1;
  patch.attempts = attempts;
  patch.locked_at = null;
  patch.last_error = errors.length > 0 ? errors.join(' | ').slice(0, 500) : null;
  patch.next_attempt_at = stillPending
    ? nextSignupAlertAttempt(attempts, now).toISOString()
    : alert.signed_up_at; // n'a plus d'importance : `claim` n'y regardera plus.

  const { error } = await admin.from('admin_signup_alerts').update(patch).eq('user_id', alert.user_id);
  if (error) throw new Error(`Résultat d'alerte non enregistré : ${error.message}`);
}
