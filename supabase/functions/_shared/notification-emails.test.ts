import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  buildNotificationEmail,
  dateLisible,
  deepLink,
  wantsEmail,
  type ClaimedDelivery,
} from './notification-emails.ts';

/*
  Ce qui est vérifié : chaque événement a un sujet, un corps et un lien qui
  disent ce qui s'est passé, depuis l'instantané seul ; le réglage du
  destinataire gouverne l'envoi ; ce qui vient de la base est neutralisé dans
  le HTML.
*/

function livraison(partial: Partial<ClaimedDelivery>): ClaimedDelivery {
  return {
    id: 'd-1',
    organization_id: 'org-1',
    organization_name: 'HBG Labs',
    recipient_user_id: 'u-1',
    recipient_email: 'tech@exemple.fr',
    recipient_name: 'Alice',
    event: 'mission_assigned',
    entity_id: 'm-1',
    payload: {},
    attempts: 0,
    notify_new_mission: true,
    notify_leave_requests: true,
    notify_report_review: true,
    ...partial,
  };
}

Deno.test('le réglage du destinataire gouverne chaque famille', () => {
  assertEquals(
    wantsEmail(livraison({ event: 'mission_assigned', notify_new_mission: false })),
    false,
  );
  assertEquals(
    wantsEmail(livraison({ event: 'leave_requested', notify_leave_requests: false })),
    false,
  );
  assertEquals(
    wantsEmail(livraison({ event: 'leave_decided', notify_leave_requests: true })),
    true,
  );
  assertEquals(
    wantsEmail(livraison({ event: 'report_rejected', notify_report_review: false })),
    false,
  );
  assertEquals(wantsEmail(livraison({ event: 'report_submitted' })), true);
});

Deno.test('une affectation : sujet, faits, lien profond', () => {
  const mail = buildNotificationEmail(
    livraison({
      payload: {
        reference: 'M-2026-042',
        title: 'Raccordement fibre',
        scheduled_start: '2026-11-02T13:00:00Z',
        address: '12 rue des Flamboyants, 97233 Schœlcher',
        customer_name: 'Dupont',
        actor: 'Harry',
        path: '/missions/m-1',
      },
    }),
    { appUrl: 'https://rezo360.com/', timeZone: 'America/Martinique' },
  );
  assertEquals(mail.subject, 'Mission affectée : Raccordement fibre');
  assertStringIncludes(mail.text, 'Bonjour Alice,');
  assertStringIncludes(mail.text, 'Harry vous a affecté une mission.');
  assertStringIncludes(mail.text, 'Mission : M-2026-042 — Raccordement fibre');
  assertStringIncludes(mail.text, 'lundi 2 novembre');
  assertStringIncludes(mail.text, '09:00');
  assertStringIncludes(mail.text, 'Ouvrir la mission : https://rezo360.com/missions/m-1');
  assertStringIncludes(mail.html, 'href="https://rezo360.com/missions/m-1"');
});

Deno.test('un congé demandé, puis décidé', () => {
  const demande = buildNotificationEmail(
    livraison({
      event: 'leave_requested',
      payload: {
        requester: 'Bob',
        type: 'paid_leave',
        start_date: '2026-11-02',
        end_date: '2026-11-04',
        days_count: 3,
        path: '/planning',
      },
    }),
  );
  assertEquals(demande.subject, 'Congé à valider : Bob');
  assertStringIncludes(demande.text, 'Type : Congé payé');
  assertStringIncludes(demande.text, 'Du : 2 novembre 2026');
  assertStringIncludes(demande.text, 'Jours : 3');
  // Sans APP_URL : pas de lien, et pas de ligne vide orpheline.
  assertEquals(demande.text.includes('Ouvrir le planning'), false);

  const refus = buildNotificationEmail(
    livraison({
      event: 'leave_decided',
      payload: {
        status: 'rejected',
        actor: 'Harry',
        type: 'rtt',
        start_date: '2026-11-02',
        end_date: '2026-11-02',
        review_note: 'Chantier à livrer.',
      },
    }),
  );
  assertEquals(refus.subject, 'Congé refusé');
  assertStringIncludes(refus.text, 'Harry a refusé votre demande de congé.');
  assertStringIncludes(refus.text, 'Motif : Chantier à livrer.');
});

Deno.test('un compte rendu renvoyé porte son motif, et le HTML est neutralisé', () => {
  const mail = buildNotificationEmail(
    livraison({
      event: 'report_rejected',
      organization_name: 'HBG <Labs>',
      payload: {
        reference: 'M-1',
        title: 'Chantier',
        actor: 'Chef',
        rejection_reason: '<b>Photo</b> manquante',
        path: '/interventions/i-1',
      },
    }),
  );
  assertEquals(mail.subject, 'Compte rendu à reprendre : Chantier');
  assertStringIncludes(mail.text, 'Motif : <b>Photo</b> manquante');
  assertStringIncludes(mail.html, '&lt;b&gt;Photo&lt;/b&gt; manquante');
  assertStringIncludes(mail.html, 'HBG &lt;Labs&gt;');
});

Deno.test('dates et liens', () => {
  assertEquals(dateLisible('2026-11-02'), '2 novembre 2026');
  assertEquals(dateLisible(''), '');
  assertEquals(dateLisible('pas une date'), 'pas une date');
  assertEquals(deepLink('https://rezo360.com//', '/missions/1'), 'https://rezo360.com/missions/1');
  assertEquals(deepLink('https://rezo360.com', 'missions/1'), 'https://rezo360.com/missions/1');
  assertEquals(deepLink(undefined, '/missions/1'), null);
  assertEquals(deepLink('https://rezo360.com', ''), null);
});
