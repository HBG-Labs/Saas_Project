/**
 * Garde-fou de poids sur le build réellement livré.
 *
 * Les seuils portent sur le gzip, plus proche du coût réseau que le poids brut.
 * Ils laissent une marge courte au build Atelier du 22/09/2026, après ajout
 * volontaire de l'éditeur riche Workspace. Le moteur est isolé dans des
 * chunks différés et reste soumis au plafond individuel de 75 Kio gzip : une
 * nouvelle dépendance lourde ou un retour à un gros bundle commun doit donc
 * toujours être décidé, pas absorbé silencieusement.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const KIB = 1024;
const assetDirectory = resolve(process.argv[2] ?? 'dist/assets');
const manifestPath = resolve(assetDirectory, '../.vite/manifest.json');

const limits = {
  jsChunk: Number(process.env['BUNDLE_MAX_JS_CHUNK_GZIP_KIB'] ?? 75) * KIB,
  cssChunk: Number(process.env['BUNDLE_MAX_CSS_CHUNK_GZIP_KIB'] ?? 45) * KIB,
  jsTotal: Number(process.env['BUNDLE_MAX_JS_TOTAL_GZIP_KIB'] ?? 1150) * KIB,
  cssTotal: Number(process.env['BUNDLE_MAX_CSS_TOTAL_GZIP_KIB'] ?? 50) * KIB,
  startupJs: Number(process.env['BUNDLE_MAX_STARTUP_JS_GZIP_KIB'] ?? 520) * KIB,
  startupRequests: Number(process.env['BUNDLE_MAX_STARTUP_JS_REQUESTS'] ?? 68),
};

if (!existsSync(assetDirectory)) {
  console.error(`Build absent : « ${assetDirectory} » n’existe pas. Lancez d’abord npm run build.`);
  process.exit(1);
}

const assets = readdirSync(assetDirectory)
  .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
  .map((name) => ({
    name,
    type: name.endsWith('.js') ? 'js' : 'css',
    gzipBytes: gzipSync(readFileSync(resolve(assetDirectory, name))).byteLength,
  }));

const js = assets.filter((asset) => asset.type === 'js');
const css = assets.filter((asset) => asset.type === 'css');
const total = (items) => items.reduce((sum, item) => sum + item.gzipBytes, 0);
const largest = (items) => [...items].sort((a, b) => b.gzipBytes - a.gzipBytes)[0];
const kib = (bytes) => `${(bytes / KIB).toFixed(1)} Kio gzip`;

function readStartupGraph() {
  if (!existsSync(manifestPath)) {
    return null;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entry = Object.entries(manifest).find(([, value]) => value.isEntry === true);
  if (!entry) return null;

  const visited = new Set();
  const visitStaticImports = (key) => {
    if (visited.has(key) || !manifest[key]) return;
    visited.add(key);
    for (const importedKey of manifest[key].imports ?? []) visitStaticImports(importedKey);
  };

  const [entryKey, entryValue] = entry;
  visitStaticImports(entryKey);

  // `main.tsx` attend ces imports dans son Promise.all de boot. Les imports
  // dynamiques découverts plus bas (routes, palette, outils) restent différés
  // et ne doivent surtout pas être comptés dans le premier affichage.
  for (const importedKey of entryValue.dynamicImports ?? []) visitStaticImports(importedKey);

  const files = [...visited]
    .map((key) => manifest[key]?.file)
    .filter((file) => typeof file === 'string' && file.endsWith('.js'));
  const startupAssets = files.map((file) => ({
    name: file,
    gzipBytes: gzipSync(readFileSync(resolve(assetDirectory, '..', file))).byteLength,
  }));

  return {
    assets: startupAssets,
    gzipBytes: total(startupAssets),
  };
}

const problems = [];
for (const asset of js) {
  if (asset.gzipBytes > limits.jsChunk) {
    problems.push(`${asset.name} pèse ${kib(asset.gzipBytes)} (budget ${kib(limits.jsChunk)})`);
  }
}
for (const asset of css) {
  if (asset.gzipBytes > limits.cssChunk) {
    problems.push(`${asset.name} pèse ${kib(asset.gzipBytes)} (budget ${kib(limits.cssChunk)})`);
  }
}

const jsTotal = total(js);
const cssTotal = total(css);
const startup = readStartupGraph();
if (jsTotal > limits.jsTotal) {
  problems.push(`le JavaScript cumulé pèse ${kib(jsTotal)} (budget ${kib(limits.jsTotal)})`);
}
if (cssTotal > limits.cssTotal) {
  problems.push(`le CSS cumulé pèse ${kib(cssTotal)} (budget ${kib(limits.cssTotal)})`);
}
if (startup && startup.gzipBytes > limits.startupJs) {
  problems.push(
    `le JavaScript de démarrage pèse ${kib(startup.gzipBytes)} (budget ${kib(limits.startupJs)})`,
  );
}
if (startup && startup.assets.length > limits.startupRequests) {
  problems.push(
    `le démarrage nécessite ${String(startup.assets.length)} fichiers JS (budget ${String(limits.startupRequests)})`,
  );
}

if (problems.length > 0) {
  console.error('\nBudget de bundle dépassé :\n');
  for (const problem of problems) console.error(`  • ${problem}`);
  console.error('');
  process.exit(1);
}

const largestJs = largest(js);
const largestCss = largest(css);
console.log(
  [
    `Bundle dans le budget — ${String(js.length)} chunks JS, ${String(css.length)} feuilles CSS.`,
    startup
      ? `Démarrage : ${kib(startup.gzipBytes)} en ${String(startup.assets.length)} requêtes JS.`
      : `Démarrage : manifeste absent, contrôle du chemin critique ignoré.`,
    `JS cumulé : ${kib(jsTotal)} ; plus gros chunk : ${largestJs?.name ?? '—'} (${kib(largestJs?.gzipBytes ?? 0)}).`,
    `CSS cumulé : ${kib(cssTotal)} ; plus grosse feuille : ${largestCss?.name ?? '—'} (${kib(largestCss?.gzipBytes ?? 0)}).`,
  ].join('\n'),
);
