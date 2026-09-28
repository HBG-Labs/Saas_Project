import * as hb from 'harfbuzzjs';

import { ShaperError } from './shaper.ts';
import type { FontMetrics, ShapedGlyph, TextShaper } from './shaper.ts';

// Implémentation HarfBuzz (WASM, même moteur que Chromium). Côté Node
// uniquement : le point d'entrée « runtime » (navigateur) n'importe jamais ce
// fichier.

/** Fournit les octets d'une police à partir de l'empreinte de son fichier. */
export type FontBytesProvider = (sha256: string) => Uint8Array;

interface LoadedFont {
  face: hb.Face;
  font: hb.Font;
  upem: number;
  extents: Map<number, hb.GlyphExtents | null>;
}

/**
 * Chromium désactive les ligatures facultatives dès qu'un espacement de
 * lettres est appliqué (CSS Text 3) : le shaping du cœur fait de même, sans
 * quoi les largeurs divergeraient.
 */
const NO_LIGATURES = [new hb.Feature('liga', 0), new hb.Feature('clig', 0), new hb.Feature('dlig', 0), new hb.Feature('hlig', 0)];

export function createHarfBuzzShaper(bytesOf: FontBytesProvider): TextShaper {
  const fonts = new Map<string, LoadedFont>();

  const load = (sha: string): LoadedFont => {
    let loaded = fonts.get(sha);
    if (!loaded) {
      const face = new hb.Face(new hb.Blob(bytesOf(sha)), 0);
      const font = new hb.Font(face);
      // Positions en unités de fonte : aucune perte, conversion en px ensuite.
      font.setScale(face.upem, face.upem);
      loaded = { face, font, upem: face.upem, extents: new Map() };
      fonts.set(sha, loaded);
    }
    return loaded;
  };

  const extentsOf = (f: LoadedFont, glyph: number) => {
    if (!f.extents.has(glyph)) f.extents.set(glyph, f.font.glyphExtents(glyph) ?? null);
    return f.extents.get(glyph)!;
  };

  return {
    engine: `harfbuzz ${hb.versionString()}`,

    metrics(sha, size) {
      const f = load(sha);
      const k = size / f.upem;
      const h = f.font.hExtents();
      const cap = f.font.getMetricPositionWithFallback(hb.MetricsTag.CAP_HEIGHT);
      const xh = f.font.getMetricPositionWithFallback(hb.MetricsTag.X_HEIGHT);
      return {
        units_per_em: f.upem,
        ascender: h.ascender * k,
        descender: -h.descender * k,
        cap_height: cap * k,
        x_height: xh * k,
      } satisfies FontMetrics;
    },

    hasCharacter(sha, character) {
      const cp = character.codePointAt(0);
      return cp !== undefined && (load(sha).font.nominalGlyph(cp) ?? 0) !== 0;
    },

    shape({ font: sha, text, size, tracking_px, language }) {
      if (!(size > 0)) throw new ShaperError('text.size', `taille de texte invalide : ${size}`);
      const f = load(sha);
      const k = size / f.upem;
      const buffer = new hb.Buffer();
      buffer.addText(text);
      buffer.setLanguage(language);
      buffer.guessSegmentProperties();
      hb.shape(f.font, buffer, tracking_px !== 0 ? NO_LIGATURES : undefined);
      const infos = buffer.getGlyphInfos();
      const positions = buffer.getGlyphPositions();

      // CSS letter-spacing : ajouté après chaque caractère typographique,
      // c'est-à-dire après le dernier glyphe de chaque grappe.
      const glyphs: ShapedGlyph[] = [];
      const missing: string[] = [];
      let x = 0;
      for (let i = 0; i < infos.length; i++) {
        const info = infos[i]!;
        const pos = positions[i]!;
        if (info.codepoint === 0) missing.push(String.fromCodePoint(text.codePointAt(info.cluster) ?? 0xfffd));
        const ext = extentsOf(f, info.codepoint);
        const ink =
          ext && ext.width !== 0 && ext.height !== 0
            ? { x0: ext.xBearing * k, x1: (ext.xBearing + ext.width) * k, y0: -ext.yBearing * k, y1: -(ext.yBearing + ext.height) * k }
            : null;
        const endOfCluster = i === infos.length - 1 || infos[i + 1]!.cluster !== info.cluster;
        const advance = pos.xAdvance * k + (endOfCluster ? tracking_px : 0);
        glyphs.push({ glyph: info.codepoint, cluster: info.cluster, x, x_advance: advance, x_offset: pos.xOffset * k, y_offset: pos.yOffset * k, ink });
        x += advance;
      }
      return { text, size, tracking_px, glyphs, advance: x, missing: [...new Set(missing)] };
    },
  };
}
