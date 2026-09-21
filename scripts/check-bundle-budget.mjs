/**
 * Garde-fou de poids sur le build réellement livré.
 *
 * Les seuils portent sur le gzip, plus proche du coût réseau que le poids brut.
 * Ils laissent une marge courte au build Atelier du 20/09/2026 : une nouvelle
 * dépendance lourde ou un retour à un gros bundle commun doit donc être décidé,
 * pas absorbé silencieusement.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const KIB = 1024;
const assetDirectory = resolve(process.argv[2] ?? 'dist/assets');

const limits = {
  jsChunk: Number(process.env['BUNDLE_MAX_JS_CHUNK_GZIP_KIB'] ?? 75) * KIB,
  cssChunk: Number(process.env['BUNDLE_MAX_CSS_CHUNK_GZIP_KIB'] ?? 45) * KIB,
  jsTotal: Number(process.env['BUNDLE_MAX_JS_TOTAL_GZIP_KIB'] ?? 1100) * KIB,
  cssTotal: Number(process.env['BUNDLE_MAX_CSS_TOTAL_GZIP_KIB'] ?? 50) * KIB,
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
if (jsTotal > limits.jsTotal) {
  problems.push(`le JavaScript cumulé pèse ${kib(jsTotal)} (budget ${kib(limits.jsTotal)})`);
}
if (cssTotal > limits.cssTotal) {
  problems.push(`le CSS cumulé pèse ${kib(cssTotal)} (budget ${kib(limits.cssTotal)})`);
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
    `JS cumulé : ${kib(jsTotal)} ; plus gros chunk : ${largestJs?.name ?? '—'} (${kib(largestJs?.gzipBytes ?? 0)}).`,
    `CSS cumulé : ${kib(cssTotal)} ; plus grosse feuille : ${largestCss?.name ?? '—'} (${kib(largestCss?.gzipBytes ?? 0)}).`,
  ].join('\n'),
);
