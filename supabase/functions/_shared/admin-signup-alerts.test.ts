import { assertEquals, assertMatch } from 'jsr:@std/assert@1';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  buildOneSignalPayload,
  buildSignupAlertEmail,
  buildSignupAlertLinks,
  nextSignupAlertAttempt,
  recordSignupAlertResult,
  studioProjectUrl,
  type ClaimedSignupAlert,
  type SignupEnrichment,
} from './admin-signup-alerts.ts';

/*
  Ces tests tournent SANS permission Deno (ni réseau, ni environnement, ni
  disque), comme le reste de la CI. Aucune fonction testée ici ne lit
  `Deno.env` ni n'utilise le `fetch` global : `recordSignupAlertResult` reçoit
  un client Supabase dont le transport est une fonction JS pure — voir
  `subscription-seat-sync-worker/handler.test.ts` pour le même procédé.
*/

const EMPTY: SignupEnrichment = {
  displayName: null,
  organizationId: null,
  organizationName: null,
  industryLabel: null,
  planLabel: null,
  subscriptionStatus: null,
  trialEndsAt: null,
};

const ALERT: Pick<ClaimedSignupAlert, 'email' | 'signed_up_at'> = {
  email: 'nouveau@example.com',
  signed_up_at: '2026-09-15T10:00:00.000Z',
};

// ---------------------------------------------------------------- backoff

Deno.test('la reprise démarre à 30 s et double à chaque essai', () => {
  const now = new Date('2026-09-15T10:00:00.000Z');
  assertEquals(nextSignupAlertAttempt(0, now).toISOString(), '2026-09-15T10:00:30.000Z');
  assertEquals(nextSignupAlertAttempt(1, now).toISOString(), '2026-09-15T10:01:00.000Z');
  assertEquals(nextSignupAlertAttempt(2, now).toISOString(), '2026-09-15T10:02:00.000Z');
});

Deno.test('la reprise plafonne à une heure, sans jamais abandonner', () => {
  const now = new Date('2026-09-15T10:00:00.000Z');
  const delayMs = nextSignupAlertAttempt(20, now).getTime() - now.getTime();
  assertEquals(delayMs, 3600_000);
});

// ---------------------------------------------------------------- liens

Deno.test('le lien Studio se déduit de la référence du projet', () => {
  assertEquals(
    studioProjectUrl('https://wtsiaisfwtthmcxygeei.supabase.co'),
    'https://supabase.com/dashboard/project/wtsiaisfwtthmcxygeei',
  );
});

Deno.test('une URL Supabase illisible ne fait pas échouer la construction des liens', () => {
  const links = buildSignupAlertLinks('pas-une-url', undefined, 'a@b.com');
  assertEquals(links.appUrl, null);
  assertEquals(links.studioUrl, null);
});

Deno.test('APP_URL absent : pas de lien REZO360, le lien Studio reste', () => {
  const links = buildSignupAlertLinks('https://wtsiaisfwtthmcxygeei.supabase.co', undefined, 'a@b.com');
  assertEquals(links.appUrl, null);
  assertMatch(links.studioUrl ?? '', /supabase\.com\/dashboard\/project\/wtsiaisfwtthmcxygeei/);
});

Deno.test('APP_URL configuré construit le lien tableau de bord, sans double slash', () => {
  const links = buildSignupAlertLinks(
    'https://wtsiaisfwtthmcxygeei.supabase.co',
    'https://app.rezo360.com/',
    'a@b.com',
  );
  assertEquals(links.appUrl, 'https://app.rezo360.com/dashboard');
});

// ---------------------------------------------------------------- courriel

Deno.test('e-mail minimal : seuls l’adresse et la date apparaissent', () => {
  const content = buildSignupAlertEmail(ALERT, '15/09/2026 12:00', EMPTY, { appUrl: null, studioUrl: null });
  assertEquals(content.subject, '🎉 Nouvelle inscription sur REZO360');
  assertMatch(content.text, /nouveau@example\.com/);
  // Rien sur l'entreprise ou la formule tant qu'elles ne sont pas connues.
  assertEquals(content.text.includes('Entreprise'), false);
  assertEquals(content.text.includes('Formule'), false);
});

Deno.test('e-mail complet : entreprise, secteur et formule apparaissent tous', () => {
  const enrichment: SignupEnrichment = {
    displayName: 'Nadia Belkacem',
    organizationId: 'org-1',
    organizationName: 'Le Fournil de Belleville',
    industryLabel: 'Électricité',
    planLabel: 'Business',
    subscriptionStatus: 'trialing',
    trialEndsAt: '2026-10-01T00:00:00.000Z',
  };
  const content = buildSignupAlertEmail(ALERT, '15/09/2026 12:00', enrichment, {
    appUrl: 'https://app.rezo360.com/dashboard',
    studioUrl: null,
  });
  assertMatch(content.text, /Nadia Belkacem/);
  assertMatch(content.text, /Le Fournil de Belleville/);
  assertMatch(content.text, /Électricité/);
  assertMatch(content.text, /Business \(essai en cours\)/);
  assertMatch(content.text, /Voir dans REZO360/);
  assertMatch(content.html, /Voir dans REZO360/);
});

Deno.test('e-mail : aucun mot de passe, jeton ni clé ne peut y figurer', () => {
  const enrichment: SignupEnrichment = {
    ...EMPTY,
    // Un champ qui, PAR CONSTRUCTION, ne fait pas partie du modèle envoyé au
    // gabarit : ce test documente que `buildSignupAlertEmail` n'a même pas
    // accès à ce type de donnée, pas seulement qu'il choisit de ne pas s'en
    // servir.
    organizationName: 'Le Fournil de Belleville',
  };
  const content = buildSignupAlertEmail(ALERT, '15/09/2026 12:00', enrichment, { appUrl: null, studioUrl: null });
  for (const forbidden of ['password', 'mot de passe', 'token', 'jeton', 'api_key', 'service_role']) {
    assertEquals(content.html.toLowerCase().includes(forbidden), false, `« ${forbidden} » ne doit pas apparaître`);
    assertEquals(content.text.toLowerCase().includes(forbidden), false, `« ${forbidden} » ne doit pas apparaître`);
  }
});

