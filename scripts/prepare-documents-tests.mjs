/**
 * Prépare le scénario SQL de cloisonnement de la bibliothèque documentaire.
 *
 * Même montage que `prepare-transmission-tests.mjs` : la fixture est injectée
 * dans le scénario multi-tenant juste avant son marqueur final, de sorte
 * qu'elle hérite des identités déjà créées (`a_owner`, `a_manager`, `a_tech1`,
 * `b_owner`, `b_tech`) et des aides `pg_temp.login` / `ok` / `refuses`. Le
 * scénario se termine par `rollback` : rien n'est laissé en base.
 *
 * Deux variantes sont produites, et ce n'est pas un luxe :
 *
 *   `...-before-migration.sql` inline la migration dans la transaction. C'est
 *   la seule exécutable tant que `db push` n'a pas été lancé — et c'est aussi
 *   celle qui prouve que la migration fait bien ce qu'elle annonce, puisque son
 *   propre bloc de vérification final s'exécute avec elle.
 *
 *   `...-after-migration.sql` suppose la migration appliquée. C'est la variante
 *   à rejouer ensuite, qui teste la base RÉELLE plutôt que le fichier.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const scenario = readFileSync('supabase/tests/01_multitenant_scenario.sql', 'utf8');
const migration = readFileSync(
  'supabase/migrations/20260906212227_organization_documents.sql',
  'utf8',
);
const tests = readFileSync('supabase/tests/fixtures/documents-isolation.sql', 'utf8');

const marker = "select 'TOUS LES TESTS PASSENT' as resultat;";
if (scenario.split(marker).length !== 2) {
  throw new Error('Le scénario doit contenir exactement un marqueur final.');
}
// ─────────────────────────────────────────────────────────────────────────────
// LA FIXTURE S'INSÈRE AVANT LE ROLLBACK, PAS AVANT LE MARQUEUR
//
// Dans `06_invoicing_scenario.sql`, le marqueur précède le `rollback` ; s'y
// accrocher, comme le fait `prepare-transmission-tests.mjs`, place bien les
// tests DANS la transaction. Dans `01_multitenant_scenario.sql`, il le SUIT
// délibérément — sa seule présence prouve que l'exécution a atteint la fin du
// fichier. Reprendre le même point d'ancrage ici aurait donc écrit les
// documents de test HORS transaction, donc pour de bon, dans la base liée.
//
// L'ancre est le `rollback`, dont on vérifie qu'il est unique.
// ─────────────────────────────────────────────────────────────────────────────
const rollback = '\nrollback;';
if (scenario.split(rollback).length !== 2) {
  throw new Error('Le scénario doit contenir exactement un ROLLBACK.');
}

mkdirSync('test-results', { recursive: true });

const withTests = scenario.replace(rollback, () => `\n${tests}${rollback}`);

writeFileSync(
  'test-results/documents-isolation-before-migration.sql',
  withTests.replace('begin;', () => `begin;\n${migration}`),
);
writeFileSync('test-results/documents-isolation-after-migration.sql', withTests);

console.log(
  'Scénarios de cloisonnement documentaire préparés dans test-results/ ; les deux se terminent par ROLLBACK.',
);
