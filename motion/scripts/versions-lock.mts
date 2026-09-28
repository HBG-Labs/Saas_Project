// Verrou de versions des styles, marques, séries et patterns.
//   node scripts/versions-lock.mts --check   : échoue si un contenu a changé sans nouvelle version
//   node scripts/versions-lock.mts --write   : enregistre les NOUVELLES versions (refuse toute réécriture)
// Deux verrous : celui de l'espace de travail (exemples + packs) et celui des
// fixtures du cœur (qui doit rester autonome).
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { appendToLock, checkVersionLock, collectVersionedDocuments, formatIssues, loadVersionLock } from '../core/src/index.ts';
import type { VersionLock } from '../core/src/index.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv.includes('--write') ? 'write' : 'check';

const json = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => path.join(dir, n)) : []);
const scopes = [
  {
    lock: path.join(root, 'versions.lock.json'),
    files: [
      ...readdirSync(path.join(root, 'examples')).flatMap((ex) =>
        ['style.json', 'brand.json', 'series.json'].map((n) => path.join(root, 'examples', ex, n)).filter((f) => existsSync(f)),
      ),
      ...json(path.join(root, 'packs', 'patterns', 'generic')),
    ],
  },
  {
    lock: path.join(root, 'core', 'test-fixtures', 'versions.lock.json'),
    files: [...json(path.join(root, 'core', 'test-fixtures', 'profiles')), ...json(path.join(root, 'core', 'test-fixtures', 'patterns'))],
  },
];

let failed = false;
for (const scope of scopes) {
  const empty: VersionLock = { schema: 'version-lock', schema_version: '0.1.0', entries: [] };
  const lock = existsSync(scope.lock) ? loadVersionLock(scope.lock) : empty;
  const docs = collectVersionedDocuments(...scope.files).map((d) => ({ ...d, path: path.relative(root, d.path).replaceAll('\\', '/') }));
  if (mode === 'check') {
    const issues = checkVersionLock(docs, lock);
    console.log(`${path.relative(root, scope.lock)} : ${docs.length} documents, ${issues.length} problème(s)`);
    if (issues.length > 0) {
      console.log(formatIssues(issues));
      failed = true;
    }
  } else {
    const result = appendToLock(docs, lock);
    if (result.issues.length > 0) {
      console.log(formatIssues(result.issues));
      failed = true;
      continue;
    }
    writeFileSync(scope.lock, `${JSON.stringify(result.lock, null, 2)}\n`);
    console.log(`${path.relative(root, scope.lock)} : ${result.lock.entries.length} entrées`);
  }
}
if (failed) process.exitCode = 1;
