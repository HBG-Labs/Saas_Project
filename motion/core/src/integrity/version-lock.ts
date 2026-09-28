import { z } from 'zod';

import { IdSchema, SemVerSchema, Sha256Schema } from '../contracts/common.ts';
import { IssueCollector } from '../validation/issues.ts';
import type { ValidationIssue } from '../validation/issues.ts';

// VERSION = identité sémantique (ce que le document promet d'être).
// EMPREINTE = identité exacte du contenu.
// Le verrou relie les deux : une fois (id, version) publiée, son empreinte
// est figée. Changer le contenu impose une nouvelle version. Le verrou est
// un fichier du dépôt, en ajout seul : aucune base de données.

export const VERSION_LOCK_SCHEMA = 'version-lock';
export const VERSION_LOCK_VERSION = '0.1.0';

export const LOCKED_KINDS = ['creative-style-profile', 'brand-motion-profile', 'series-motion-profile', 'pattern-definition'] as const;
export type LockedKind = (typeof LOCKED_KINDS)[number];

const IdLike = z.union([IdSchema, z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/)]);

export const VersionLockSchema = z.strictObject({
  schema: z.literal(VERSION_LOCK_SCHEMA),
  schema_version: SemVerSchema,
  entries: z.array(z.strictObject({ kind: z.enum(LOCKED_KINDS), id: IdLike, version: SemVerSchema, sha256: Sha256Schema })),
});
export type VersionLock = z.infer<typeof VersionLockSchema>;

export interface VersionedDocument {
  kind: LockedKind;
  id: string;
  version: string;
  sha256: string;
  /** Emplacement, pour les messages. */
  path: string;
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i]! - pb[i]!;
  return 0;
}

const prefixOf = (kind: LockedKind) => (kind === 'pattern-definition' ? 'pattern' : 'style');

/**
 * Compare les documents actuels au verrou :
 * - même (id, version), contenu différent → `<famille>.version_not_bumped` ;
 * - version inférieure ou égale à une version déjà verrouillée → `<famille>.version_regressed` ;
 * - nouvelle version absente du verrou → `version.unlocked` (enregistrer avant de livrer).
 */
export function checkVersionLock(documents: readonly VersionedDocument[], lock: VersionLock): ValidationIssue[] {
  const c = new IssueCollector();
  for (const doc of documents) {
    const history = lock.entries.filter((e) => e.kind === doc.kind && e.id === doc.id);
    const same = history.find((e) => e.version === doc.version);
    if (same) {
      if (same.sha256 !== doc.sha256) {
        c.error(
          `${prefixOf(doc.kind)}.version_not_bumped`,
          doc.path,
          `${doc.id}@${doc.version} a changé de contenu sans changer de version (empreinte verrouillée ${same.sha256.slice(0, 12)}…, actuelle ${doc.sha256.slice(0, 12)}…)`,
        );
      }
      continue;
    }
    const newest = history.map((e) => e.version).sort(compareSemver).pop();
    if (newest && compareSemver(doc.version, newest) <= 0) {
      c.error(`${prefixOf(doc.kind)}.version_regressed`, doc.path, `${doc.id}@${doc.version} n'est pas postérieure à la version verrouillée ${newest}`);
      continue;
    }
    c.error('version.unlocked', doc.path, `${doc.id}@${doc.version} n'est pas encore enregistrée dans le verrou de versions`);
  }
  return c.issues;
}

/** Ajoute les nouvelles versions au verrou ; refuse toute réécriture d'une version existante. */
export function appendToLock(documents: readonly VersionedDocument[], lock: VersionLock): { lock: VersionLock; issues: ValidationIssue[] } {
  const issues = checkVersionLock(documents, lock).filter((i) => i.code !== 'version.unlocked');
  if (issues.length > 0) return { lock, issues };
  const entries = [...lock.entries];
  for (const doc of documents) {
    if (!entries.some((e) => e.kind === doc.kind && e.id === doc.id && e.version === doc.version)) {
      entries.push({ kind: doc.kind, id: doc.id, version: doc.version, sha256: doc.sha256 });
    }
  }
  entries.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id) || compareSemver(a.version, b.version));
  return { lock: { ...lock, entries }, issues: [] };
}
