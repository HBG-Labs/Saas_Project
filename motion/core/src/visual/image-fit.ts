import type { AssetDefinition, UnitRect } from '../contracts/asset.ts';
import type { Box, PlanImageTreatment } from '../contracts/render-plan.ts';
import type { CreativeStyleProfile } from '../contracts/style-profile.ts';

/**
 * Cadrage d'une image : tout est décidé ici, en pixels source, à partir des
 * métadonnées de l'asset. Le renderer n'a qu'à projeter `crop` dans `box`.
 *
 * - cover : le plus grand recadrage au ratio de la boîte, centré au plus près
 *   du point focal (région visée, sinon point, sinon point focal de l'asset),
 *   puis poussé pour garder la région visée entière si elle tient.
 * - contain : image entière, dessinée au ratio d'origine dans la boîte, alignée.
 */

export interface ImageFitInput {
  asset: AssetDefinition;
  box: Box;
  fit: 'cover' | 'contain';
  focus?: { region: string; fill?: boolean | undefined } | { point: { x: number; y: number } } | undefined;
  align_x: 'start' | 'center' | 'end';
  align_y: 'start' | 'center' | 'end';
}

export interface ImageFit {
  /** Zone réellement dessinée sur le canevas. */
  box: Box;
  /** Recadrage dans l'image source (px source). */
  crop: Box;
  focus: { x: number; y: number };
  /** Régions de l'asset projetées sur le canevas, découpées à la zone dessinée. */
  regions: Record<string, Box>;
  /** Région visée tronquée par le recadrage (trop grande pour le ratio). */
  focus_region_cropped: boolean;
}

export class ImageFitError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ImageFitError';
    this.code = code;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const toPx = (r: UnitRect, w: number, h: number): Box => ({ x: r.x * w, y: r.y * h, w: r.w * w, h: r.h * h });

function intersect(a: Box, b: Box): Box | null {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

export function fitImage(input: ImageFitInput): ImageFit {
  const { asset, box } = input;
  const W = asset.width;
  const H = asset.height;
  if (!(box.w > 0 && box.h > 0)) throw new ImageFitError('image.empty_box', `${asset.id} : zone d'image vide`);

  let focusRegion: Box | null = null;
  let focus = { x: asset.focal_point.x * W, y: asset.focal_point.y * H };
  if (input.focus && 'region' in input.focus) {
    const region = asset.regions[input.focus.region];
    if (!region) throw new ImageFitError('image.region_unknown', `${asset.id} : région « ${input.focus.region} » absente de l'asset`);
    focusRegion = toPx(region, W, H);
    focus = { x: focusRegion.x + focusRegion.w / 2, y: focusRegion.y + focusRegion.h / 2 };
  } else if (input.focus && 'point' in input.focus) {
    focus = { x: input.focus.point.x * W, y: input.focus.point.y * H };
  }

  let crop: Box;
  let drawn: Box;
  let cropped = false;
  if (input.fit === 'cover') {
    const aspect = box.w / box.h;
    let cw = W / H > aspect ? H * aspect : W;
    let ch = W / H > aspect ? H : W / aspect;
    if (focusRegion && input.focus && 'region' in input.focus && input.focus.fill) {
      // Recadrage serré : le plus petit cadre au ratio de la boîte qui contient la région
      // (jamais plus grand que le recadrage maximal, jamais un agrandissement au-delà de l'image).
      const tight = Math.max(focusRegion.w, focusRegion.h * aspect);
      cw = Math.min(cw, tight);
      ch = cw / aspect;
    }
    let cx = clamp(focus.x - cw / 2, 0, W - cw);
    let cy = clamp(focus.y - ch / 2, 0, H - ch);
    if (focusRegion) {
      // Garder la région entière quand elle tient ; sinon, la centrer (et le signaler).
      if (focusRegion.w <= cw) cx = clamp(cx, focusRegion.x + focusRegion.w - cw, focusRegion.x);
      else cropped = true;
      if (focusRegion.h <= ch) cy = clamp(cy, focusRegion.y + focusRegion.h - ch, focusRegion.y);
      else cropped = true;
      cx = clamp(cx, 0, W - cw);
      cy = clamp(cy, 0, H - ch);
    }
    crop = { x: cx, y: cy, w: cw, h: ch };
    drawn = { ...box };
  } else {
    const k = Math.min(box.w / W, box.h / H);
    const w = W * k;
    const h = H * k;
    const x = input.align_x === 'start' ? box.x : input.align_x === 'end' ? box.x + box.w - w : box.x + (box.w - w) / 2;
    const y = input.align_y === 'start' ? box.y : input.align_y === 'end' ? box.y + box.h - h : box.y + (box.h - h) / 2;
    crop = { x: 0, y: 0, w: W, h: H };
    drawn = { x, y, w, h };
  }

  const kx = drawn.w / crop.w;
  const ky = drawn.h / crop.h;
  const regions: Record<string, Box> = {};
  for (const [name, rect] of Object.entries(asset.regions).sort(([a], [b]) => a.localeCompare(b))) {
    const px = toPx(rect, W, H);
    const projected = { x: drawn.x + (px.x - crop.x) * kx, y: drawn.y + (px.y - crop.y) * ky, w: px.w * kx, h: px.h * ky };
    const visible = intersect(projected, drawn);
    if (visible) regions[name] = visible;
  }
  return { box: drawn, crop, focus, regions, focus_region_cropped: cropped };
}

/**
 * Traitement d'image du style, résolu en valeurs numériques pour le renderer.
 * Correspondances du contrat (aucune valeur créative cachée) :
 * - contraste du style c ∈ [-1, 1] → multiplicateur 1 + c ;
 * - « mono » et « duotone » → niveaux de gris ; les autres gardent la couleur ;
 * - voile : uniquement celui déclaré par le style (`image_treatment.tint`).
 */
export function resolveTreatment(style: CreativeStyleProfile, color: (ref: string) => string): PlanImageTreatment {
  const t = style.image_treatment;
  return {
    grayscale: t.grade === 'mono' || t.grade === 'duotone' ? 1 : 0,
    contrast: 1 + t.contrast,
    tint: t.tint ? { color: color(t.tint.color), opacity: t.tint.opacity } : null,
  };
}
