/**
 * Le paquet envoyé à l'hébergeur contient-il tout ce dont le build a besoin ?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT QU'ON CHERCHE
 *
 * `npm run build` exécute `tsc -b`, qui construit les deux projets référencés
 * par `tsconfig.json`. Ces projets déclarent leurs fichiers par `include` :
 * `src`, mais aussi `vite.config.ts`, `playwright.config.ts`, `e2e`. Et
 * plusieurs fichiers importent des ressources par `?raw` — les migrations SQL,
 * `index.html` — que TypeScript type sans les lire.
 *
 * `.vercelignore` retire des fichiers du transfert. Si les deux ensembles se
 * chevauchent, le build échoue — mais seulement chez l'hébergeur, où le fichier
 * n'existe pas. En local il est là, tout passe, et la panne se découvre au pire
 * moment.
 *
 * Ce contrôle rapproche les deux listes avant le déploiement. Il ne remplace
 * pas un déploiement de PRÉVISUALISATION, qui reste la seule preuve complète —
 * il attrape la faute la plus courante en une seconde plutôt qu'en trois
 * minutes.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   node scripts/check-deploy-package.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const NEWLINE = /\r?\n/;

/** Motifs de `.vercelignore`, normalisés. */
function readIgnorePatterns() {
  return readFileSync('.vercelignore', 'utf8')
    .split(NEWLINE)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

/**
 * Un chemin est-il écarté par un motif ?
 *
 * On implémente le strict nécessaire de la syntaxe employée dans ce dépôt :
 * préfixe de dossier, ancrage à la racine, joker d'extension. Réimplémenter la
 * spécification complète de `.gitignore` serait à la fois inutile ici et une
 * source d'erreurs bien à elle.
 */
function isIgnored(path, patterns) {
  return patterns.some((pattern) => {
    if (pattern.endsWith('/')) return path.startsWith(pattern);
    if (pattern.startsWith('/*.')) {
      return !path.includes('/') && path.endsWith(pattern.slice(2));
    }
    if (pattern.startsWith('*.')) return path.endsWith(pattern.slice(1));
    return path === pattern || path.startsWith(`${pattern}/`);
  });
}

/** Fichiers réellement transférés : versionnés, moins les motifs ignorés. */
function deployedFiles(patterns) {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split(NEWLINE)
    .filter((line) => line !== '');

  return new Set(tracked.filter((path) => !isIgnored(path, patterns)));
}

/**
 * Fichiers que le build lit, d'après TypeScript lui-même.
 *
 * `tsc --showConfig` résout les `include`, les jokers et les références : sa
 * liste `files` est exactement celle que `tsc -b` compilera. La déduire
 * nous-mêmes demanderait un lecteur de JSON commenté et un résolveur de globs —
 * deux occasions de se tromper sur une question dont l'outil connaît déjà la
 * réponse.
 */
function typescriptInputs() {
  const projects = ['tsconfig.app.json', 'tsconfig.node.json'];
  const inputs = new Set(['tsconfig.json', ...projects]);

  for (const project of projects) {
    // Le binaire est appelé par Node directement, sans passer par un shell :
    // `npx` aurait exigé `shell: true` sous Windows, ce que Node signale comme
    // une faiblesse — les arguments y sont concaténés plutôt qu'échappés.
    const raw = execFileSync(
      process.execPath,
      ['node_modules/typescript/bin/tsc', '-p', project, '--showConfig'],
      { encoding: 'utf8' },
    );

    for (const file of JSON.parse(raw).files ?? []) {
      const path = file.replace(/^\.\//, '');
      // `node_modules` n'est pas versionné : l'hébergeur le réinstalle.
      if (path.startsWith('node_modules/')) continue;
      inputs.add(path);
    }
  }

  return inputs;
}

/**
 * Ressources importées par `?raw` : migrations SQL, `index.html`.
 *
 * TypeScript les type par une déclaration générique sans jamais les ouvrir :
 * elles n'apparaissent donc pas dans sa liste, alors que Vite en a besoin. Ce
 * sont précisément les chemins qu'un `.vercelignore` trop large fait
 * disparaître sans bruit.
 */
function rawImports() {
  const found = new Set();

  const output = execFileSync('git', ['grep', '-h', '-o', '-E', "'[^']+[?]raw'", '--', 'src'], {
    encoding: 'utf8',
  });

  for (const line of output.split(NEWLINE)) {
    const match = /'([^']+)[?]raw'/.exec(line);
    if (match === null) continue;

    const specifier = match[1];
    if (specifier === undefined || !specifier.startsWith('.')) continue;

    // Tous les imports `?raw` du dépôt partent de `src/**` : on les résout
    // relativement à `src/`, en absorbant les remontées.
    const resolved = [];
    for (const segment of `src/${specifier}`.split('/')) {
      if (segment === '.') continue;
      if (segment === '..') resolved.pop();
      else resolved.push(segment);
    }
    found.add(resolved.join('/'));
  }

  return found;
}

const patterns = readIgnorePatterns();
const deployed = deployedFiles(patterns);
const problems = [];

for (const input of [...typescriptInputs(), ...rawImports()]) {
  if (deployed.has(input)) continue;

  problems.push(
    isIgnored(input, patterns)
      ? `« ${input} » est nécessaire au build mais exclu par .vercelignore`
      : `« ${input} » est nécessaire au build mais absent du paquet déployé`,
  );
}

// `index.html` est le point d'entrée de Vite : sans lui, il n'y a pas de build.
if (!deployed.has('index.html')) {
  problems.push('« index.html » est absent du paquet déployé');
}

// `installCommand: npm ci` échoue sans le verrou de dépendances.
if (!deployed.has('package-lock.json')) {
  problems.push('« package-lock.json » est absent : `npm ci` échouera chez l’hébergeur');
}

if (problems.length > 0) {
  console.error('\nPaquet de déploiement incohérent :\n');
  for (const problem of problems) console.error(`  • ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(`Paquet de déploiement cohérent — ${deployed.size} fichiers transférés.`);
