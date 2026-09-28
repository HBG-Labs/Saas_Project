import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';

import { sha256Hex } from '../integrity/canonical.ts';
import { analyzeAssetFile } from '../io/visual.ts';
import { FIXTURES } from '../test-support.ts';
import { analysisCells, analysisFingerprint, analyzeImage, AnalysisError, ANALYSIS_ALGORITHM_VERSION, decodePng, JPEG_DECODER } from './analysis.ts';

const PNG_FILE = path.join(FIXTURES, 'assets', 'night_moon.png');
const JPEG_FILE = path.join(FIXTURES, 'assets', 'night_moon.jpg');
const png = new Uint8Array(readFileSync(PNG_FILE));
const jpeg = new Uint8Array(readFileSync(JPEG_FILE));

/** Encodeur PNG minimal de test (RGBA 8 bits, filtres choisis) : pour éprouver le décodeur. */
function encodePng(width: number, height: number, rgba: Uint8Array, filters: number[]): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const b of bytes) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, body: Uint8Array) => {
    const out = new Uint8Array(12 + body.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, body.length);
    out.set([...type].map((c) => c.charCodeAt(0)), 4);
    out.set(body, 8);
    view.setUint32(8 + body.length, crc(out.subarray(4, 8 + body.length)));
    return out;
  };
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const f = filters[y % filters.length]!;
    raw[y * (stride + 1)] = f;
    for (let x = 0; x < stride; x++) {
      const v = rgba[y * stride + x]!;
      const left = x >= 4 ? rgba[y * stride + x - 4]! : 0;
      const up = y > 0 ? rgba[(y - 1) * stride + x]! : 0;
      const upLeft = y > 0 && x >= 4 ? rgba[(y - 1) * stride + x - 4]! : 0;
      const pa = Math.abs(up - upLeft);
      const pb = Math.abs(left - upLeft);
      const pc = Math.abs(left + up - 2 * upLeft);
      const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      const pred = [0, left, up, (left + up) >> 1, paeth][f]!;
      raw[y * (stride + 1) + 1 + x] = (v - pred) & 0xff;
    }
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe('P1.5 — analyse des pixels : décodage', () => {
  it('décode le PNG de référence (720×1280, opaque)', () => {
    const d = decodePng(png);
    expect([d.width, d.height, d.decoder]).toEqual([720, 1280, 'png-zlib']);
    expect(d.data.length).toBe(720 * 1280 * 4);
    // Ciel : coin haut gauche, composante bleue dominante (image procédurale connue).
    expect([d.data[0], d.data[1], d.data[2], d.data[3]]).toEqual([8, 11, 26, 255]);
  });

  it('propriété : tout PNG RGBA 8 bits, quels que soient ses filtres, se relit à l’identique', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 9 }),
        fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        (w, h, filters, seed) => {
          // Pixels pseudo-aléatoires déterministes (graine fast-check), aucun Math.random.
          const rgba = new Uint8Array(w * h * 4);
          let x = seed;
          for (let i = 0; i < rgba.length; i++) {
            x = (x * 1103515245 + 12345) & 0x7fffffff;
            rgba[i] = x & 0xff;
          }
          const decoded = decodePng(encodePng(w, h, rgba, filters));
          expect(Buffer.compare(Buffer.from(decoded.data), Buffer.from(rgba))).toBe(0);
        },
      ),
      { seed: 20260928, numRuns: 120 },
    );
  });

  it('JPEG via jpeg-js épinglé : même image, analyse d’un autre encodage (pas de promesse d’égalité avec le PNG)', () => {
    const a = analyzeImage(jpeg);
    expect(a.decoder).toBe(JPEG_DECODER);
    expect(JPEG_DECODER).toBe('jpeg-js@0.4.4');
    expect([a.width, a.height]).toEqual([720, 1280]);
    expect(analysisFingerprint(a)).not.toBe(analysisFingerprint(analyzeImage(png)));
  });

  it('erreurs structurées : format inconnu, PNG entrelacé ou 16 bits', () => {
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return (error as AnalysisError).code;
      }
      return 'ok';
    };
    expect(code(() => analyzeImage(Uint8Array.from([1, 2, 3, 4])))).toBe('asset.analysis_format');
    const sixteen = png.slice();
    sixteen[24] = 16; // profondeur dans IHDR (le CRC n'est pas vérifié par le décodeur, la profondeur l'est)
    expect(code(() => decodePng(sixteen))).toBe('asset.analysis_unsupported');
    const interlaced = png.slice();
    interlaced[28] = 1;
    expect(code(() => decodePng(interlaced))).toBe('asset.analysis_unsupported');
  });
});