Deno.test('e-mail : le HTML injecté dans un nom d’entreprise est échappé', () => {
  const enrichment: SignupEnrichment = { ...EMPTY, organizationName: '<img src=x onerror=alert(1)>' };
  const content = buildSignupAlertEmail(ALERT, '15/09/2026 12:00', enrichment, { appUrl: null, studioUrl: null });
  assertEquals(content.html.includes('<img src=x'), false);
  assertMatch(content.html, /&lt;img/);
});

// ---------------------------------------------------------------- push

Deno.test('push : entreprise connue → message avec le nom de l’entreprise', () => {
  const enrichment: SignupEnrichment = { ...EMPTY, organizationName: 'Le Fournil de Belleville' };
  const payload = buildOneSignalPayload(ALERT, enrichment, { appId: 'app-1', externalUserId: 'harry' });
  assertEquals(payload.app_id, 'app-1');
  assertEquals(payload.include_external_user_ids, ['harry']);
  assertEquals(
    (payload.contents as Record<string, string>).fr,
    'Nouvelle entreprise inscrite : Le Fournil de Belleville',
  );
});

Deno.test('push : entreprise inconnue → repli sur l’e-mail', () => {
  const payload = buildOneSignalPayload(ALERT, EMPTY, { appId: 'app-1', externalUserId: 'harry' });
  assertEquals((payload.contents as Record<string, string>).fr, 'Nouvel utilisateur inscrit : nouveau@example.com');
});

Deno.test('push : le lien profond cible la fiche organisation si elle existe, sinon le tableau de bord', () => {
  const withOrg = buildOneSignalPayload(ALERT, { ...EMPTY, organizationId: 'org-1' }, {
    appId: 'app-1',
    externalUserId: 'harry',
  });
  assertEquals((withOrg.data as Record<string, string>).deepLink, '/organizations/org-1');

  const withoutOrg = buildOneSignalPayload(ALERT, EMPTY, { appId: 'app-1', externalUserId: 'harry' });
  assertEquals((withoutOrg.data as Record<string, string>).deepLink, '/dashboard');
});

// ---------------------------------------------------------------- résultat

/** Renvoie un client factice et les correctifs qu'il a reçus, dans l'ordre. */
function fakeAdminClient(): { admin: SupabaseClient; updates: Record<string, unknown>[] } {
  const updates: Record<string, unknown>[] = [];
  const fakeFetch: typeof fetch = (input, init) => {
    const url = String(input);
    if (init?.method === 'PATCH' && url.includes('/admin_signup_alerts')) {
      updates.push(init.body ? JSON.parse(String(init.body)) : {});
    }
    return Promise.resolve(new Response('[{}]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
  const admin = createClient('https://project.supabase.co', 'service-role', {
    global: { fetch: fakeFetch },
    auth: { persistSession: false },
  });
  return { admin, updates };
}

const CLAIMED: ClaimedSignupAlert = {
  user_id: 'user-1',
  email: 'nouveau@example.com',
  signed_up_at: '2026-09-15T10:00:00.000Z',
  attempts: 0,
  email_status: 'pending',
  push_status: 'pending',
};

Deno.test('les deux canaux réussissent : rien à retenter', async () => {
  const { admin, updates } = fakeAdminClient();

  await recordSignupAlertResult(
    admin,
    CLAIMED,
    [
      { channel: 'email', outcome: 'sent', providerId: 'resend-123' },
      { channel: 'push', outcome: 'sent' },
    ],
    new Date('2026-09-15T10:00:05.000Z'),
  );

  const patch = updates[0];
  assertEquals(patch?.email_status, 'sent');
  assertEquals(patch?.push_status, 'sent');
  assertEquals(patch?.email_provider_id, 'resend-123');
  assertEquals(patch?.last_error, null);
  assertEquals(patch?.locked_at, null);
});

Deno.test('e-mail en échec, push réussi : seul l’e-mail est planifié pour une reprise', async () => {
  const { admin, updates } = fakeAdminClient();

  await recordSignupAlertResult(
    admin,
    CLAIMED,
    [
      { channel: 'email', outcome: 'failed', error: new Error('Resend 500 : indisponible') },
      { channel: 'push', outcome: 'sent' },
    ],
    new Date('2026-09-15T10:00:05.000Z'),
  );

  const patch = updates[0];
  // Le push est acquis : un futur `claim` ne doit plus jamais le retenter.
  assertEquals(patch?.push_status, 'sent');
  // L'e-mail reste `pending` (non modifié dans le correctif) : un futur
  // `claim` le retentera, sans y renvoyer le push.
  assertEquals(patch !== undefined && 'email_status' in patch, false);
  assertMatch(String(patch?.last_error), /e-mail/);
  assertEquals(patch?.next_attempt_at !== CLAIMED.signed_up_at, true);
});

Deno.test('aucun message d’erreur enregistré ne dépasse 500 caractères', async () => {
  const { admin, updates } = fakeAdminClient();

  await recordSignupAlertResult(
    admin,
    CLAIMED,
    [{ channel: 'email', outcome: 'failed', error: new Error('x'.repeat(2000)) }],
    new Date('2026-09-15T10:00:05.000Z'),
  );

  assertEquals(((updates[0]?.last_error as string) ?? '').length <= 500, true);
});
