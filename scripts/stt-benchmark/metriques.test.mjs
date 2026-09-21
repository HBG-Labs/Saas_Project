import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  mesurer,
  nombresDe,
  nomsPropresDe,
  referencesDe,
  scorePonctuation,
  termeReconnu,
  wer,
} from './metriques.mjs';
import { MOTEURS, construirePrompt } from './moteurs.mjs';
import { construireRapport } from './rapport.mjs';

/*
  Les mesures sont la partie du benchmark qui peut mentir en silence : un WER
  mal compté départagerait les moteurs sur rien. Cas vérifiés à la main.
*/

test('WER : identique = 0, vide = 1, substitution/insertion/suppression comptées', () => {
  assert.equal(wer('on pose le boîtier jeudi', 'On pose le boîtier jeudi.').wer, 0);
  assert.equal(wer('on pose le boîtier', '').wer, 1);
  const s = wer('on pose le boîtier jeudi', 'on pause le boîtier jeudi');
  assert.deepEqual([s.substitutions, s.insertions, s.suppressions], [1, 0, 0]);
  assert.equal(s.wer, 0.2);
  const i = wer('on pose le boîtier', 'on pose bien le boîtier');
  assert.deepEqual([i.substitutions, i.insertions, i.suppressions], [0, 1, 0]);
  const d = wer('on pose le boîtier jeudi', 'on pose le boîtier');
  assert.deepEqual([d.substitutions, d.insertions, d.suppressions], [0, 0, 1]);
});

test('un terme est reconnu comme suite de mots entière, collé ou séparé', () => {
  assert.equal(termeReconnu('36FO', 'nous avons passé un 36 FO'), true);
  assert.equal(termeReconnu('36 FO', 'un 36FO et un 12FO'), true);
  assert.equal(termeReconnu('PTO', 'la pto est posée'), true);
  assert.equal(termeReconnu('PTO', 'le photo est posé'), false);
  assert.equal(termeReconnu('NF C 15-100', 'selon la norme nf c 15-100'), true);
  assert.equal(termeReconnu('soudure fibre', 'la soudure de la fibre'), false);
});

test('nombres, références et noms propres sont extraits de la référence', () => {
  const ref =
    'Chez Caraïbe Télécom au Lorrain, on a passé un 36FO et un 12FO pour 1250 euros, norme NF C 15-100. Karim revient jeudi.';
  assert.deepEqual(nombresDe(ref), ['36', '12', '1250', '15', '100']);
  assert.ok(referencesDe(ref).includes('36FO'));
  assert.ok(referencesDe(ref).includes('12FO'));
  assert.ok(referencesDe(ref).includes('15-100'));
  const noms = nomsPropresDe(ref);
  assert.ok(noms.includes('Caraïbe'));
  assert.ok(noms.includes('Lorrain'));
  assert.ok(!noms.includes('Chez'), "un début de phrase n'est pas un nom propre");
  assert.ok(
    !noms.includes('Karim'),
    "l'heuristique rate un nom en début de phrase — d'où le .meta.json",
  );
});

test('ponctuation : même densité = 1, absence = 0', () => {
  assert.equal(scorePonctuation('A. B. C.', 'a. b. c.'), 1);
  assert.equal(scorePonctuation('A. B. C.', 'a b c'), 0);
  assert.equal(scorePonctuation('a b c', 'a b c'), 1);
});

test('mesurer rassemble tout, avec les attendus fournis ou déduits', () => {
  const m = mesurer({
    reference: 'On a passé un 36FO chez Caraïbe Télécom pour 1250 euros.',
    hypothese: 'On a passé un 36 FO chez caraïbe télécom pour 1250 euros.',
    termes: ['36FO', 'PTO'],
    noms: ['Caraïbe Télécom'],
  });
  // 11 mots de référence ; « 36fo » ≠ « 36 » (substitution) puis « fo » en trop (insertion) → 2/11.
  assert.equal(m.reference_mots, 11);
  assert.equal(m.erreurs, 2);
  assert.ok(Math.abs(m.wer - 2 / 11) < 1e-9);
  assert.deepEqual(m.termes, { attendus: 2, reconnus: 1, manques: ['PTO'], rappel: 0.5 });
  assert.equal(m.noms.rappel, 1);
  assert.equal(m.nombres.rappel, 1);
  assert.equal(m.references.rappel, 1);
});

test('le prompt reste une phrase courte ; les moteurs à glossaire sont les seuls à le recevoir', () => {
  const p = construirePrompt(['PTO', 'PBO', 'PTO', '']);
  assert.ok(p.includes('PTO, PBO'));
  assert.equal(construirePrompt([]), undefined);
  assert.equal(MOTEURS.actuel.champs({ prompt: p }).prompt, undefined);
  assert.equal(MOTEURS['gpt-transcribe+glossaire'].champs({ prompt: p }).prompt, p);
  assert.equal(
    MOTEURS.diarize.champs({ prompt: p }).prompt,
    undefined,
    'la diarisation ne prend pas de prompt',
  );
  assert.deepEqual(MOTEURS['gpt-transcribe'].champs({}).languages, ['fr']);
  assert.equal(
    MOTEURS['gpt-transcribe'].champs({}).language,
    undefined,
    'languages remplace language, jamais les deux',
  );
});

test("le rapport range, compare à l'actuel et signale les régressions", () => {
  const mesure = (w, reconnus) => ({
    wer: w,
    substitutions: 1,
    insertions: 0,
    suppressions: 0,
    erreurs: 1,
    reference_mots: 10,
    hypothese_mots: 10,
    termes: { attendus: 2, reconnus, manques: reconnus === 2 ? [] : ['PTO'], rappel: reconnus / 2 },
    noms: { attendus: 0, reconnus: 0, manques: [], rappel: null },
    nombres: { attendus: 1, reconnus: 1, manques: [], rappel: 1 },
    references: { attendus: 0, reconnus: 0, manques: [], rappel: null },
    ponctuation: 1,
  });
  const ligne = (clip, moteur, w, reconnus) => ({
    clip,
    moteur,
    modele: moteur,
    glossaire: false,
    latence_ms: 500,
    cout_usd: 0.01,
    erreur: null,
    mesures: mesure(w, reconnus),
  });
  const rapport = construireRapport({
    resultats: [
      ligne('a', 'actuel', 0.2, 1),
      ligne('a', 'gpt-transcribe', 0.1, 2),
      ligne('b', 'actuel', 0.1, 2),
      ligne('b', 'gpt-transcribe', 0.3, 1),
      {
        clip: 'b',
        moteur: 'diarize',
        modele: 'x',
        glossaire: false,
        latence_ms: null,
        cout_usd: null,
        erreur: 'REFUS HTTP 404',
      },
    ],
    moteurReference: 'actuel',
    libelles: { actuel: 'Actuel', 'gpt-transcribe': 'GT' },
  });
  assert.match(rapport, /\| GT \| 1 \| 0 \| 1 \| 50\.0 % \|/);
  assert.match(rapport, /\| GT \| b \| 10\.0 % → 30\.0 % \| 2\/2 → 1\/2 \| PTO \|/);
  assert.match(rapport, /REFUS HTTP 404/);
  assert.match(rapport, /WER médian/);
});
