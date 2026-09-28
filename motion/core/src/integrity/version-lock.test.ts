import { readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectVersionedDocuments, loadVersionLock } from '../io/load.ts';
import { FIXTURES, PROFILES } from '../test-support.ts';
import { appendToLock, checkVersionLock } from './version-lock.ts';
import type { VersionedDocument, VersionLock } from './version-lock.ts';

const doc = (version: string, sha: string): VersionedDocument => ({ kind: 'creative-style-profile', id: 'demo_style', version, sha256: sha.repeat(64), path: 'demo.style.json' });
const lock = (...entries: [string, string][]): VersionLock => ({
  schema: 'version-lock',
  schema_version: '0.1.0',
  entries: entries.map(([version, sha]) => ({ kind: 'creative-style-profile', id: 'demo_style', version, sha256: sha.repeat(64) })),
});
const codesOf = (docs: VersionedDocument[], l: VersionLock) => checkVersionLock(docs, l).map((i) => i.code);

describe('politique de version des styles (verrou local, sans base)', () => {
  it('même id, même version, même contenu : accepté', () => {
    expect(codesOf([doc('1.0.0', 'a')], lock(['1.0.0', 'a']))).toEqual([]);
  });

  it('même id, même version, contenu différent : style.version_not_bumped', () => {
    expect(codesOf([doc('1.0.0', 'b')], lock(['1.0.0', 'a']))).toEqual(['style.version_not_bumped']);
  });

  it('nouvelle version non enregistrée : version.unlocked', () => {
    expect(codesOf([doc('1.1.0', 'b')], lock(['1.0.0', 'a']))).toEqual(['version.unlocked']);
  });

  it('version antérieure à une version verrouillée : style.version_regressed', () => {
    expect(codesOf([doc('0.9.0', 'c')], lock(['1.0.0', 'a']))).toEqual(['style.version_regressed']);
  });

  it('les patterns suivent la même règle, sous leur propre famille de codes', () => {
    const pattern: VersionedDocument = { kind: 'pattern-definition', id: 'statement.interrupt', version: '0.2.0', sha256: 'b'.repeat(64), path: 'p.json' };
    const l: VersionLock = { schema: 'version-lock', schema_version: '0.1.0', entries: [{ kind: 'pattern-definition', id: 'statement.interrupt', version: '0.2.0', sha256: 'a'.repeat(64) }] };
    expect(checkVersionLock([pattern], l).map((i) => i.code)).toEqual(['pattern.version_not_bumped']);
  });

  it('le verrou est en ajout seul : il ajoute une nouvelle version, refuse de réécrire une existante', () => {
    const added = appendToLock([doc('1.1.0', 'b')], lock(['1.0.0', 'a']));
    expect(added.issues).toEqual([]);
    expect(added.lock.entries.map((e) => e.version)).toEqual(['1.0.0', '1.1.0']);
    const rewrite = appendToLock([doc('1.0.0', 'b')], lock(['1.0.0', 'a']));
    expect(rewrite.issues.map((i) => i.code)).toEqual(['style.version_not_bumped']);
    expect(rewrite.lock.entries).toEqual(lock(['1.0.0', 'a']).entries);
  });

  it('les profils et patterns de test sont tous verrouillés et conformes', () => {
    const profiles = readdirSync(PROFILES).filter((f) => f.endsWith('.json')).map((f) => path.join(PROFILES, f));
    const patterns = readdirSync(path.join(FIXTURES, 'patterns')).filter((f) => f.endsWith('.json')).map((f) => path.join(FIXTURES, 'patterns', f));
    const issues = checkVersionLock(collectVersionedDocuments(...profiles, ...patterns), loadVersionLock(path.join(FIXTURES, 'versions.lock.json')));
    expect(issues.map((i) => `${i.code} ${i.message}`)).toEqual([]);
  });
});
