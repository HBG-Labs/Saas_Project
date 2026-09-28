import type { AssetRegistry } from '../contracts/asset.ts';
import type { Layer, MotionSceneSpec, TextLayer } from '../contracts/motion-spec.ts';
import { patternKey } from '../contracts/pattern.ts';
import type { PatternRegistry, SlotGeometry } from '../contracts/pattern.ts';
import type { Box, PlanLine, PlanNode, RenderPlan, Track } from '../contracts/render-plan.ts';
import type { CreativeStyleProfile } from '../contracts/style-profile.ts';
import type { LayerContext } from '../motion/tracks.ts';
import { layoutTextBlock } from '../text/layout-text.ts';
import type { TextShaper } from '../text/shaper.ts';
import { applyTypographyToRuns, GLYPH_FALLBACKS } from '../text/typography.ts';
import { fitImage, resolveTreatment } from '../visual/image-fit.ts';
import type { ImageFit } from '../visual/image-fit.ts';
import { alignHorizontally, alignVertically, columnsLength, placementBox, regionBox } from './layout.ts';
import type { LayoutFrame } from './layout.ts';

// Construction des nœuds du Render Plan : tout ce qui est visuel se décide ici,
// sur mesures réelles (texte) et métadonnées déclarées (images). Le renderer
// ne recevra que des positions, des tailles, des recadrages et des couleurs.

export class CompileError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const tokenKey = (ref: string) => ref.slice(ref.indexOf('.') + 1);
const fontId = (family: string, weight: number) => `${family.replace(/[^a-z0-9_]/g, '_')}_${weight}`;
/** Tolérance de la zone sûre : un demi-pixel de sortie. */
const SAFE_TOLERANCE = 0.5;

export function color(style: CreativeStyleProfile, ref: string): string {
  const value = style.palette[tokenKey(ref)];
  if (!value) throw new CompileError('compile.color', `couleur « ${ref} » absente du style`);
  return value;
}

type Align = 'start' | 'center' | 'end';

interface Region {
  box: Box;
  align_x: Align;
  align_y: Align;
  /** Hauteur réellement disponible (px) ; null si non contrainte. */
  height: number | null;
}

export interface BuildContext {
  style: CreativeStyleProfile;
  frame: LayoutFrame;
  locale: string;
  shaper: TextShaper;
  assets: AssetRegistry;
  /** Rapport imposé par rôle typographique (cohérence) ; vide au premier passage. */
  forcedRatios: ReadonlyMap<string, number>;
  fonts: Map<string, RenderPlan['fonts'][number]>;
  planAssets: Map<string, RenderPlan['assets'][number]>;
  /** Rapport retenu par calque texte (rôle, rapport). */
  ratios: Map<string, { role: string; ratio: number }>;
  substitutions: Map<string, { font: string; character: string; replacement: string }>;
  warnings: { code: string; path: string; message: string }[];
}

interface SceneBuild extends BuildContext {
  slots: Record<string, SlotGeometry>;
  occupied: Map<string, Box>;
  regions: Map<string, Box>;
  images: Map<string, ImageFit>;
  contexts: Map<string, Omit<LayerContext, 'scene'>>;
  accentTargets: ReadonlySet<string>;
}

function slotRegion(build: SceneBuild, slot: string): Region {
  const geometry = build.slots[slot];
  if (!geometry) throw new CompileError('compile.slot', `slot « ${slot} » inconnu du pattern`);
  const content = build.frame.content;
  if (geometry.kind === 'region') {
    const box = regionBox(build.frame, geometry.x, geometry.y);
    return { box, align_x: geometry.align_x, align_y: geometry.align_y, height: box.h };
  }
  const ref = build.occupied.get(geometry.of);
  const refRegion = build.regions.get(geometry.of);
  if (!ref || !refRegion) throw new CompileError('compile.slot_order', `le slot « ${geometry.of} » doit être placé avant « ${slot} »`);
  const gap = build.style.space[geometry.gap];
  if (gap === undefined) throw new CompileError('compile.space', `espacement « ${geometry.gap} » absent du style`);
  const top = ref.y + ref.h + gap * build.frame.scale;
  return { box: { x: refRegion.x, y: top, w: refRegion.w, h: 0 }, align_x: geometry.align_x, align_y: 'start', height: content.y + content.h - top };
}