describe('P1.5 — analyse des pixels : réduction déterministe', () => {
  it('mêmes octets + même version d’algorithme → document strictement identique', () => {
    const a = analyzeImage(png);
    const b = analyzeImage(png.slice());
    expect(b).toEqual(a);
    expect(a.algorithm).toBe(ANALYSIS_ALGORITHM_VERSION);
    expect(a.asset_sha256).toBe(sha256Hex(png));
    // Empreinte figée : un changement d'algorithme DOIT changer sa version.
    expect(analysisFingerprint(a)).toMatchInlineSnapshot(`"49ecbab920ac3fd3899b59e9875fa4baaa9308819648508bad284984df2ba3dd"`);
  });

  it('un seul octet de pixel modifié change l’analyse', () => {
    const a = analyzeImage(png);
    const pixels = decodePng(png);
    pixels.data[0] = 200;
    const b = analyzeImage(encodePng(pixels.width, pixels.height, pixels.data, [0]));
    expect(analysisFingerprint(b)).not.toBe(analysisFingerprint(a));
  });

  it('chaque cellule est la moyenne entière (arrondie) de ses pixels, prémultipliée par l’alpha', () => {
    // 3×2 pixels, cellule unique (côté long 3 ≤ 320) : chaque pixel est sa propre cellule.
    const rgba = Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255]);
    const a = analyzeImage(encodePng(3, 2, rgba, [0]));
    expect([a.cell, a.grid_w, a.grid_h]).toEqual([1, 3, 2]);
    const cells = analysisCells(a);
    expect([...cells.subarray(0, 12)]).toEqual([255, 0, 0, 255, 0, 128, 0, 128, 0, 0, 0, 0]);
    // Grande image : cellules de 4 px (1280 / 320).
    expect(analyzeImage(png).cell).toBe(4);
  });
});

describe('P1.5 — cache adressé par contenu : optimisation pure', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'motion-analysis-cache-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const sha = sha256Hex(png);

  it('sans cache, cache vide, cache plein : même document', () => {
    const none = analyzeAssetFile(PNG_FILE, sha);
    const miss = analyzeAssetFile(PNG_FILE, sha, { cacheDir: dir });
    const hit = analyzeAssetFile(PNG_FILE, sha, { cacheDir: dir });
    expect([none.cache, miss.cache, hit.cache]).toEqual(['none', 'miss', 'hit']);
    expect(miss.analysis).toEqual(none.analysis);
    expect(hit.analysis).toEqual(none.analysis);
  });

  it('une entrée corrompue ou falsifiée est ignorée et recalculée (jamais crue)', () => {
    const entry = path.join(dir, `${sha}.${ANALYSIS_ALGORITHM_VERSION}.json`);
    const original = analyzeAssetFile(PNG_FILE, sha).analysis;
    writeFileSync(entry, '{ pas du json');
    expect(analyzeAssetFile(PNG_FILE, sha, { cacheDir: dir })).toEqual({ analysis: original, cache: 'miss' });
    const forged = JSON.parse(readFileSync(entry, 'utf8'));
    forged.analysis.rgba = Buffer.from(new Uint8Array(analysisCells(original).length)).toString('base64');
    writeFileSync(entry, JSON.stringify(forged));
    expect(analyzeAssetFile(PNG_FILE, sha, { cacheDir: dir }).analysis).toEqual(original);
  });

  it('refuse un fichier dont l’empreinte n’est pas celle de l’asset déclaré', () => {
    const copy = path.join(dir, 'autre.png');
    copyFileSync(JPEG_FILE, copy);
    expect(() => analyzeAssetFile(copy, sha)).toThrowError(AnalysisError);
  });
});
