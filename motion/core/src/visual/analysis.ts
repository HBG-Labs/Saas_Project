import { inflateSync } from 'node:zlib';

import jpeg from 'jpeg-js';
import { z } from 'zod';

import { SemVerSchema, Sha256Schema } from '../contracts/common.ts';
import { hashDocument, sha256Hex } from '../integrity/canonical.ts';

/**
 * P1.5 — Visual Integrity & Image Motion : analyse des pixels d'un asset.
 *
 * Calculée à l'import, fonction des SEULS octets du fichier et de la version
 * de l'algorithme : image décodée (PNG par zlib et défiltrage maison, JPEG par
 * jpeg-js épinglé), puis réduite en cellules carrées par moyenne ENTIÈRE,
 * prémultipliée par l'alpha. Aucun flottant dans la réduction : mêmes octets,
 * même version → document strictement identique, sur toute plateforme.
 *
 * Ce document ne dit rien du rendu final : le traitement du style, le
 * recadrage, le masque et le mouvement sont appliqués ensuite, au compilateur.
 */
export const ASSET_ANALYSIS_SCHEMA = 'asset-analysis';
export const ASSET_ANALYSIS_VERSION = '0.1.0';
/** Version de l'algorithme (décodage + réduction). La changer invalide toutes les analyses. */
export const ANALYSIS_ALGORITHM_VERSION = '1.0.0';
/** Décodeur JPEG épinglé (dépendance exacte du cœur, voir docs/dependances.md). */
export const JPEG_DECODER = 'jpeg-js@0.4.4';
/** Côté long de la grille d'analyse, en cellules. */
export const ANALYSIS_LONG_SIDE = 320;

export const AssetAnalysisSchema = z.strictObject({
  schema: z.literal(ASSET_ANALYSIS_SCHEMA),
  schema_version: SemVerSchema,
  algorithm: SemVerSchema,
  decoder: z.enum(['png-zlib', JPEG_DECODER]),
  asset_sha256: Sha256Schema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Côté d'une cellule, en pixels source. */
  cell: z.number().int().positive(),
  grid_w: z.number().int().positive(),
  grid_h: z.number().int().positive(),
  /** RGBA 8 bits prémultiplié par cellule, ligne par ligne, en base64. */
  rgba: z.string().min(1),
});
export type AssetAnalysis = z.infer<typeof AssetAnalysisSchema>;

export class AnalysisError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'AnalysisError';
    this.code = code;
  }
}

interface Decoded {
  width: number;
  height: number;
  /** RGBA 8 bits, non prémultiplié. */
  data: Uint8Array;
  decoder: AssetAnalysis['decoder'];
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** PNG 8 bits non entrelacé : gris, gris+alpha, RGB, RGBA, palette (tRNS compris). */
export function decodePng(bytes: Uint8Array): Decoded {
  if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) throw new AnalysisError('asset.analysis_format', 'signature PNG absente');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const kind = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (kind === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      depth = body[8]!;
      type = body[9]!;
      interlace = body[12]!;
    } else if (kind === 'PLTE') palette = body;
    else if (kind === 'tRNS') transparency = body;
    else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    offset += 12 + length;
  }
  if (depth !== 8) throw new AnalysisError('asset.analysis_unsupported', `PNG : profondeur ${depth} bits non prise en charge (8 attendus)`);
  if (interlace !== 0) throw new AnalysisError('asset.analysis_unsupported', 'PNG entrelacé non pris en charge');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (channels === undefined) throw new AnalysisError('asset.analysis_unsupported', `PNG : type de couleur ${type} non pris en charge`);
  if (type === 3 && !palette) throw new AnalysisError('asset.analysis_format', 'PNG à palette sans PLTE');

  const total = idat.reduce((s, c) => s + c.length, 0);
  const compressed = new Uint8Array(total);
  let at = 0;
  for (const chunk of idat) {
    compressed.set(chunk, at);
    at += chunk.length;
  }
  const raw = inflateSync(compressed);
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[src + x]!;
      const left = x >= channels ? pixels[dst + x - channels]! : 0;
      const up = y > 0 ? pixels[dst - stride + x]! : 0;
      const upLeft = y > 0 && x >= channels ? pixels[dst - stride + x - channels]! : 0;
      let out: number;
      switch (filter) {
        case 0:
          out = value;
          break;
        case 1:
          out = value + left;
          break;
        case 2:
          out = value + up;
          break;
        case 3:
          out = value + ((left + up) >> 1);
          break;
        case 4:
          out = value + paeth(left, up, upLeft);
          break;
        default:
          throw new AnalysisError('asset.analysis_format', `PNG : filtre ${filter} inconnu`);
      }
      pixels[dst + x] = out & 0xff;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    let r: number;
    let g: number;
    let b: number;
    let a = 255;
    if (type === 0 || type === 4) {
      r = g = b = pixels[p]!;
      if (type === 4) a = pixels[p + 1]!;
    } else if (type === 3) {
      const index = pixels[p]!;
      r = palette![index * 3]!;
      g = palette![index * 3 + 1]!;
      b = palette![index * 3 + 2]!;
      a = transparency && index < transparency.length ? transparency[index]! : 255;
    } else {
      r = pixels[p]!;
      g = pixels[p + 1]!;
      b = pixels[p + 2]!;
      if (type === 6) a = pixels[p + 3]!;
    }
    data.set([r, g, b, a], i * 4);
  }
  return { width, height, data, decoder: 'png-zlib' };
}

