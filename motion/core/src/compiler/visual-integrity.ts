import type { PlanImageNode, PlanNode, PlanTextContrast, RenderPlan } from '../contracts/render-plan.ts';
import type { CreativeStyleProfile } from '../contracts/style-profile.ts';
import { sampleProperty } from '../runtime/sample.ts';
import type { TemporalPlan } from '../temporal/engine.ts';
import { msToFrame } from '../temporal/frames.ts';
import { sampleAnalysis } from '../visual/analysis.ts';
import type { AssetAnalysis } from '../visual/analysis.ts';
import { applyTreatment, CONTRAST_FLOORS, contrastOfLuminances, hexToRgb, quantile, relativeLuminanceRgb, textCategory } from '../visual/contrast.ts';
import { CompileError } from './build-nodes.ts';
import type { GlyphSample, TextSamples } from './build-nodes.ts';

/**
 * P1.5 — Visual Integrity & Image Motion : vérifications IMAGE PAR IMAGE sur le
 * plan compilé, avec les mêmes échantillonneurs que le renderer (runtime du
 * cœur). Rien n'est corrigé : on mesure, on détecte, on explique, on refuse.
 */

type Scene = RenderPlan['scenes'][number];
const EPS = 1e-6;

const num = (node: PlanNode, property: Parameters<typeof sampleProperty>[1], frame: number, fps: number, fallback: number) =>
  Number(sampleProperty(node.tracks, property, {}, frame, fps, fallback));

function walk(nodes: readonly PlanNode[], visit: (n: PlanNode) => void) {
  for (const n of nodes) {
    visit(n);
    if (n.type === 'group' || n.type === 'mask') walk(n.children, visit);
  }
}

const CONTENT = ['content_scale', 'content_x', 'content_y'] as const;
const hasContentMotion = (n: PlanImageNode) => n.tracks.some((t) => (CONTENT as readonly string[]).includes(t.property));

/** Transformation de contenu d'une image à une frame : échelle et translation autour de l'origine de contenu. */
function contentAt(node: PlanImageNode, frame: number, fps: number) {
  return {
    s: num(node, 'content_scale', frame, fps, 1),
    tx: num(node, 'content_x', frame, fps, 0),
    ty: num(node, 'content_y', frame, fps, 0),
    ox: node.content_origin.x * node.box.w,
    oy: node.content_origin.y * node.box.h,
  };
}

/**
 * Aucune frame ne montre une zone hors de l'image : la fenêtre visible de la
 * boîte, ramenée dans les coordonnées du contenu, reste dans l'image dessinée.
 */
export function checkImageMotion(plan: RenderPlan): number {
  let checked = 0;
  for (const scene of plan.scenes) {
    walk(scene.nodes, (n) => {
      if (n.type !== 'image' || !hasContentMotion(n)) return;
      const asset = plan.assets.find((a) => a.ref === n.asset)!;
      const kx = n.box.w / n.crop.w;
      const ky = n.box.h / n.crop.h;
      const left = -n.crop.x * kx;
      const top = -n.crop.y * ky;
      const right = left + asset.width * kx;
      const bottom = top + asset.height * ky;
      for (let f = scene.from; f < scene.to; f++) {
        checked++;
        const c = contentAt(n, f, plan.canvas.fps);
        if (!(c.s > 0)) throw new CompileError('image.motion_out_of_bounds', `${n.id} : échelle de contenu ${c.s} à la frame ${f}`);
        // Point de la boîte p ↦ point du contenu q = o + (p − o − t) / s.
        const qx0 = c.ox + (0 - c.ox - c.tx) / c.s;
        const qx1 = c.ox + (n.box.w - c.ox - c.tx) / c.s;
        const qy0 = c.oy + (0 - c.oy - c.ty) / c.s;
        const qy1 = c.oy + (n.box.h - c.oy - c.ty) / c.s;
        const over = Math.max(left - qx0, qx1 - right, top - qy0, qy1 - bottom);
        if (over > 0.01) {
          throw new CompileError(
            'image.motion_out_of_bounds',
            `${n.id} : à la frame ${f}, le mouvement expose ${over.toFixed(2)} px hors de l'image ` +
              `(échelle ${c.s.toFixed(4)}, décalage ${c.tx.toFixed(2)}, ${c.ty.toFixed(2)}) ; réduire la course ou augmenter l'échelle du style`,
          );
        }
      }
    });
  }
  return checked;
}

