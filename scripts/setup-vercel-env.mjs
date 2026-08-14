/**
 * Dépose les variables d'environnement du frontend dans Vercel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN SCRIPT PLUTÔT QUE L'INTERFACE
 *
 * Neuf saisies à la main — trois variables × trois environnements — dont deux
 * clés de quarante caractères à recopier sans faute. Une coquille produit
 * exactement le même écran qu'une variable absente, et on cherche alors du
 * mauvais côté.
 *
 * Les valeurs sont lues depuis `.env.local`, c'est-à-dire celles qui font
 * tourner l'application sur ce poste. Si elle fonctionne ici, elle fonctionnera
 * là-bas.
 *
 * `VITE_APP_ENV` fait exception : il vaut `development` en local et doit valoir
 * `production` en production, `staging` en prévisualisation. Le script le
 * substitue.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PRÉALABLES, à faire une fois :
 *
 *   npx vercel login    ouvre le navigateur
 *   npx vercel link     rattache ce dossier à un projet Vercel (ou le crée)
 *
 * Puis :
 *
 *   node scripts/setup-vercel-env.mjs            dépose les variables
 *   node scripts/setup-vercel-env.mjs --dry-run  montre sans rien envoyer
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const DRY_RUN = process.argv.includes('--dry-run');

/** `VITE_APP_ENV` prend une valeur différente selon la cible. */
const APP_ENV_BY_TARGET = {
  production: 'production',
  preview: 'staging',
  development: 'development',
};

const TARGETS = Object.keys(APP_ENV_BY_TARGET);
const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_APP_ENV'];

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!existsSync('.env.local')) {
  fail('`.env.local` est introuvable : il fournit les valeurs à déposer.');
}

if (!existsSync('.vercel/project.json')) {
  fail(
    'Ce dossier n’est rattaché à aucun projet Vercel.\n\n' +
      '  npx vercel login\n' +
      '  npx vercel link\n\n' +
      '`vercel link` propose de créer le projet s’il n’existe pas encore — c’est\n' +
      'sans doute pourquoi vous ne trouviez pas l’onglet des variables : il\n' +
      'n’apparaît qu’une fois le projet créé.',
  );
}

const local = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [
        line.slice(0, at).trim(),
        line
          .slice(at + 1)
          .trim()
          .replace(/^["']|["']$/g, ''),
      ];
    }),
);

const missing = REQUIRED.filter((name) => (local[name] ?? '') === '');
if (missing.length > 0) {
  fail(`Valeurs absentes de .env.local : ${missing.join(', ')}`);
}

console.log(DRY_RUN ? '\nSimulation — rien ne sera envoyé.\n' : '\nDépôt des variables…\n');

for (const target of TARGETS) {
  for (const name of REQUIRED) {
    const value = name === 'VITE_APP_ENV' ? APP_ENV_BY_TARGET[target] : local[name];
    const shown = value.length > 24 ? `${value.slice(0, 24)}…` : value;

    console.log(`  ${target.padEnd(12)} ${name.padEnd(30)} ${shown}`);
    if (DRY_RUN) continue;

    // `vercel env add` lit la valeur sur l'entrée standard : la passer en
    // argument l'exposerait dans l'historique du shell.
    const result = spawnSync('npx', ['vercel', 'env', 'add', name, target], {
      input: value,
      encoding: 'utf8',
      shell: true,
    });

    // Une variable déjà présente fait échouer la commande. Ce n'est pas une
    // erreur : on la remplace, puisque l'intention est bien de la définir.
    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      if (/already exists/i.test(output)) {
        execFileSync('npx', ['vercel', 'env', 'rm', name, target, '--yes'], { shell: true });
        spawnSync('npx', ['vercel', 'env', 'add', name, target], {
          input: value,
          encoding: 'utf8',
          shell: true,
        });
        console.log(`  ${' '.repeat(12)} ${' '.repeat(30)} (remplacée)`);
      } else {
        fail(`Échec sur ${name} (${target}) :\n${output}`);
      }
    }
  }
}

if (DRY_RUN) {
  console.log('\nRelancez sans --dry-run pour déposer réellement.\n');
} else {
  console.log(
    '\nDéposées. Elles ne prendront effet qu’au PROCHAIN build : Vite les fige\n' +
      'à la compilation. Relancez un déploiement :\n\n' +
      '  npx vercel --prod\n',
  );
}
