import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { BrandMotionProfile } from '../contracts/brand-profile.ts';
import { patternKey } from '../contracts/pattern.ts';
import type { PatternDefinition, PatternRegistry } from '../contracts/pattern.ts';
import type { PlatformPresets } from '../contracts/platform.ts';
import type { SeriesMotionProfile } from '../contracts/series-profile.ts';
import type { CreativeStyleProfile } from '../contracts/style-profile.ts';
import { hashDocument, sha256Hex } from '../integrity/canonical.ts';
import { LOCKED_KINDS, VersionLockSchema } from '../integrity/version-lock.ts';
import type { LockedKind, VersionedDocument, VersionLock } from '../integrity/version-lock.ts';
import { IssueCollector, ValidationFailure } from '../validation/issues.ts';
import type { ValidationResult } from '../validation/issues.ts';
import {
  validateBrandProfile,
  validatePattern,
  validatePlatformPresets,
  validateSeriesProfile,
  validateStyle,
} from '../validation/validate.ts';

/** Racines fournies par l'appelant : le cœur ne connaît aucun emplacement de données. */
export interface LoadOptions {
  /** Bibliothèque partagée (polices, sons…) visée par les références `lib:`. */
  libraryRoot?: string;
}

export function resolveResource(ref: string, packRoot: string, options: LoadOptions): string {
  const [scheme, ...rest] = ref.split(':');
  const relative = rest.join(':');
  if (scheme === 'pack') return path.join(packRoot, relative);
  if (scheme === 'lib') {
    if (!options.libraryRoot) throw new Error(`Référence « ${ref} » : aucune bibliothèque fournie.`);
    return path.join(options.libraryRoot, relative);
  }
  throw new Error(`Schéma de référence inconnu : « ${ref} ».`);
}

function readJsonFile(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function unwrap<T>(what: string, result: ValidationResult<T>): T {
  if (!result.ok) throw new ValidationFailure(what, result.issues);
  return result.value;
}

function verifyFiles(
  what: string,
  packRoot: string,
  options: LoadOptions,
  files: { src: string; sha256: string; path: string }[],
): void {
  const c = new IssueCollector();
  for (const entry of files) {
    let bytes: Buffer;
    try {
      bytes = readFileSync(resolveResource(entry.src, packRoot, options));
    } catch (error) {
      c.error('pack.missing_file', entry.path, `fichier « ${entry.src} » introuvable (${(error as Error).message})`);
      continue;
    }
    if (sha256Hex(bytes) !== entry.sha256) {
      c.error('pack.hash_mismatch', entry.path, `empreinte de « ${entry.src} » différente de celle déclarée`);
    }
  }
  if (c.issues.length > 0) throw new ValidationFailure(what, c.issues);
}

export function styleFiles(style: CreativeStyleProfile): { src: string; sha256: string; path: string }[] {
  const files: { src: string; sha256: string; path: string }[] = [];
  for (const [key, family] of Object.entries(style.typography.families)) {
    family.files.forEach((f, i) => files.push({ src: f.src, sha256: f.sha256, path: `typography.families.${key}.files[${i}]` }));
  }
  for (const [cue, def] of Object.entries(style.sound_personality.cues)) {
    if (def.src && def.sha256) files.push({ src: def.src, sha256: def.sha256, path: `sound_personality.cues.${cue}` });
  }
  return files;
}

/** Charge un style et vérifie l'empreinte de chaque fichier qu'il référence. */
export function loadStyleFile(file: string, options: LoadOptions = {}): CreativeStyleProfile {
  const style = unwrap(`Style ${file}`, validateStyle(readJsonFile(file)));
  verifyFiles(`Style ${file}`, path.dirname(file), options, styleFiles(style));
  return style;
}

export interface LoadedBrand {
  profile: BrandMotionProfile;
  style: CreativeStyleProfile;
}

export function loadBrandFile(file: string, options: LoadOptions = {}): LoadedBrand {
  const profile = unwrap(`Marque ${file}`, validateBrandProfile(readJsonFile(file)));
  const root = path.dirname(file);
  verifyFiles(
    `Marque ${file}`,
    root,
    options,
    profile.assets.approved.map((a, i) => ({ src: a.src, sha256: a.sha256, path: `assets.approved[${i}]` })),
  );
  return { profile, style: loadStyleFile(resolveResource(profile.style.src, root, options), options) };
}

export interface LoadedSeries {
  profile: SeriesMotionProfile;
  style: CreativeStyleProfile;
  brand: LoadedBrand | null;
}

export function loadSeriesFile(file: string, options: LoadOptions = {}): LoadedSeries {
  const profile = unwrap(`Série ${file}`, validateSeriesProfile(readJsonFile(file)));
  const root = path.dirname(file);
  return {
    profile,
    style: loadStyleFile(resolveResource(profile.style.src, root, options), options),
    brand: profile.brand ? loadBrandFile(resolveResource(profile.brand.src, root, options), options) : null,
  };
}

export function loadPlatformPresetsFile(file: string): PlatformPresets {
  return unwrap(`Presets de plateforme ${file}`, validatePlatformPresets(readJsonFile(file)));
}

/** Charge tous les patterns d'un ou plusieurs dossiers, dans un ordre déterministe. */
export function loadPatternPacks(...dirs: string[]): PatternRegistry {
  const registry = new Map<string, PatternDefinition>();
  for (const dir of dirs) {
    const files = readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .sort();
    for (const name of files) {
      const file = path.join(dir, name);
      const pattern = unwrap(`Pattern ${file}`, validatePattern(readJsonFile(file)));
      const key = patternKey(pattern.id, pattern.version);
      if (registry.has(key)) throw new Error(`Pattern ${key} défini deux fois (${file}).`);
      registry.set(key, pattern);
    }
  }
  return registry;
}

/** Documents versionnés d'un ou plusieurs dossiers, pour le verrou de versions. */
export function collectVersionedDocuments(...files: string[]): VersionedDocument[] {
  return files.map((file) => {
    const doc = readJsonFile(file) as { schema: string; id: string; version: string };
    if (!(LOCKED_KINDS as readonly string[]).includes(doc.schema)) throw new Error(`${file} : type « ${doc.schema} » non verrouillable`);
    return { kind: doc.schema as LockedKind, id: doc.id, version: doc.version, sha256: hashDocument(doc), path: file };
  });
}

export function loadVersionLock(file: string): VersionLock {
  return VersionLockSchema.parse(readJsonFile(file));
}
