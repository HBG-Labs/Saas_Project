import { runInk } from './shaper.ts';
import type { InkBox, ShapedGlyph, TextShaper } from './shaper.ts';

/**
 * Mise en page d'un bloc de texte à partir de mesures RÉELLES :
 * coupure (explicite ou équilibrée), ajustement déterministe de la taille,
 * positions des runs et des glyphes, lignes de base, encre.
 *
 * Coupure : uniquement sur l'espace U+0020 (jamais sur une insécable), jamais
 * à l'intérieur d'un mot, sans césure. Ajustement : la taille ne descend que
 * par pas de 1 % de la taille du rôle, jamais sous `min_scale`. Les largeurs
 * étant linéaires en taille (mesure non hintée), tout se mesure une fois à la
 * taille du rôle puis se met à l'échelle : même résultat à toute résolution.
 */

export interface TextRunInput {
  id: string;
  /** Texte affiché (typographie de locale et casse déjà appliquées). */
  text: string;
  break_after: boolean;
}

export interface TextBlockInput {
  runs: readonly TextRunInput[];
  /** SHA-256 de la police. */
  font: string;
  language: string;
  /** Taille du rôle typographique à l'échelle de sortie (px). */
  size: number;
  line_height: number;
  tracking_em: number;
  policy: 'explicit' | 'balance';
  align: 'start' | 'center' | 'end';
  width: number;
  /** Hauteur disponible (px) ; null : non contrainte. */
  height: number | null;
  min_scale: number;
  /** Rapport imposé (cohérence d'un rôle entre calques) ; sinon, le plus grand qui tient. */
  ratio?: number;
}

export interface LaidRun {
  id: string;
  text: string;
  /** Origine du run, relative à la boîte du bloc (px). */
  x: number;
  width: number;
  glyphs: ShapedGlyph[];
}

export interface LaidLine {
  runs: LaidRun[];
  top: number;
  height: number;
  /** Ligne de base, relative au haut du bloc (px). */
  baseline: number;
  /** Largeur d'avance du texte visible (espaces de fin exclues). */
  measured_width: number;
  /** Encre de la ligne, relative au bloc. */
  ink: InkBox | null;
}

export interface TextBlockLayout {
  ratio: number;
  size: number;
  lines: LaidLine[];
  height: number;
  ink: InkBox | null;
}

export class TextFitError extends Error {
  readonly code = 'layout.text_overflow';
  constructor(message: string) {
    super(message);
    this.name = 'TextFitError';
  }
}

const EPS = 1e-6;
const STEPS = 100;

interface Token {
  run: string;
  /** Mot suivi de ses espaces ordinaires éventuelles. */
  text: string;
}

/** Paragraphes (coupures obligatoires) découpés en jetons coupables. */
function paragraphs(runs: readonly TextRunInput[]): Token[][] {
  const out: Token[][] = [[]];
  for (const run of runs) {
    const parts = run.text.match(/[^ ]+ *| +/g) ?? [];
    for (const part of parts) out[out.length - 1]!.push({ run: run.id, text: part });
    if (run.break_after) out.push([]);
  }
  return out.filter((p) => p.length > 0);
}

/** Fragments d'une ligne : jetons contigus d'un même run fusionnés, espaces de fin retirées. */
function fragments(tokens: readonly Token[]): { run: string; text: string }[] {
  const out: { run: string; text: string }[] = [];
  for (const t of tokens) {
    const last = out[out.length - 1];
    if (last && last.run === t.run) last.text += t.text;
    else out.push({ run: t.run, text: t.text });
  }
  const tail = out[out.length - 1];
  if (tail) tail.text = tail.text.replace(/ +$/, '');
  return out.filter((f) => f.text.length > 0);
}

