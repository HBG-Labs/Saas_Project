import type { GridPlacement, Platform } from '../contracts/common.ts';
import type { SlotGeometry } from '../contracts/pattern.ts';
import type { PlatformPresets } from '../contracts/platform.ts';
import type { Box } from '../contracts/render-plan.ts';
import type { CreativeStyleProfile } from '../contracts/style-profile.ts';

/** Repère de mise en page d'une sortie : échelle, zone utile et grille du style. */
export interface LayoutFrame {
  /** Facteur entre le canevas de référence du style et la sortie. */
  scale: number;
  canvas: { width: number; height: number };
  content: Box;
  columns: number;
  rows: number;
  colWidth: number;
  rowHeight: number;
  gutter: number;
}

export class LayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutError';
  }
}

const ratio = (w: number, h: number) => w / h;

/**
 * Zone utile = marges du style ∩ zones sûres de toutes les plateformes visées.
 * Toutes les longueurs viennent du style ou des presets, mises à l'échelle.
 */
export function layoutFrame(
  style: CreativeStyleProfile,
  presets: PlatformPresets,
  formatId: string,
  platforms: readonly Platform[],
  output: { width: number; height: number },
): LayoutFrame {
  const format = presets.formats[formatId];
  if (!format) throw new LayoutError(`format « ${formatId} » absent des presets`);
  const target = ratio(output.width, output.height);
  if (Math.abs(target - ratio(format.width, format.height)) > 0.005) {
    throw new LayoutError(`la sortie ${output.width}×${output.height} n'a pas le ratio du format ${formatId}`);
  }
  const ref = style.reference_canvas;
  if (Math.abs(target - ratio(ref.width, ref.height)) > 0.005) {
    throw new LayoutError(`le canevas de référence du style n'a pas le ratio de la sortie`);
  }
  const scale = output.width / ref.width;
  const m = style.grid.margin;
  const inset = { top: m.top * scale, right: m.right * scale, bottom: m.bottom * scale, left: m.left * scale };
  for (const platform of platforms) {
    const preset = presets.platforms[platform];
    if (!preset) throw new LayoutError(`plateforme ${platform} absente des presets`);
    const zoneFormat = presets.formats[preset.safe_zone.format];
    if (!zoneFormat) throw new LayoutError(`format de zone sûre « ${preset.safe_zone.format} » absent`);
    const k = output.width / zoneFormat.width;
    const z = preset.safe_zone.insets;
    inset.top = Math.max(inset.top, z.top * k);
    inset.right = Math.max(inset.right, z.right * k);
    inset.bottom = Math.max(inset.bottom, z.bottom * k);
    inset.left = Math.max(inset.left, z.left * k);
  }
  const content: Box = {
    x: inset.left,
    y: inset.top,
    w: output.width - inset.left - inset.right,
    h: output.height - inset.top - inset.bottom,
  };
  const gutter = style.grid.gutter * scale;
  const columns = style.grid.columns;
  const rows = style.grid.rows;
  const colWidth = (content.w - gutter * (columns - 1)) / columns;
  const rowHeight = (content.h - gutter * (rows - 1)) / rows;
  if (colWidth <= 0 || rowHeight <= 0) throw new LayoutError('la grille du style ne tient pas dans la zone utile');
  return { scale, canvas: { width: output.width, height: output.height }, content, columns, rows, colWidth, rowHeight, gutter };
}

/** Région d'un slot : fractions de la zone utile, calées sur les lignes de la grille. */
export function regionBox(frame: LayoutFrame, x: readonly [number, number], y: readonly [number, number]): Box {
  const c0 = Math.min(frame.columns - 1, Math.round(x[0] * frame.columns));
  const c1 = Math.max(c0 + 1, Math.round(x[1] * frame.columns));
  const r0 = Math.min(frame.rows - 1, Math.round(y[0] * frame.rows));
  const r1 = Math.max(r0 + 1, Math.round(y[1] * frame.rows));
  return placementBox(frame, { col: c0 + 1, col_span: c1 - c0, row: r0 + 1, row_span: r1 - r0 });
}

/** Placement explicite en colonnes et rangées (1-indexées). */
export function placementBox(frame: LayoutFrame, p: Pick<GridPlacement, 'col' | 'col_span' | 'row' | 'row_span'>): Box {
  const colStep = frame.colWidth + frame.gutter;
  const rowStep = frame.rowHeight + frame.gutter;
  return {
    x: frame.content.x + (p.col - 1) * colStep,
    y: frame.content.y + (p.row - 1) * rowStep,
    w: p.col_span * colStep - frame.gutter,
    h: p.row_span * rowStep - frame.gutter,
  };
}

/** Longueur en colonnes (éventuellement fractionnaire), gouttières intermédiaires comprises. */
export function columnsLength(frame: LayoutFrame, cols: number): number {
  const whole = Math.floor(cols);
  const gutters = Math.max(0, Math.ceil(cols) - 1);
  return whole * frame.colWidth + (cols - whole) * frame.colWidth + gutters * frame.gutter;
}

/** Position d'un bloc de hauteur `height` dans une région, selon l'alignement vertical. */
export function alignVertically(region: Box, height: number, align: 'start' | 'center' | 'end'): number {
  if (align === 'start') return region.y;
  if (align === 'center') return region.y + (region.h - height) / 2;
  return region.y + region.h - height;
}

export function alignHorizontally(region: Box, width: number, align: 'start' | 'center' | 'end'): number {
  if (align === 'start') return region.x;
  if (align === 'center') return region.x + (region.w - width) / 2;
  return region.x + region.w - width;
}

export type { SlotGeometry };