/** État d'un nœud à une frame (pistes échantillonnées une seule fois par frame). */
interface NodeFrame {
  s: number;
  tx: number;
  ty: number;
  opacity: number;
  clip: { t: number; r: number; b: number; l: number };
  content: ReturnType<typeof contentAt> | null;
}

/** États de tous les nœuds d'une scène à une frame : même échantillonneur que le renderer. */
export function sceneFrameStates(scene: Scene, fps: number, frame: number): Map<string, NodeFrame> {
  const states = new Map<string, NodeFrame>();
  walk(scene.nodes, (n) => {
    states.set(n.id, {
      s: num(n, 'scale', frame, fps, 1),
      tx: num(n, 'translate_x', frame, fps, 0),
      ty: num(n, 'translate_y', frame, fps, 0),
      opacity: n.opacity * num(n, 'opacity', frame, fps, 1),
      clip: { t: num(n, 'clip_top', frame, fps, 0), r: num(n, 'clip_right', frame, fps, 0), b: num(n, 'clip_bottom', frame, fps, 0), l: num(n, 'clip_left', frame, fps, 0) },
      content: n.type === 'image' ? contentAt(n, frame, fps) : null,
    });
  });
  return states;
}

/** Couleur du fond (sRGB 0..1, opaque) sous un point du canevas, à une frame, sous le nœud `stopAt`. */
export function backgroundAt(
  scene: Scene,
  plan: RenderPlan,
  analyses: ReadonlyMap<string, AssetAnalysis>,
  stopAt: string,
  px: number,
  py: number,
  frame: number,
  states: ReadonlyMap<string, NodeFrame> = sceneFrameStates(scene, plan.canvas.fps, frame),
): [number, number, number] {
  let acc = hexToRgb(scene.background);
  let stopped = false;

  const paint = (nodes: readonly PlanNode[], x: number, y: number, opacity: number) => {
    for (const n of nodes) {
      if (stopped) return;
      if (n.id === stopAt) {
        stopped = true;
        return;
      }
      if (n.type === 'text' || n.type === 'path') continue;
      // Transformation du nœud (translate, scale autour de son origine), puis rognage.
      const st = states.get(n.id)!;
      const ox = n.box.x + n.origin.x * n.box.w;
      const oy = n.box.y + n.origin.y * n.box.h;
      const lx = ox + (x - ox - st.tx) / st.s;
      const ly = oy + (y - oy - st.ty) / st.s;
      const alpha = opacity * st.opacity;
      const inBox = (cx0: number, cy0: number, cx1: number, cy1: number) => lx >= cx0 && lx < cx1 && ly >= cy0 && ly < cy1;
      const clip = st.clip;
      const visible = inBox(
        n.box.x + clip.l * n.box.w,
        n.box.y + clip.t * n.box.h,
        n.box.x + n.box.w * (1 - clip.r),
        n.box.y + n.box.h * (1 - clip.b),
      );
      if (n.type === 'group') {
        paint(n.children, lx, ly, alpha);
        continue;
      }
      if (n.type === 'mask') {
        const ex = (lx - (n.box.x + n.box.w / 2)) / (n.box.w / 2);
        const ey = (ly - (n.box.y + n.box.h / 2)) / (n.box.h / 2);
        const inside = visible && (n.clip.shape === 'rect' || ex * ex + ey * ey <= 1);
        if (inside) paint(n.children, lx, ly, alpha);
        else {
          // Hors de la fenêtre : on ne peint rien, mais un nœud à arrêter peut s'y trouver.
          walk(n.children, (c) => {
            if (c.id === stopAt) stopped = true;
          });
        }
        continue;
      }
      if (!visible || alpha <= 0) continue;
      if (n.type === 'shape') {
        if (!n.fill) continue;
        const ex = (lx - (n.box.x + n.box.w / 2)) / (n.box.w / 2);
        const ey = (ly - (n.box.y + n.box.h / 2)) / (n.box.h / 2);
        if (n.shape === 'ellipse' && ex * ex + ey * ey > 1) continue;
        const c = hexToRgb(n.fill);
        acc = [c[0] * alpha + acc[0] * (1 - alpha), c[1] * alpha + acc[1] * (1 - alpha), c[2] * alpha + acc[2] * (1 - alpha)];
        continue;
      }
      // Image : contenu (mouvement compris) → pixel source → traitement → voile → composition.
      const analysis = analyses.get(n.asset);
      if (!analysis) throw new CompileError('contrast.analysis_missing', `${n.asset} : aucune analyse de pixels, contraste du texte « ${stopAt} » incalculable`);
      const c = st.content!;
      const qx = c.ox + (lx - n.box.x - c.ox - c.tx) / c.s;
      const qy = c.oy + (ly - n.box.y - c.oy - c.ty) / c.s;
      const sx = n.crop.x + (qx * n.crop.w) / n.box.w;
      const sy = n.crop.y + (qy * n.crop.h) / n.box.h;
      const [pr, pg, pb, pa] = sampleAnalysis(analysis, sx, sy);
      const straight: [number, number, number] = pa > 0 ? [pr / pa, pg / pa, pb / pa] : [0, 0, 0];
      const treated = applyTreatment(straight, { ...n.treatment, tint: null });
      // Groupe (image, voile) : image puis voile par-dessus, puis le groupe avec l'opacité du nœud.
      let g: [number, number, number] = [treated[0] * pa, treated[1] * pa, treated[2] * pa];
      let ga = pa;
      if (n.treatment.tint) {
        const t = hexToRgb(n.treatment.tint.color);
        const to = n.treatment.tint.opacity;
        g = [t[0] * to + g[0] * (1 - to), t[1] * to + g[1] * (1 - to), t[2] * to + g[2] * (1 - to)];
        ga = to + ga * (1 - to);
      }
      acc = [g[0] * alpha + acc[0] * (1 - ga * alpha), g[1] * alpha + acc[1] * (1 - ga * alpha), g[2] * alpha + acc[2] * (1 - ga * alpha)];
    }
  };
  paint(scene.nodes, px, py, 1);
  return acc;
}