export function layoutTextBlock(input: TextBlockInput, shaper: TextShaper): TextBlockLayout {
  const cache = new Map<string, ReturnType<TextShaper['shape']>>();
  const shape = (text: string) => {
    let run = cache.get(text);
    if (!run) {
      run = shaper.shape({ font: input.font, text, size: input.size, tracking_px: input.tracking_em * input.size, language: input.language });
      cache.set(text, run);
    }
    return run;
  };
  /**
   * Emprise d'une ligne : la plus grande de l'avance et de la largeur d'ENCRE.
   * Un glyphe peut déborder de son avance (f, apostrophe, italique) : après
   * l'alignement optique, c'est l'encre qui doit tenir dans la zone.
   */
  const lineWidth = (tokens: readonly Token[]) => {
    let x = 0;
    let ink0 = Infinity;
    let ink1 = -Infinity;
    for (const f of fragments(tokens)) {
      const shaped = shape(f.text);
      const box = runInk(shaped);
      if (box) {
        ink0 = Math.min(ink0, x + box.x0);
        ink1 = Math.max(ink1, x + box.x1);
      }
      x += shaped.advance;
    }
    return Math.max(x, ink1 > ink0 ? ink1 - ink0 : 0);
  };
  const paras = paragraphs(input.runs);
  const lineHeight = input.size * input.line_height;

  /** Coupure équilibrée d'un paragraphe pour une largeur donnée (null : un mot ne tient pas). */
  const balance = (tokens: readonly Token[], width: number): Token[][] | null => {
    const n = tokens.length;
    const w = (i: number, j: number) => lineWidth(tokens.slice(i, j));
    for (let i = 0; i < n; i++) if (w(i, i + 1) > width + EPS) return null;
    // Nombre minimal de lignes (glouton), puis répartition minimisant la ligne la plus longue.
    let lines = 0;
    for (let i = 0; i < n; ) {
      let j = i + 1;
      while (j < n && w(i, j + 1) <= width + EPS) j++;
      lines++;
      i = j;
    }
    // best[l][j] : meilleure répartition des j premiers jetons en l lignes.
    const best: { max: number; squares: number; cut: number }[][] = [[{ max: 0, squares: 0, cut: -1 }]];
    for (let l = 1; l <= lines; l++) {
      best[l] = [];
      for (let j = 1; j <= n; j++) {
        let chosen: { max: number; squares: number; cut: number } | undefined;
        for (let i = l - 1; i < j; i++) {
          const previous = best[l - 1]![i];
          if (!previous) continue;
          const width_ij = w(i, j);
          if (width_ij > width + EPS) continue;
          const candidate = { max: Math.max(previous.max, width_ij), squares: previous.squares + width_ij * width_ij, cut: i };
          // Égalités départagées de façon déterministe : max, puis somme des carrés, puis coupure la plus tardive.
          if (
            !chosen ||
            candidate.max < chosen.max - EPS ||
            (Math.abs(candidate.max - chosen.max) <= EPS && candidate.squares < chosen.squares - EPS) ||
            (Math.abs(candidate.max - chosen.max) <= EPS && Math.abs(candidate.squares - chosen.squares) <= EPS && candidate.cut > chosen.cut)
          ) {
            chosen = candidate;
          }
        }
        if (chosen) best[l]![j] = chosen;
      }
    }
    const out: Token[][] = [];
    let j = n;
    for (let l = lines; l >= 1; l--) {
      const cell = best[l]![j]!;
      out.unshift(tokens.slice(cell.cut, j));
      j = cell.cut;
    }
    return out;
  };

  const linesFor = (width: number): Token[][] | null => {
    const out: Token[][] = [];
    for (const p of paras) {
      if (input.policy === 'explicit') {
        if (lineWidth(p) > width + EPS) return null;
        out.push([...p]);
      } else {
        const lines = balance(p, width);
        if (!lines) return null;
        out.push(...lines);
      }
    }
    return out;
  };

  // Ajustement : plus grand rapport k/100 qui tient (ou rapport imposé).
  const first = input.ratio !== undefined ? Math.round(input.ratio * STEPS) : STEPS;
  const last = Math.ceil(input.min_scale * STEPS - EPS);
  let chosen: { ratio: number; lines: Token[][] } | null = null;
  for (let k = first; k >= last; k--) {
    const ratio = k / STEPS;
    const lines = linesFor(input.width / ratio);
    if (!lines) continue;
    if (input.height !== null && lines.length * lineHeight * ratio > input.height + EPS) continue;
    chosen = { ratio, lines };
    break;
  }
  if (!chosen) {
    const natural = Math.max(...paras.map((p) => lineWidth(p)));
    throw new TextFitError(
      `texte « ${input.runs.map((r) => r.text).join('')} » : ne tient pas dans ${input.width.toFixed(1)}×${input.height?.toFixed(1) ?? '∞'} px ` +
        `même à ${Math.round(input.min_scale * 100)} % de la taille du rôle (ligne naturelle la plus longue ${natural.toFixed(1)} px, politique ${input.policy})`,
    );
  }

  // Positions finales à la taille retenue (mise à l'échelle exacte des mesures).
  const r = chosen.ratio;
  const size = input.size * r;
  const lh = lineHeight * r;
  const metrics = shaper.metrics(input.font, size);
  const baselineInLine = (lh - (metrics.ascender + metrics.descender)) / 2 + metrics.ascender;
  const scaleGlyph = (g: ShapedGlyph): ShapedGlyph => ({
    ...g,
    x: g.x * r,
    x_advance: g.x_advance * r,
    x_offset: g.x_offset * r,
    y_offset: g.y_offset * r,
    ink: g.ink ? { x0: g.ink.x0 * r, x1: g.ink.x1 * r, y0: g.ink.y0 * r, y1: g.ink.y1 * r } : null,
  });

  const lines: LaidLine[] = chosen.lines.map((tokens, index) => {
    let x = 0;
    const runs: LaidRun[] = fragments(tokens).map((f) => {
      const shaped = shape(f.text);
      const run: LaidRun = { id: f.run, text: f.text, x, width: shaped.advance * r, glyphs: shaped.glyphs.map(scaleGlyph) };
      x += run.width;
      return run;
    });
    const measured = x;
    // Encre de la ligne (origine = début de ligne), pour l'alignement optique.
    let ink: InkBox | null = null;
    for (const run of runs) {
      const box = runInk({ text: run.text, size, tracking_px: 0, glyphs: run.glyphs, advance: run.width, missing: [] });
      if (!box) continue;
      const shifted = { x0: box.x0 + run.x, x1: box.x1 + run.x, y0: box.y0, y1: box.y1 };
      ink = ink ? { x0: Math.min(ink.x0, shifted.x0), x1: Math.max(ink.x1, shifted.x1), y0: Math.min(ink.y0, shifted.y0), y1: Math.max(ink.y1, shifted.y1) } : shifted;
    }
    // Alignement optique : c'est l'ENCRE qui s'aligne sur le bord (ou le centre), pas la boîte d'avance.
    const inkLeft = ink?.x0 ?? 0;
    const inkRight = ink?.x1 ?? measured;
    const shift = input.align === 'start' ? -inkLeft : input.align === 'end' ? input.width - inkRight : input.width / 2 - (inkLeft + inkRight) / 2;
    const top = index * lh;
    const baseline = top + baselineInLine;
    for (const run of runs) run.x += shift;
    return {
      runs,
      top,
      height: lh,
      baseline,
      measured_width: measured,
      ink: ink ? { x0: ink.x0 + shift, x1: ink.x1 + shift, y0: baseline + ink.y0, y1: baseline + ink.y1 } : null,
    };
  });

  let blockInk: InkBox | null = null;
  for (const line of lines) {
    if (!line.ink) continue;
    blockInk = blockInk
      ? { x0: Math.min(blockInk.x0, line.ink.x0), x1: Math.max(blockInk.x1, line.ink.x1), y0: Math.min(blockInk.y0, line.ink.y0), y1: Math.max(blockInk.y1, line.ink.y1) }
      : { ...line.ink };
  }
  return { ratio: r, size, lines, height: lines.length * lh, ink: blockInk };
}
