import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import {
  RESUME_MAX_ELEMENTS,
  lireResume,
  requeteResume,
  resumeEnMarkdown,
} from './structured-summary.ts';
import type { Segment } from './transcript-segments.ts';

/*
  Ce qui est vérifié : le résumé structuré ne cite que des segments qui
  existent, borne ce que le modèle rend, refuse ce qui n'a pas la forme, et
  le Markdown de la page en est dérivé — mêmes éléments, mêmes renvois.
*/

const seg = (id: string, text: string): Segment => ({
  id,
  start: null,
  end: null,
  speaker: null,
  text,
});
const SEGMENTS: Segment[] = [
  seg('s1', 'Bonjour à tous, on est chez Caraïbe Télécom.'),
  seg('s2', 'La PTO est posée au salon, le client valide.'),
  seg('s3', 'Karim repasse jeudi pour la soudure.'),
];

Deno.test('la requête numérote les segments dans une enveloppe non fiable', () => {
  const q = requeteResume(SEGMENTS);
  assertStringIncludes(q, '<TRANSCRIPTION_UNTRUSTED>\n[s1] Bonjour');
  assertStringIncludes(
    q,
    '\n[s3] Karim repasse jeudi pour la soudure.\n</TRANSCRIPTION_UNTRUSTED>',
  );
});

Deno.test('lecture : citations filtrées sur les segments existants, textes bornés', () => {
  const r = lireResume(
    `Voici : {"points_cles":[{"texte":"  PTO posée,\\n client d’accord ","citations":["s2","[s2]","s9","x"]}],
      "decisions":[],
      "actions":[{"texte":"Soudure","qui":"Karim","quand":"jeudi","citations":["s3"]},
                 {"texte":"Sans source","qui":null,"quand":"","citations":[]},
                 {"texte":"","citations":["s1"]}]}`,
    SEGMENTS,
  );
  assert(r !== null);
  assertEquals(r.version, 1);
  assertEquals(r.points_cles, [{ texte: 'PTO posée, client d’accord', citations: ['s2'] }]);
  assertEquals(r.decisions, []);
  assertEquals(r.actions, [
    { texte: 'Soudure', qui: 'Karim', quand: 'jeudi', citations: ['s3'] },
    { texte: 'Sans source', qui: null, quand: null, citations: [] },
  ]);
});

Deno.test('lecture : ce qui n’a pas la forme attendue est refusé (null)', () => {
  assertEquals(lireResume('## Points clés\n- PTO posée', SEGMENTS), null);
  assertEquals(lireResume('{"points_cles":"tout"}', SEGMENTS), null);
  assertEquals(lireResume('{"points_cles":[],"decisions":[]}', SEGMENTS), null); // actions manquantes
  assertEquals(lireResume('{"points_cles":[],"decisions":[],"actions":[]}', SEGMENTS), {
    version: 1,
    points_cles: [],
    decisions: [],
    actions: [],
  });
});

Deno.test('lecture : le nombre d’éléments est borné', () => {
  const beaucoup = JSON.stringify({
    points_cles: Array.from({ length: 40 }, (_, i) => ({
      texte: `p${String(i)}`,
      citations: ['s1'],
    })),
    decisions: [],
    actions: [],
  });
  const r = lireResume(beaucoup, SEGMENTS);
  assertEquals(r?.points_cles.length, RESUME_MAX_ELEMENTS);
});

Deno.test('markdown : dérivé du JSON, sections vides omises, citations en § de paragraphe', () => {
  const md = resumeEnMarkdown({
    version: 1,
    points_cles: [{ texte: 'PTO posée au salon', citations: ['s2'] }],
    decisions: [],
    actions: [
      { texte: 'Soudure', qui: 'Karim', quand: 'jeudi', citations: ['s3', 's1'] },
      { texte: 'Rappeler le client', qui: null, quand: null, citations: [] },
    ],
  });
  assertEquals(
    md,
    '## Points clés\n- PTO posée au salon [§2]\n\n## Actions\n- Soudure — Karim (jeudi) [§3, §1]\n- Rappeler le client',
  );
  assertEquals(
    resumeEnMarkdown({ version: 1, points_cles: [], decisions: [], actions: [] }),
    "- Rien d'exploitable dans cet enregistrement.",
  );
});
