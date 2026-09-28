/**
 * Mise en forme (shaping) et mesure du texte. Le cœur mesure lui-même, avec le
 * même moteur que Chromium (HarfBuzz) : les positions du Render Plan sont
 * réelles et le renderer n'a plus à « deviner » où tombent les glyphes.
 *
 * Toutes les longueurs sortent en pixels de sortie. Une police est désignée
 * par l'empreinte SHA-256 de son fichier : même octets, même mesure.
 */

export interface FontMetrics {
  units_per_em: number;
  /** Au-dessus de la ligne de base (px, positif). */
  ascender: number;
  /** Sous la ligne de base (px, positif). */
  descender: number;
  cap_height: number;
  x_height: number;
}

export interface InkBox {
  /** Relatif à l'origine du glyphe (x) et à la ligne de base (y, vers le bas). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface ShapedGlyph {
  glyph: number;
  /** Indice (UTF-16) du caractère source dans le texte du run. */
  cluster: number;
  /** Position x de l'origine du glyphe, depuis le début du run (px, espacement compris). */
  x: number;
  x_advance: number;
  x_offset: number;
  y_offset: number;
  /** Encre du glyphe (null : glyphe sans dessin, comme l'espace). */
  ink: InkBox | null;
}

export interface ShapedRun {
  text: string;
  size: number;
  tracking_px: number;
  glyphs: ShapedGlyph[];
  /** Avance totale, espacement compris (px). */
  advance: number;
  /** Caractères sans glyphe dans la police (.notdef). */
  missing: string[];
}

export interface ShapeRequest {
  /** SHA-256 du fichier de police. */
  font: string;
  text: string;
  size: number;
  tracking_px: number;
  /** Étiquette BCP 47 (fr-FR). */
  language: string;
}

export interface TextShaper {
  /** Moteur et version, pour la provenance (« harfbuzz 12.1.0 »). */
  readonly engine: string;
  metrics(font: string, size: number): FontMetrics;
  shape(request: ShapeRequest): ShapedRun;
  hasCharacter(font: string, character: string): boolean;
}

export class ShaperError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ShaperError';
    this.code = code;
  }
}

/** Encre d'un run positionné, relative à son origine et à la ligne de base. */
export function runInk(run: ShapedRun): InkBox | null {
  let box: InkBox | null = null;
  for (const g of run.glyphs) {
    if (!g.ink) continue;
    const gx = g.x + g.x_offset;
    const next = { x0: gx + g.ink.x0, x1: gx + g.ink.x1, y0: g.ink.y0 - g.y_offset, y1: g.ink.y1 - g.y_offset };
    box = box
      ? { x0: Math.min(box.x0, next.x0), x1: Math.max(box.x1, next.x1), y0: Math.min(box.y0, next.y0), y1: Math.max(box.y1, next.y1) }
      : next;
  }
  return box;
}
