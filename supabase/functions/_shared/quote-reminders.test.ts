import { assertEquals, assertMatch } from 'jsr:@std/assert@1';

import {
  buildReminderBody,
  decideReminder,
  formatEuros,
  nextReminderAttempt,
  type ReminderContext,
} from './quote-reminders.ts';

/* Sans permission Deno : rien ici ne lit l'environnement ni le réseau. */

const NOW = new Date('2026-09-23T10:00:00.000Z');

type CtxOverrides = Omit<Partial<ReminderContext>, 'quote'> & { quote?: Partial<ReminderContext['quote']> };

function ctx(overrides: CtxOverrides = {}): ReminderContext {
  const { quote, ...rest } = overrides;
  return {
    quote: {
      id: 'q1',
      reference: 'DEV-0007',
      title: 'Installation électrique du cabinet',
      status: 'sent',
      valid_until: '2026-10-15',
      sent_at: '2026-09-16T09:00:00.000Z',
      reminders_enabled: true,
      customer_id: 'c1',
      ...quote,
    },
    totalCents: 289_400,
    conversation: { id: 'conv1', status: 'open' },
    clientRepliedSinceSent: false,
    portalEnabled: true,
    plannedCount: 2,
    ...rest,
  };
}

// ---------------------------------------------------------------- décision

Deno.test('un devis envoyé, sans réponse, dans sa validité : on relance', () => {
  assertEquals(decideReminder(ctx(), NOW), { action: 'send' });
});

Deno.test('un devis accepté, refusé ou expiré entre-temps n’est jamais relancé', () => {
  for (const status of ['accepted', 'refused', 'expired', 'draft']) {
    const d = decideReminder(ctx({ quote: { status } }), NOW);
    assertEquals(d.action, 'skip', status);
  }
  assertMatch((decideReminder(ctx({ quote: { status: 'accepted' } }), NOW) as { reason: string }).reason, /accepté/);
});

Deno.test('le jour de la validité, on ne relance plus', () => {
  const d = decideReminder(ctx({ quote: { valid_until: '2026-09-23' } }), NOW);
  assertEquals(d, { action: 'skip', reason: 'Date de validité atteinte' });
  // La veille, si.
  assertEquals(decideReminder(ctx({ quote: { valid_until: '2026-09-24' } }), NOW).action, 'send');
});

Deno.test('le client a écrit dans le fil : la relance est inutile', () => {
  const d = decideReminder(ctx({ clientRepliedSinceSent: true }), NOW);
  assertEquals(d.action, 'skip');
  assertMatch((d as { reason: string }).reason, /déjà répondu/);
});

Deno.test('sans conversation (devis marqué envoyé à la main), rien ne part', () => {
  const d = decideReminder(ctx({ conversation: null }), NOW);
  assertEquals(d.action, 'skip');
  assertMatch((d as { reason: string }).reason, /non envoyé depuis REZO360/);
});

Deno.test('relances désactivées sur le devis, portail désactivé, fil clos : refus motivés', () => {
  assertMatch((decideReminder(ctx({ quote: { reminders_enabled: false } }), NOW) as { reason: string }).reason, /désactivées/);
  assertMatch((decideReminder(ctx({ portalEnabled: false }), NOW) as { reason: string }).reason, /Espace client/);
  assertMatch((decideReminder(ctx({ conversation: { id: 'x', status: 'closed' } }), NOW) as { reason: string }).reason, /close/);
});

// ---------------------------------------------------------------- texte

Deno.test('montants à la française', () => {
  assertEquals(formatEuros(289_400), '2 894,00 €');
  assertEquals(formatEuros(1_234_567), '12 345,67 €');
  assertEquals(formatEuros(500), '5,00 €');
});

Deno.test('première relance : référence, titre, montant, validité', () => {
  const body = buildReminderBody({
    sequence: 1,
    plannedCount: 2,
    reference: 'DEV-0007',
    title: 'Installation électrique du cabinet',
    validUntilLabel: '15 octobre 2026',
    totalCents: 289_400,
  });
  assertMatch(body, /DEV-0007 — Installation électrique du cabinet/);
  assertMatch(body, /2 894,00 € TTC/);
  assertMatch(body, /jusqu'au 15 octobre 2026\./);
  assertEquals(body.includes('passé cette date'), false, 'pas d’avertissement d’expiration avant la dernière relance');
  assertMatch(body, /transmis récemment/);
});

Deno.test('dernière relance : le texte prévient de l’expiration', () => {
  const body = buildReminderBody({
    sequence: 2,
    plannedCount: 2,
    reference: 'DEV-0007',
    title: null,
    validUntilLabel: '15 octobre 2026',
    totalCents: null,
  });
  assertMatch(body, /sans réponse concernant notre devis DEV-0007\./);
  assertMatch(body, /passé cette date, il faudra le mettre à jour/);
  assertEquals(body.includes('TTC'), false, 'sans montant lisible, on ne l’invente pas');
});

Deno.test('le texte ne contient ni HTML ni donnée technique', () => {
  const body = buildReminderBody({
    sequence: 1, plannedCount: 1, reference: 'DEV-1', title: '<b>x</b>', validUntilLabel: null, totalCents: 100,
  });
  // Le titre est repris tel quel ici : c'est `renderOutboundEmail` qui échappe
  // à l'entrée du HTML. Ce test documente que le corps est du texte brut.
  assertEquals(body.includes('<p'), false);
  assertEquals(body.includes('http'), false);
});

// ---------------------------------------------------------------- reprise

Deno.test('la reprise suit la même courbe que les autres workers', () => {
  assertEquals(nextReminderAttempt(0, NOW).toISOString(), '2026-09-23T10:00:30.000Z');
  assertEquals(nextReminderAttempt(3, NOW).toISOString(), '2026-09-23T10:04:00.000Z');
  assertEquals(nextReminderAttempt(10, NOW).getTime() - NOW.getTime(), 3600_000);
});
