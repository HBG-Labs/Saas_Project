import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { buildProspectingNotificationEmail } from './prospecting-notifications.ts';

Deno.test('le sujet reflète le total, singulier et pluriel', () => {
  const un = buildProspectingNotificationEmail(
    { total: 1, tiers: { forte: 1, moyenne: 0, basse: 0 }, byZone: { Martinique: 1 } },
    undefined,
  );
  assertEquals(un.subject, '1 nouvelle opportunité REZO360');

  const plusieurs = buildProspectingNotificationEmail(
    { total: 17, tiers: { forte: 4, moyenne: 6, basse: 7 }, byZone: { Martinique: 17 } },
    undefined,
  );
  assertEquals(plusieurs.subject, '17 nouvelles opportunités REZO360');
});

Deno.test('omet les paliers et zones à zéro — jamais une ligne « 0 » qui n’apporte rien', () => {
  const email = buildProspectingNotificationEmail(
    { total: 4, tiers: { forte: 0, moyenne: 4, basse: 0 }, byZone: { Martinique: 4, Guadeloupe: 0 } },
    undefined,
  );

  assertStringIncludes(email.text, 'Opportunités moyennes : 4');
  assertEquals(email.text.includes('forte'), false);
  assertStringIncludes(email.text, 'Martinique : 4');
  assertEquals(email.text.includes('Guadeloupe'), false);
});

Deno.test('inclut un lien vers le radar seulement si une URL est fournie', () => {
  const avecUrl = buildProspectingNotificationEmail(
    { total: 1, tiers: { forte: 1, moyenne: 0, basse: 0 }, byZone: { Martinique: 1 } },
    'https://app.rezo360.com/admin/prospection',
  );
  assertStringIncludes(avecUrl.text, 'https://app.rezo360.com/admin/prospection');
  assertStringIncludes(avecUrl.html, 'https://app.rezo360.com/admin/prospection');

  const sansUrl = buildProspectingNotificationEmail(
    { total: 1, tiers: { forte: 1, moyenne: 0, basse: 0 }, byZone: { Martinique: 1 } },
    undefined,
  );
  assertEquals(sansUrl.text.includes('http'), false);
});

Deno.test('le corps mentionne le total détecté et la répartition géographique', () => {
  const email = buildProspectingNotificationEmail(
    { total: 17, tiers: { forte: 4, moyenne: 6, basse: 7 }, byZone: { Martinique: 12, Guadeloupe: 5 } },
    undefined,
  );

  assertStringIncludes(email.text, '17 nouvelles opportunités REZO360 détectées.');
  assertStringIncludes(email.text, 'Martinique : 12');
  assertStringIncludes(email.text, 'Guadeloupe : 5');
  assertStringIncludes(email.html, '🔥');
});