function decodeJpeg(bytes: Uint8Array): Decoded {
  try {
    const image = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, tolerantDecoding: false, maxMemoryUsageInMB: 1024 });
    return { width: image.width, height: image.height, data: image.data, decoder: JPEG_DECODER };
  } catch (error) {
    throw new AnalysisError('asset.analysis_format', `JPEG illisible : ${(error as Error).message}`);
  }
}

/** Analyse déterministe des octets d'une image (PNG ou JPEG). */
export function analyzeImage(bytes: Uint8Array): AssetAnalysis {
  const isPng = PNG_SIGNATURE.every((b, i) => bytes[i] === b);
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!isPng && !isJpeg) throw new AnalysisError('asset.analysis_format', 'format non pris en charge (PNG ou JPEG attendu)');
  const decoded = isPng ? decodePng(bytes) : decodeJpeg(bytes);
  const { width, height, data } = decoded;
  const cell = Math.max(1, Math.ceil(Math.max(width, height) / ANALYSIS_LONG_SIDE));
  const gw = Math.ceil(width / cell);
  const gh = Math.ceil(height / cell);
  const out = new Uint8Array(gw * gh * 4);
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = 0; cx < gw; cx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let y = cy * cell; y < Math.min(height, (cy + 1) * cell); y++) {
        for (let x = cx * cell; x < Math.min(width, (cx + 1) * cell); x++) {
          const p = (y * width + x) * 4;
          const alpha = data[p + 3]!;
          // Prémultiplication entière : canal × alpha, divisé une seule fois à la fin.
          r += data[p]! * alpha;
          g += data[p + 1]! * alpha;
          b += data[p + 2]! * alpha;
          a += alpha;
          n++;
        }
      }
      const q = (cy * gw + cx) * 4;
      const div = 255 * n;
      // Arrondi entier au plus proche : (s + d/2) div d.
      out[q] = Math.floor((r + div / 2) / div);
      out[q + 1] = Math.floor((g + div / 2) / div);
      out[q + 2] = Math.floor((b + div / 2) / div);
      out[q + 3] = Math.floor((a + n / 2) / n);
    }
  }
  return {
    schema: ASSET_ANALYSIS_SCHEMA,
    schema_version: ASSET_ANALYSIS_VERSION,
    algorithm: ANALYSIS_ALGORITHM_VERSION,
    decoder: decoded.decoder,
    asset_sha256: sha256Hex(bytes),
    width,
    height,
    cell,
    grid_w: gw,
    grid_h: gh,
    rgba: Buffer.from(out).toString('base64'),
  };
}

/** Empreinte d'une analyse (tracée dans le Render Plan). */
export const analysisFingerprint = (analysis: AssetAnalysis) => hashDocument(analysis);

/** Accès aux cellules décodées, mis en cache par document. */
const cells = new WeakMap<AssetAnalysis, Uint8Array>();
export function analysisCells(analysis: AssetAnalysis): Uint8Array {
  let data = cells.get(analysis);
  if (!data) {
    data = new Uint8Array(Buffer.from(analysis.rgba, 'base64'));
    if (data.length !== analysis.grid_w * analysis.grid_h * 4) throw new AnalysisError('asset.analysis_corrupt', 'taille des cellules incohérente');
    cells.set(analysis, data);
  }
  return data;
}

/** Couleur prémultipliée (0..1) au point source (px), cellule la plus proche par troncature. */
export function sampleAnalysis(analysis: AssetAnalysis, sx: number, sy: number): [number, number, number, number] {
  const data = analysisCells(analysis);
  const cx = Math.min(analysis.grid_w - 1, Math.max(0, Math.floor(sx / analysis.cell)));
  const cy = Math.min(analysis.grid_h - 1, Math.max(0, Math.floor(sy / analysis.cell)));
  const q = (cy * analysis.grid_w + cx) * 4;
  return [data[q]! / 255, data[q + 1]! / 255, data[q + 2]! / 255, data[q + 3]! / 255];
}