function layerRegion(build: SceneBuild, layer: Layer, parent: Box | null): Region {
  if (layer.region) {
    const image = build.images.get(layer.region.layer);
    if (!image) throw new CompileError('layout.region_source', `${layer.id} : l'image « ${layer.region.layer} » doit être placée avant`);
    const projected = image.regions[layer.region.name];
    // Une région sert à poser du contenu : elle est ramenée dans la zone sûre.
    const box = projected ? intersect(projected, build.frame.content) : null;
    if (!box) throw new CompileError('layout.region_unavailable', `${layer.id} : région « ${layer.region.name} » hors cadre ou hors zone sûre après recadrage`);
    return { box, align_x: layer.region.align_x ?? 'start', align_y: layer.region.align_y ?? 'start', height: box.h };
  }
  if (layer.placement) {
    const box = placementBox(build.frame, layer.placement);
    return { box, align_x: layer.placement.align_x ?? 'start', align_y: layer.placement.align_y ?? 'start', height: box.h };
  }
  if (layer.slot) return slotRegion(build, layer.slot);
  const box = parent ?? build.frame.content;
  return { box, align_x: 'start', align_y: 'start', height: box.h };
}

function intersect(a: Box, b: Box): Box | null {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

function assertSafe(build: SceneBuild, id: string, box: Box, what: string) {
  const s = build.frame.content;
  const t = SAFE_TOLERANCE;
  if (box.x < s.x - t || box.y < s.y - t || box.x + box.w > s.x + s.w + t || box.y + box.h > s.y + s.h + t) {
    throw new CompileError(
      'layout.safe_zone',
      `${id} : ${what} [${box.x.toFixed(1)}, ${box.y.toFixed(1)}, ${box.w.toFixed(1)}×${box.h.toFixed(1)}] hors de la zone sûre ` +
        `[${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.w.toFixed(1)}×${s.h.toFixed(1)}]`,
    );
  }
}

/** Texte affiché : typographie de locale, casse, puis replis de glyphes déclarés (sinon erreur). */
function displayTexts(build: SceneBuild, layer: TextLayer, fontSha: string, upper: boolean): string[] {
  const { texts } = applyTypographyToRuns(
    layer.content.runs.map((r) => ({ text: r.text, break_after: r.break_after ?? false })),
    build.locale,
  );
  return texts.map((raw) => {
    const text = upper ? raw.toLocaleUpperCase(build.locale) : raw;
    let out = '';
    for (const ch of text) {
      if (ch === ' ' || build.shaper.hasCharacter(fontSha, ch)) {
        out += ch;
        continue;
      }
      const fallback = GLYPH_FALLBACKS[ch];
      if (fallback !== undefined && build.shaper.hasCharacter(fontSha, fallback)) {
        out += fallback;
        const key = `${fontSha}|${ch}`;
        if (!build.substitutions.has(key)) build.substitutions.set(key, { font: fontSha, character: ch, replacement: fallback });
        continue;
      }
      const cp = ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
      throw new CompileError('type.missing_glyph', `${layer.id} : la police n'a pas de glyphe pour U+${cp} (« ${ch} »), et aucun repli n'est déclaré`);
    }
    return out;
  });
}

function buildText(build: SceneBuild, layer: TextLayer, region: Region, base: Pick<PlanNode, 'id' | 'origin' | 'opacity' | 'tracks'>) {
  const { style, frame } = build;
  const role = tokenKey(layer.style.type);
  const typeStyle = style.typography.scale[role];
  if (!typeStyle) throw new CompileError('compile.type', `style typographique « ${layer.style.type} » absent`);
  const family = style.typography.families[typeStyle.family];
  const file = family?.files.find((f) => f.weight === typeStyle.weight && f.style === 'normal');
  if (!family || !file) throw new CompileError('compile.font', `police ${typeStyle.family} ${typeStyle.weight} absente`);
  const id = fontId(typeStyle.family, typeStyle.weight);
  build.fonts.set(id, { id, css_name: family.css_name, weight: typeStyle.weight, style: 'normal', file: file.src, sha256: file.sha256 });

  const texts = displayTexts(build, layer, file.sha256, typeStyle.case === 'upper');
  const align = layer.style.align ?? region.align_x;
  const fit = style.typography.fit;
  const forced = fit.scope === 'role' ? build.forcedRatios.get(role) : undefined;
  const laid = layoutTextBlock(
    {
      runs: layer.content.runs.map((r, i) => ({ id: r.id, text: texts[i]!, break_after: r.break_after ?? false })),
      font: file.sha256,
      language: build.locale,
      size: typeStyle.size * frame.scale,
      line_height: typeStyle.line_height,
      tracking_em: typeStyle.tracking_em,
      policy: layer.content.break_policy,
      align,
      width: region.box.w,
      height: region.height,
      min_scale: fit.min_scale,
      ...(forced !== undefined ? { ratio: forced } : {}),
    },
    build.shaper,
  );
  build.ratios.set(layer.id, { role, ratio: laid.ratio });

  const baseColor = color(style, layer.style.color);
  const accentColor = layer.style.accent_color ? color(style, layer.style.accent_color) : null;
  const mutedColor = layer.style.muted_color ? color(style, layer.style.muted_color) : null;
  const runBaseColor = new Map<string, string>();
  for (const run of layer.content.runs) {
    const animatedAccent = run.role === 'accent' && build.accentTargets.has(run.id);
    runBaseColor.set(
      run.id,
      run.role === 'accent' && !animatedAccent && accentColor ? accentColor : run.role === 'muted' && mutedColor ? mutedColor : baseColor,
    );
  }

  const lines: PlanLine[] = laid.lines.map((line) => ({
    runs: line.runs.map((run) => ({
      id: run.id,
      text: run.text,
      font: id,
      weight: typeStyle.weight,
      size: laid.size,
      tracking_px: typeStyle.tracking_em * laid.size,
      color: runBaseColor.get(run.id)!,
      x: run.x,
      width: run.width,
      glyphs: run.glyphs.map((g) => ({ g: g.glyph, cl: g.cluster, x: g.x, dx: g.x_offset, dy: g.y_offset })),
    })),
    top: line.top,
    height: line.height,
    baseline: line.baseline,
    measured_width: line.measured_width,
    ink: line.ink,
  }));

  const y = alignVertically(region.box, laid.height, region.align_y);
  const box: Box = { x: region.box.x, y, w: region.box.w, h: laid.height };
  const ink = laid.ink ? { x: box.x + laid.ink.x0, y: box.y + laid.ink.y0, w: laid.ink.x1 - laid.ink.x0, h: laid.ink.y1 - laid.ink.y0 } : null;
  if (ink) assertSafe(build, layer.id, ink, 'encre du texte');
  if (layer.slot) {
    // L'élément suivant se place sous l'ENCRE (espacement optique), pas sous l'interlignage.
    build.occupied.set(layer.slot, ink ? { x: box.x, y: box.y, w: box.w, h: ink.y + ink.h - box.y } : box);
    build.regions.set(layer.slot, region.box);
  }
  return {
    node: { ...base, type: 'text' as const, box, align, lines, fit: { role, ratio: laid.ratio, size: laid.size, policy: layer.content.break_policy }, ink },
    context: { baseColor, accentColor, runBaseColor },
  };
}

function buildNode(build: SceneBuild, layer: Layer, parent: Box | null): { node: PlanNode; context: Omit<LayerContext, 'scene'> } {
  const { style, frame } = build;
  const s = frame.scale;
  const base = { id: layer.id, origin: { x: 0.5, y: 0.5 }, opacity: layer.opacity ?? 1, tracks: [] as Track[] };
  const none = { baseColor: null, accentColor: null, runBaseColor: new Map<string, string>() };

  switch (layer.primitive) {
    case 'text':
      return buildText(build, layer, layerRegion(build, layer, parent), base);

    case 'image': {
      const asset = build.assets.get(layer.asset);
      if (!asset) throw new CompileError('asset.unknown', `${layer.id} : asset « ${layer.asset} » non fourni au compilateur`);
      const region = layer.bleed ? { box: { x: 0, y: 0, w: frame.canvas.width, h: frame.canvas.height }, align_x: 'center' as const, align_y: 'center' as const, height: null } : layerRegion(build, layer, parent);
      const fitted = fitImage({ asset, box: region.box, fit: layer.fit, focus: layer.focus, align_x: region.align_x, align_y: region.align_y });
      if (fitted.focus_region_cropped) {
        build.warnings.push({ code: 'image.region_cropped', path: layer.id, message: `${layer.id} : la région visée ne tient pas entière au ratio du cadre` });
      }
      build.images.set(layer.id, fitted);
      build.planAssets.set(asset.id, { ref: asset.id, file: asset.file, sha256: asset.sha256, width: asset.width, height: asset.height });
      if (layer.slot) {
        build.occupied.set(layer.slot, fitted.box);
        build.regions.set(layer.slot, region.box);
      }
      return {
        node: {
          ...base,
          type: 'image',
          box: fitted.box,
          asset: asset.id,
          fit: layer.fit,
          crop: fitted.crop,
          focus: fitted.focus,
          regions: fitted.regions,
          treatment: resolveTreatment(style, (ref) => color(style, ref)),
        },
        context: none,
      };
    }

    case 'path': {
      const weight = style.strokes[tokenKey(layer.style.weight)];
      if (weight === undefined) throw new CompileError('compile.motif', `${layer.id} : trait absent du style`);
      const strokeWidth = weight * s;
      const stroke = color(style, layer.style.stroke);
      const cap = layer.style.cap ?? ('motif' in layer.geometry ? (style.motifs[tokenKey(layer.geometry.motif)]?.cap ?? 'butt') : 'round');
      let box: Box;
      let d: string;
      if ('motif' in layer.geometry) {
        const region = layerRegion(build, layer, parent);
        const motif = style.motifs[tokenKey(layer.geometry.motif)];
        if (!motif) throw new CompileError('compile.motif', `${layer.id} : motif absent du style`);
        const length = Math.max(strokeWidth, columnsLength(frame, motif.length_cols));
        const x = alignHorizontally(region.box, length, region.align_x);
        box = { x, y: region.box.y, w: length, h: strokeWidth };
        // Une extrémité ronde ou carrée déborde d'une demi-épaisseur : on la reprend dans la longueur.
        const inset = cap === 'butt' ? 0 : strokeWidth / 2;
        d = `M ${inset} ${strokeWidth / 2} L ${length - inset} ${strokeWidth / 2}`;
        if (layer.slot) {
          build.occupied.set(layer.slot, box);
          build.regions.set(layer.slot, region.box);
        }
      } else {
        // Points en unités de grille continue : x ∈ [0, colonnes], y ∈ [0, rangées] de la zone utile.
        const c = frame.content;
        const pts = layer.geometry.points.map((p) => ({ x: c.x + (p.x * c.w) / frame.columns, y: c.y + (p.y * c.h) / frame.rows }));
        const pad = strokeWidth / 2;
        const x0 = Math.min(...pts.map((p) => p.x)) - pad;
        const y0 = Math.min(...pts.map((p) => p.y)) - pad;
        const x1 = Math.max(...pts.map((p) => p.x)) + pad;
        const y1 = Math.max(...pts.map((p) => p.y)) + pad;
        box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        const fmt = (v: number) => Number(v.toFixed(3));
        d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${fmt(p.x - x0)} ${fmt(p.y - y0)}`).join(' ') + (layer.geometry.closed ? ' Z' : '');
      }
      assertSafe(build, layer.id, box, 'tracé');
      return { node: { ...base, type: 'path', box, d, stroke: { color: stroke, width: strokeWidth, cap } }, context: { ...none, baseColor: stroke } };
    }

    case 'shape': {
      const region = layerRegion(build, layer, parent);
      const radius = layer.radius ? (style.space[tokenKey(layer.radius)] ?? 0) * s : 0;
      const stroke = layer.stroke ? { color: color(style, layer.stroke.color), width: (style.strokes[tokenKey(layer.stroke.weight)] ?? 0) * s } : null;
      return {
        node: { ...base, type: 'shape', box: region.box, shape: layer.shape, radius, fill: layer.fill ? color(style, layer.fill) : null, stroke },
        context: { ...none, baseColor: layer.fill ? color(style, layer.fill) : null },
      };
    }

    case 'group': {
      const region = layerRegion(build, layer, parent);
      const children = layer.children.map((child) => {
        const built = buildNode(build, child, null);
        build.contexts.set(child.id, built.context);
        return built.node;
      });
      return { node: { ...base, type: 'group', box: region.box, children }, context: none };
    }

    case 'mask': {
      const region = layerRegion(build, layer, parent);
      const radius = layer.clip.radius ? (style.space[tokenKey(layer.clip.radius)] ?? 0) * s : 0;
      // Les enfants sans placement propre remplissent la fenêtre du masque.
      const children = layer.children.map((child) => {
        const built = buildNode(build, child, region.box);
        build.contexts.set(child.id, built.context);
        return built.node;
      });
      return { node: { ...base, type: 'mask', box: region.box, clip: { shape: layer.clip.shape, radius }, children }, context: none };
    }
  }
}

function flattenLayers(layers: readonly Layer[]): Layer[] {
  return layers.flatMap((l) => (l.primitive === 'group' || l.primitive === 'mask' ? [l, ...flattenLayers(l.children)] : [l]));
}

/** Construit les nœuds de toutes les scènes (un passage). */
export function buildScenes(
  spec: MotionSceneSpec,
  patterns: PatternRegistry,
  context: BuildContext,
): { nodes: Map<string, PlanNode[]>; contexts: Map<string, LayerContext> } {
  const nodes = new Map<string, PlanNode[]>();
  const contexts = new Map<string, LayerContext>();
  for (const scene of spec.scenes) {
    const pattern = patterns.get(patternKey(scene.pattern.id, scene.pattern.version))!;
    const layout = pattern.layouts[scene.pattern.variation.layout_variant ?? pattern.variation_axes.layout_variant.default]!;
    const build: SceneBuild = {
      ...context,
      slots: layout.slots,
      occupied: new Map(),
      regions: new Map(),
      images: new Map(),
      contexts: new Map(),
      accentTargets: new Set(
        flattenLayers(scene.layers).flatMap((l) => l.behaviors.filter((b) => b.behavior === 'ACCENT_WORD').map((b) => b.target?.run ?? '')),
      ),
    };
    nodes.set(
      scene.id,
      scene.layers.map((layer) => {
        const built = buildNode(build, layer, null);
        build.contexts.set(layer.id, built.context);
        return built.node;
      }),
    );
    for (const [id, ctx] of build.contexts) contexts.set(id, { ...ctx, scene: scene.id });
  }
  return { nodes, contexts };
}
