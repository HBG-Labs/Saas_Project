import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  SEGMENT_MAX_CHARS,
  decouperEnSegments,
  phrasesDe,
  texteDesSegments,
} from './transcript-segments.ts';

/*
  Ce qui est vérifié : les segments sont des extraits littéraux, numérotés,
  jamais coupés au milieu d'une phrase, sans horodatage inventé ; leur
  concaténation redonne le texte.
*/

Deno.test('phrases : coupure après . ! ? …, pas ailleurs', () => {
  assertEquals(phrasesDe('La PTO est posée. Le client valide ! On revient demain… D’accord ?'), [
    'La PTO est posée.',
    'Le client valide !',
    'On revient demain…',
    'D’accord ?',
  ]);
  assertEquals(phrasesDe('Env. 3.5 m de câble'), ['Env. 3.5 m de câble']);
});

Deno.test('un texte court fait un seul segment, sans minutes ni locuteur', () => {
  assertEquals(decouperEnSegments('Bonjour à tous. On pose le boîtier jeudi.'), [
    {
      id: 's1',
      start: null,
      end: null,
      speaker: null,
      text: 'Bonjour à tous. On pose le boîtier jeudi.',
    },
  ]);
});

Deno.test('les paragraphes existants sont respectés, les blancs multiples ramenés', () => {
  const s = decouperEnSegments('Premier   paragraphe.\n\n\nSecond\nparagraphe.\n\n');
  assertEquals(
    s.map((x) => x.text),
    ['Premier paragraphe.', 'Second paragraphe.'],
  );
  assertEquals(
    s.map((x) => x.id),
    ['s1', 's2'],
  );
});

Deno.test('un long paragraphe est coupé entre phrases, sous la limite, et se reconstitue', () => {
  const phrase =
    'Le technicien vérifie la continuité optique sur la fibre douze avant de refermer le boîtier.';
  const texte = Array.from({ length: 20 }, () => phrase).join(' ');
  const segments = decouperEnSegments(texte);
  assert(segments.length > 1);
  for (const s of segments) {
    assert(s.text.length <= SEGMENT_MAX_CHARS, `segment trop long : ${String(s.text.length)}`);
    assert(s.text.endsWith('.'), 'un segment finit sur une phrase entière');
  }
  assertEquals(texteDesSegments(segments).replace(/\n/g, ' '), texte);
});

Deno.test('une phrase plus longue que la limite reste entière', () => {
  const longue = `Mot ${'mot '.repeat(149).trim()}.`;
  const segments = decouperEnSegments(`Courte. ${longue} Fin.`);
  assert(
    segments.some((s) => s.text === longue),
    'la phrase n’est pas coupée',
  );
});

Deno.test('un texte vide ne fait aucun segment', () => {
  assertEquals(decouperEnSegments('   \n\n '), []);
});