export interface ContrastInput {
  plan: RenderPlan;
  temporal: TemporalPlan;
  style: CreativeStyleProfile;
  samples: ReadonlyMap<string, TextSamples>;
  analyses: ReadonlyMap<string, AssetAnalysis>;
}

/**
 * Métrique (règles de lisibilité 1.0.0) : pour chaque glyphe, contraste
 * (texte / fond composité) en chaque point d'une grille posée sur son ENCRE
 * (pas de 4 px de référence) ; score du glyphe = 10e centile de ces contrastes
 * (les 10 % les plus défavorables de sa surface) ; score du texte = minimum sur
 * tous les glyphes, toutes ses couleurs et toutes les frames où il est stable.
 * Local par construction : un seul glyphe illisible suffit à faire échouer.
 */
export const GLYPH_QUANTILE = 0.1;
export const SAMPLE_STEP_REF_PX = 4;

/** Points d'échantillonnage d'un glyphe : grille au pas donné sur son encre (au moins son centre). */
export function glyphPoints(glyph: GlyphSample, step: number): [number, number][] {
  const points: [number, number][] = [];
  for (let y = glyph.y0 + step / 2; y < glyph.y1; y += step) {
    for (let x = glyph.x0 + step / 2; x < glyph.x1; x += step) points.push([x, y]);
  }
  if (points.length === 0) points.push([(glyph.x0 + glyph.x1) / 2, (glyph.y0 + glyph.y1) / 2]);
  return points;
}

/**
 * Score de contraste d'un ensemble de glyphes face à un fond donné par une
 * fonction (fond PRÉDIT par le cœur, ou pixels RÉELS d'un rendu : même code,
 * ce qui permet de confronter la métrique à ce que Chromium dessine).
 */
export function scoreGlyphs(
  glyphs: readonly GlyphSample[],
  step: number,
  background: (x: number, y: number) => readonly [number, number, number],
): { measured: number; worst: { run: string; line: number }; points: number } {
  let measured = Infinity;
  let worst = { run: glyphs[0]?.run ?? '', line: 0 };
  let points = 0;
  for (const glyph of glyphs) {
    const luminances = glyphPoints(glyph, step).map(([x, y]) => relativeLuminanceRgb(...background(x, y)));
    points += luminances.length;
    for (const color of glyph.colors) {
      const text = relativeLuminanceRgb(...hexToRgb(color));
      const ratios = luminances.map((l) => contrastOfLuminances(text, l)).sort((a, b) => a - b);
      const score = quantile(ratios, GLYPH_QUANTILE);
      if (score < measured - EPS) {
        measured = score;
        worst = { run: glyph.run, line: glyph.line };
      }
    }
  }
  return { measured, worst, points };
}

