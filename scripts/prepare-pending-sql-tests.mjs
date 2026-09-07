/**
 * Rejoue les suites de `supabase/tests/` AVANT que les migrations en attente
 * soient poussées.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE SCRIPT EXISTE
 *
 * `npm run test:sql` teste la base telle qu'elle est. C'est le bon test — mais
 * il ne peut rien dire d'une migration pas encore appliquée, alors que c'est
 * précisément le moment où l'on voudrait savoir. Les migrations sont
 * immuables une fois poussées : ce qui n'a pas été éprouvé avant ne peut plus
 * être corrigé qu'en en écrivant une autre.
 *
 * Chaque suite est donc réécrite avec les migrations en attente insérées juste
 * après son `begin;`. Le `rollback` final est conservé : rien n'atteint la base.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Le scénario multi-tenant reçoit en plus la fixture de la bibliothèque
 * documentaire, injectée AVANT le `rollback` — et non avant le marqueur final,
 * qui dans ce fichier-là le SUIT délibérément (sa seule présence prouve que
 * l'exécution a atteint la fin). S'accrocher au marqueur, comme le fait
 * `prepare-transmission-tests.mjs` sur `06_invoicing_scenario.sql`, aurait écrit
 * les documents de test hors transaction, donc pour de bon.
 *
 *     node scripts/prepare-pending-sql-tests.mjs
 *     npx supabase db query --linked --file test-results/pending/01_multitenant_scenario.sql
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TESTS_DIR = 'supabase/tests';
const SORTIE = 'test-results/pending';

// Les migrations en attente, dans l'ordre où `db push` les appliquera.
// Y RETIRER CE QUI VIENT D'ÊTRE POUSSÉ.
//
// Une migration déjà appliquée réinjectée ici échoue sur son premier
// `create table` — « relation déjà existante » — et la suite entière s'arrête.
// La liste décrit ce qui n'est PAS encore en base, pas l'historique.
const MIGRATIONS_EN_ATTENTE = [];

// Fixtures à injecter dans une suite donnée.
const FIXTURES = {
  '01_multitenant_scenario.sql': ['supabase/tests/fixtures/documents-isolation.sql'],
};

const migrations = MIGRATIONS_EN_ATTENTE.map((c) => readFileSync(c, 'utf8')).join('\n');

mkdirSync(SORTIE, { recursive: true });

const suites = readdirSync(TESTS_DIR)
  .filter((nom) => nom.endsWith('.sql'))
  .sort();

for (const suite of suites) {
  const scenario = readFileSync(join(TESTS_DIR, suite), 'utf8');

  const rollback = '\nrollback;';
  if (scenario.split(rollback).length !== 2) {
    throw new Error(`${suite} : un ROLLBACK et un seul est attendu.`);
  }
  if (!scenario.includes('begin;')) {
    throw new Error(`${suite} : aucun BEGIN trouvé.`);
  }

  const fixtures = (FIXTURES[suite] ?? []).map((c) => readFileSync(c, 'utf8')).join('\n');

  const prepare = scenario
    .replace(rollback, () => `\n${fixtures}${rollback}`)
    .replace('begin;', () => `begin;\n${migrations}`);

  writeFileSync(join(SORTIE, suite), prepare);
}

console.log(
  `${suites.length} suite(s) préparées dans ${SORTIE}/ avec ${MIGRATIONS_EN_ATTENTE.length} migration(s) en attente ; toutes se terminent par ROLLBACK.`,
);
