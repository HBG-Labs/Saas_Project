import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  GLOSSAIRE_PAR_SECTEUR,
  PROMPT_MAX_CHARS,
  PROMPT_WHISPER_MAX_CHARS,
  construirePromptStt,
  glossaireDeBase,
  tronquerPourWhisper,
} from './stt-glossary.ts';

/*
  Le glossaire est un indice donné au moteur. Ce qui est vérifié : le secteur
  choisit ses termes, l'inconnu retombe sur « general », les termes
  d'organisation passent en premier sans doublon, le prompt reste court, et
  la coupe pour Whisper tombe sur une virgule.
*/

Deno.test('le glossaire suit le secteur, et « general » pour un secteur inconnu', () => {
  assertEquals(glossaireDeBase('fiber_telecom').includes('PTO'), true);
  assertEquals(glossaireDeBase('fiber_telecom').includes('disjoncteur'), false);
  assertEquals(glossaireDeBase('electrical').includes('NF C 15-100'), true);
  assertEquals(glossaireDeBase('secteur-qui-n-existe-pas').includes('chantier'), true);
  assertEquals(glossaireDeBase(null).includes('devis'), true, 'la gestion est toujours là');
  for (const [secteur, termes] of Object.entries(GLOSSAIRE_PAR_SECTEUR)) {
    assertEquals(termes.length > 0, true, secteur);
  }
});

Deno.test('le prompt est une phrase, courte, avec les termes d’organisation en premier', () => {
  const p = construirePromptStt({
    industry: 'fiber_telecom',
    termesSupplementaires: ['Caraïbe Télécom', 'Karim Benali', 'pto', ' '],
  });
  assertStringIncludes(p, 'Caraïbe Télécom, Karim Benali, ');
  assertEquals(p.length <= PROMPT_MAX_CHARS, true);
  assertEquals(p.endsWith('.'), true);
  // « pto » est déjà dans le secteur : pas de doublon, la première graphie gagne.
  assertEquals((p.match(/\bpto\b/gi) ?? []).length, 1);
});

Deno.test('au-delà de la limite, les derniers termes tombent, jamais au milieu d’un terme', () => {
  const beaucoup = Array.from({ length: 400 }, (_, i) => `terme-${String(i)}`);
  const p = construirePromptStt({
    industry: 'general',
    termesSupplementaires: beaucoup,
    maxChars: 300,
  });
  assertEquals(p.length <= 300, true);
  assertEquals(/terme-\d+\.$/.test(p), true);
  assertEquals(p.includes('terme-399'), false);
});

Deno.test('la coupe pour Whisper tombe sur une virgule et garde le point final', () => {
  const long = construirePromptStt({
    industry: 'electrical',
    termesSupplementaires: ['Alice Martin'],
  });
  const court = tronquerPourWhisper(long);
  assertEquals(court.length <= PROMPT_WHISPER_MAX_CHARS + 1, true);
  assertEquals(court.endsWith('.'), true);
  assertEquals(court.includes(',,'), false);
  assertEquals(tronquerPourWhisper('court.'), 'court.');
});