export function measureContrast(input: ContrastInput): { contrasts: Map<string, PlanTextContrast>; samples: number } {
  const { plan, temporal, style } = input;
  const fps = plan.canvas.fps;
  const step = (SAMPLE_STEP_REF_PX * plan.canvas.width) / style.reference_canvas.width;
  const contrasts = new Map<string, PlanTextContrast>();
  let evaluated = 0;
  for (const [layer, samples] of input.samples) {
    const scene = plan.scenes.find((s) => s.id === samples.scene)!;
    const timing = temporal.scenes.find((s) => s.id === samples.scene)!;
    // Fenêtre stable : de la fin de l'entrée du texte au début de sa sortie.
    const own = timing.behaviors.filter((b) => b.layer === layer);
    const entered = Math.max(timing.start_ms, ...own.filter((b) => b.phase === 'enter').map((b) => b.end_ms));
    const leaving = Math.min(timing.end_ms, ...own.filter((b) => b.phase === 'exit').map((b) => b.start_ms));
    const from = Math.min(scene.to - 1, Math.max(scene.from, msToFrame(entered, fps)));
    const to = Math.max(from + 1, Math.min(scene.to, msToFrame(leaving, fps)));
    // Toutes les frames si un calque animé peut passer sous l'encre du texte, sinon une seule.
    // (Sans effet sur le résultat : un calque qui ne couvre jamais l'encre ne la peint jamais.)
    const window = Array.from({ length: to - from }, (_, i) => from + i);
    const ink = samples.glyphs.reduce(
      (b, g) => ({ x0: Math.min(b.x0, g.x0), y0: Math.min(b.y0, g.y0), x1: Math.max(b.x1, g.x1), y1: Math.max(b.y1, g.y1) }),
      { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
    );
    const moving = scene.nodes.some((top) => {
      if (top.id === layer || top.type === 'text' || top.type === 'path') return false;
      let animated = false;
      walk([top], (n) => {
        if (n.tracks.length > 0) animated = true;
      });
      if (!animated) return false;
      // Emprise du calque de premier niveau sur la fenêtre (groupes : leurs enfants ; ailleurs : la boîte).
      const boxes: { x: number; y: number; w: number; h: number }[] = [];
      if (top.type === 'group') walk(top.children, (c) => boxes.push(c.box));
      else boxes.push(top.box);
      return window.some((f) => {
        const s = num(top, 'scale', f, fps, 1);
        const tx = num(top, 'translate_x', f, fps, 0);
        const ty = num(top, 'translate_y', f, fps, 0);
        const ox = top.box.x + top.origin.x * top.box.w;
        const oy = top.box.y + top.origin.y * top.box.h;
        return boxes.some((b) => {
          const x0 = ox + (b.x - ox) * s + tx;
          const y0 = oy + (b.y - oy) * s + ty;
          const x1 = ox + (b.x + b.w - ox) * s + tx;
          const y1 = oy + (b.y + b.h - oy) * s + ty;
          return Math.min(x0, x1) < ink.x1 && Math.max(x0, x1) > ink.x0 && Math.min(y0, y1) < ink.y1 && Math.max(y0, y1) > ink.y0;
        });
      });
    });
    const frames = moving ? window : [from];

    const category = textCategory(samples.size, samples.weight, plan.canvas.width);
    const floor = Math.max(CONTRAST_FLOORS[category], style.rhythm_personality.reading.min_contrast[category]);
    let measured = Infinity;
    let worst = { run: samples.glyphs[0]?.run ?? layer, line: 0, frame: from };
    for (const frame of frames) {
      const states = sceneFrameStates(scene, fps, frame);
      const scored = scoreGlyphs(samples.glyphs, step, (x, y) => backgroundAt(scene, plan, input.analyses, layer, x, y, frame, states));
      evaluated += scored.points;
      if (scored.measured < measured - EPS) {
        measured = scored.measured;
        worst = { ...scored.worst, frame };
      }
    }
    const required = samples.override ? samples.override.min_ratio : floor;
    const rounded = Math.floor(measured * 100) / 100;
    contrasts.set(layer, { category, required, measured: rounded, worst, frames: frames.length, override: samples.override });
    if (measured + EPS < required) {
      throw new CompileError(
        'contrast.insufficient',
        `${layer} : contraste mesuré ${rounded.toFixed(2)}:1 < ${required}:1 exigé (${category === 'large' ? 'grand texte' : 'texte courant'}` +
          `${samples.override ? ', dérogation explicite' : ''}) — pire glyphe du run « ${worst.run} », ligne ${worst.line}, frame ${worst.frame}. ` +
          `Aucune correction automatique : changer la couleur, le traitement, le recadrage ou le placement.`,
      );
    }
  }
  return { contrasts, samples: evaluated };
}
