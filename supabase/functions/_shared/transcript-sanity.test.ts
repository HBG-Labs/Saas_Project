import { assertEquals } from 'jsr:@std/assert@1';

import { verifierTexte } from './transcript-sanity.ts';

/*
  Ce qui est vérifié : le cas vécu (cyrillique sur un audio français muet)
  est refusé ; les formules de sous-titrage seules sont refusées ; un vrai
  texte français, même avec un nom étranger ou un mot dans un autre
  alphabet, passe ; une langue non latine n'est pas jugée sur l'alphabet.
*/

Deno.test('le cas vécu : du cyrillique pour un enregistrement en français est refusé', () => {
  assertEquals(verifierTexte('Анди Тоттенсон живет в зоопарке.', 'fr'), {
    ok: false,
    motif: 'alphabet',
  });
});

Deno.test('un texte vide ou blanc est refusé', () => {
  assertEquals(verifierTexte('   \n', 'fr'), { ok: false, motif: 'vide' });
});

Deno.test('une formule de sous-titrage seule est refusée ; noyée dans un vrai texte, non', () => {
  assertEquals(verifierTexte("Sous-titres réalisés par la communauté d'Amara.org", 'fr'), {
    ok: false,
    motif: 'hallucination',
  });
  assertEquals(verifierTexte("Merci d'avoir regardé !", 'fr'), {
    ok: false,
    motif: 'hallucination',
  });
  const long = `${'La PTO est posée au salon et le client valide le raccordement. '.repeat(6)}Merci d'avoir regardé.`;
  assertEquals(verifierTexte(long, 'fr'), { ok: true });
});

Deno.test('un vrai texte français passe, même avec un nom ou un mot étranger', () => {
  assertEquals(verifierTexte('On est chez Caraïbe Télécom, la PTO est posée. 36FO tiré.', 'fr'), {
    ok: true,
  });
  assertEquals(
    verifierTexte('Le client s’appelle Дмитрий, il valide le devis de 180 € HT.', 'fr'),
    {
      ok: true,
    },
  );
});

Deno.test('une langue non latine n’est pas jugée sur l’alphabet', () => {
  assertEquals(verifierTexte('Анди Тоттенсон живет в зоопарке.', 'ru'), { ok: true });
});

Deno.test('un texte sans lettres (chiffres seuls) n’est pas refusé pour l’alphabet', () => {
  assertEquals(verifierTexte('12 34 56', 'fr'), { ok: true });
});
