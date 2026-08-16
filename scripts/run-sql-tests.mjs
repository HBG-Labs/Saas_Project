#!/usr/bin/env node
/**
 * Exécute TOUTES les suites de `supabase/tests/` contre la base liée.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN SCRIPT PLUTÔT QU'UNE LIGNE DANS package.json
 *
 * `test:sql` ne pointait que sur `02_industries_scenario.sql`. Ajouter une
 * suite demandait donc de penser à modifier le script — et une suite qu'on
 * oublie de lancer ne vaut pas mieux qu'une suite qu'on n'a pas écrite. Le
 * dossier fait foi : tout fichier `.sql` qui s'y trouve est exécuté.
 *
 * Chaque suite se termine par `rollback` et ne laisse aucune donnée derrière
 * elle. Un échec interrompt tout et renvoie un code de sortie non nul.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const TESTS_DIR = 'supabase/tests';

const suites = readdirSync(TESTS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (suites.length === 0) {
  console.error(`Aucune suite trouvée dans ${TESTS_DIR}.`);
  process.exit(1);
}

let failed = 0;

for (const suite of suites) {
  process.stdout.write(`\n▶ ${suite}\n`);

  try {
    // `execSync` plutôt que `execFileSync(..., { shell: true })` : la seconde
    // forme concatène les arguments sans les échapper, ce que Node signale
    // désormais comme un risque. Les chemins ici sont des noms de fichiers du
    // dépôt, mais un avertissement qu'on apprend à ignorer finit par en
    // masquer un vrai.
    const output = execSync(
      `npx supabase db query --linked --file "${join(TESTS_DIR, suite)}"`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );

    if (output.includes('TOUS LES TESTS PASSENT')) {
      console.log('  ✓ toutes les assertions passent');
    } else {
      // Une suite qui se termine sans son marqueur final n'a pas fini : la
      // traiter comme un succès masquerait une interruption silencieuse.
      console.error("  ✗ la suite s'est terminée sans son marqueur final");
      console.error(output.slice(-600));
      failed += 1;
    }
  } catch (error) {
    const detail = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    const echec = /ECHEC[^"\\]*/.exec(detail);

    console.error(`  ✗ ${echec ? echec[0] : 'échec'}`);
    if (!echec) console.error(detail.slice(-600));
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${String(failed)} suite(s) en échec sur ${String(suites.length)}.`);
  process.exit(1);
}

console.log(`\n${String(suites.length)} suite(s) SQL au vert.`);
