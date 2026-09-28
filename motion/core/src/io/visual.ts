import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { AssetDefinition, AssetRegistry } from '../contracts/asset.ts';
import type { CreativeStyleProfile } from '../contracts/style-profile.ts';
import { sha256Hex } from '../integrity/canonical.ts';
import { createHarfBuzzShaper } from '../text/harfbuzz.ts';
import type { TextShaper } from '../text/shaper.ts';
import { ValidationFailure } from '../validation/issues.ts';
import { analysisFingerprint, analyzeImage, AnalysisError, ANALYSIS_ALGORITHM_VERSION, AssetAnalysisSchema } from '../visual/analysis.ts';
import type { AssetAnalysis } from '../visual/analysis.ts';
import { validateAsset } from '../validation/validate.ts';
import { resolveResource } from './load.ts';
import type { LoadOptions } from './load.ts';

/** Dimensions lues dans l'en-tête du fichier (PNG ou JPEG) : jamais déclarées sur parole. */
export function imageDimensions(bytes: Uint8Array): { format: 'png' | 'jpeg'; width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 24 && png.every((b, i) => bytes[i] === b)) {
    return { format: 'png', width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) throw new Error('JPEG : marqueur attendu');
      const marker = bytes[offset + 1]!;
      const length = view.getUint16(offset + 2);
      // SOF0…SOF15, hors DHT (C4), JPG (C8) et DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { format: 'jpeg', height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      }
      offset += 2 + length;
    }
    throw new Error('JPEG : aucune trame SOF');
  }
  throw new Error('format d’image non pris en charge (PNG ou JPEG attendu)');
}

export interface LoadedAsset {
  definition: AssetDefinition;
  /** Chemin du fichier image résolu. */
  file: string;
}

/**
 * Lit une définition d'asset et vérifie son image : empreinte, format et
 * dimensions réelles doivent correspondre à ce que la définition déclare.
 */
export function loadAssetFile(file: string, options: LoadOptions = {}): LoadedAsset {
  const result = validateAsset(JSON.parse(readFileSync(file, 'utf8')));
  if (!result.ok) throw new ValidationFailure(`asset ${file}`, result.issues);
  const asset = result.value;
  const imageFile = resolveResource(asset.file, path.dirname(file), options);
  const bytes = readFileSync(imageFile);
  const problems: string[] = [];
  if (sha256Hex(bytes) !== asset.sha256) problems.push('empreinte différente du fichier');
  const dims = imageDimensions(bytes);
  if (dims.format !== asset.format) problems.push(`format ${dims.format}, déclaré ${asset.format}`);
  if (dims.width !== asset.width || dims.height !== asset.height) {
    problems.push(`dimensions ${dims.width}×${dims.height}, déclarées ${asset.width}×${asset.height}`);
  }
  if (problems.length > 0) throw new Error(`Asset ${asset.id} (${imageFile}) : ${problems.join(' ; ')}`);
  return { definition: asset, file: imageFile };
}

export interface AnalysisOptions {
  /**
   * Dossier du cache d'analyses, adressé par contenu (empreinte de l'asset +
   * version d'algorithme). Pure optimisation : avec ou sans cache, le document
   * est strictement identique ; une entrée invalide est recalculée.
   */
  cacheDir?: string;
}

export interface AnalysisResult {
  analysis: AssetAnalysis;
  /** « hit » : lu depuis le cache ; « miss » : calculé (et écrit si un cache est fourni). */
  cache: 'hit' | 'miss' | 'none';
}

/** Analyse des pixels d'un fichier image (P1.5), éventuellement via le cache. */
export function analyzeAssetFile(imageFile: string, expectedSha: string, options: AnalysisOptions = {}): AnalysisResult {
  const key = `${expectedSha}.${ANALYSIS_ALGORITHM_VERSION}.json`;
  const cached = options.cacheDir ? path.join(options.cacheDir, key) : null;
  if (cached && existsSync(cached)) {
    try {
      const entry = JSON.parse(readFileSync(cached, 'utf8')) as { fingerprint: string; analysis: unknown };
      const parsed = AssetAnalysisSchema.safeParse(entry.analysis);
      if (
        parsed.success &&
        parsed.data.asset_sha256 === expectedSha &&
        parsed.data.algorithm === ANALYSIS_ALGORITHM_VERSION &&
        analysisFingerprint(parsed.data) === entry.fingerprint
      ) {
        return { analysis: parsed.data, cache: 'hit' };
      }
    } catch {
      // Entrée illisible : recalcul, comme en l'absence de cache.
    }
  }
  const bytes = readFileSync(imageFile);
  if (sha256Hex(bytes) !== expectedSha) throw new AnalysisError('asset.sha_mismatch', `${imageFile} : empreinte différente de l'asset déclaré`);
  const analysis = analyzeImage(bytes);
  if (cached) {
    mkdirSync(path.dirname(cached), { recursive: true });
    writeFileSync(cached, JSON.stringify({ fingerprint: analysisFingerprint(analysis), analysis }));
  }
  return { analysis, cache: cached ? 'miss' : 'none' };
}

/** Tous les assets (`*.asset.json`) d'un ou plusieurs dossiers ; un identifiant en double est une erreur. */
export function loadAssetDirs(
  dirs: readonly string[],
  options: LoadOptions & AnalysisOptions = {},
): { registry: AssetRegistry; files: Map<string, string>; analyses: Map<string, AssetAnalysis>; cache: Map<string, AnalysisResult['cache']> } {
  const registry = new Map<string, AssetDefinition>();
  const files = new Map<string, string>();
  const analyses = new Map<string, AssetAnalysis>();
  const cache = new Map<string, AnalysisResult['cache']>();
  for (const dir of dirs) {
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.asset.json')).sort()) {
      const loaded = loadAssetFile(path.join(dir, name), options);
      if (registry.has(loaded.definition.id)) throw new Error(`Asset « ${loaded.definition.id} » déclaré deux fois`);
      registry.set(loaded.definition.id, loaded.definition);
      files.set(loaded.definition.id, loaded.file);
      const result = analyzeAssetFile(loaded.file, loaded.definition.sha256, options);
      analyses.set(loaded.definition.id, result.analysis);
      cache.set(loaded.definition.id, result.cache);
    }
  }
  return { registry, files, analyses, cache };
}

/**
 * Shaper HarfBuzz sur les polices d'un style : chaque fichier est lu depuis sa
 * référence et vérifié par empreinte avant toute mesure.
 */
export function createStyleShaper(style: CreativeStyleProfile, styleDir: string, options: LoadOptions = {}): TextShaper {
  const bytes = new Map<string, Uint8Array>();
  for (const family of Object.values(style.typography.families)) {
    for (const file of family.files) {
      const data = readFileSync(resolveResource(file.src, styleDir, options));
      if (sha256Hex(data) !== file.sha256) throw new Error(`Police ${file.src} : empreinte différente du style`);
      bytes.set(file.sha256, data);
    }
  }
  return createHarfBuzzShaper((sha) => {
    const data = bytes.get(sha);
    if (!data) throw new Error(`police ${sha} absente du style`);
    return data;
  });
}
