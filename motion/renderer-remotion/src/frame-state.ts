import { sampleProperty } from '@motion-engine/core/runtime';
import type { PlanImageNode, PlanMaskNode, PlanNode, PlanScene, RenderPlan, Track, TrackProperty } from '@motion-engine/core/runtime';

// État visuel d'un nœud à une frame donnée : pure traduction du Render Plan.
// Aucune décision artistique ici — seulement l'échantillonnage des pistes.

const num = (tracks: readonly Track[], property: TrackProperty, frame: number, fps: number, fallback: number, target: { run?: string; line?: number } = {}) =>
  Number(sampleProperty(tracks, property, target, frame, fps, fallback));

export interface NodeState {
  opacity: number;
  transform: string;
  transformOrigin: string;
}

/** Transformations au niveau du nœud (pistes sans cible). */
export function nodeState(node: PlanNode, frame: number, fps: number): NodeState {
  const t = node.tracks;
  const opacity = node.opacity * num(t, 'opacity', frame, fps, 1);
  const tx = num(t, 'translate_x', frame, fps, 0);
  const ty = num(t, 'translate_y', frame, fps, 0);
  const scale = num(t, 'scale', frame, fps, 1);
  const rotate = num(t, 'rotate', frame, fps, 0);
  return {
    opacity,
    transform: `translate(${tx}px, ${ty}px) rotate(${rotate}deg) scale(${scale})`,
    transformOrigin: `${node.origin.x * 100}% ${node.origin.y * 100}%`,
  };
}

export interface LineState {
  opacity: number;
  translateX: number;
  translateY: number;
  /** `undefined` quand aucun côté n'est rogné : le contenu peut déborder de sa boîte de ligne. */
  clipPath: string | undefined;
}

export function lineState(node: PlanNode, line: number, frame: number, fps: number): LineState {
  const t = node.tracks;
  const target = { line };
  const clip = {
    top: num(t, 'clip_top', frame, fps, 0, target),
    right: num(t, 'clip_right', frame, fps, 0, target),
    bottom: num(t, 'clip_bottom', frame, fps, 0, target),
    left: num(t, 'clip_left', frame, fps, 0, target),
  };
  const clipped = clip.top > 0 || clip.right > 0 || clip.bottom > 0 || clip.left > 0;
  return {
    opacity: num(t, 'opacity', frame, fps, 1, target),
    translateX: num(t, 'translate_x', frame, fps, 0, target),
    translateY: num(t, 'translate_y', frame, fps, 0, target),
    clipPath: clipped
      ? `inset(${clip.top * 100}% ${clip.right * 100}% ${clip.bottom * 100}% ${clip.left * 100}%)`
      : undefined,
  };
}

export interface RunState {
  color: string;
  scale: number;
}

export function runState(node: PlanNode, runId: string, baseColor: string, frame: number, fps: number): RunState {
  const target = { run: runId };
  return {
    color: String(sampleProperty(node.tracks, 'color', target, frame, fps, baseColor)),
    scale: num(node.tracks, 'scale', frame, fps, 1, target),
  };
}

export function pathProgress(node: PlanNode, frame: number, fps: number): number {
  return Math.min(1, Math.max(0, num(node.tracks, 'path_progress', frame, fps, 1)));
}

/**
 * Géométrie d'une image : le recadrage du plan (pixels source) projeté dans la
 * boîte. Aucune décision de cadrage ici — ni cover, ni contain, ni point focal.
 */
export function imageGeometry(node: PlanImageNode, asset: { width: number; height: number }) {
  const kx = node.box.w / node.crop.w;
  const ky = node.box.h / node.crop.h;
  return { left: -node.crop.x * kx, top: -node.crop.y * ky, width: asset.width * kx, height: asset.height * ky };
}

/** Filtre CSS équivalent au traitement résolu par le compilateur. */
export function imageFilter(node: PlanImageNode): string {
  return `grayscale(${node.treatment.grayscale}) contrast(${node.treatment.contrast})`;
}

/** Fenêtre d'un masque : forme et rayon viennent du plan. */
export function maskRadius(node: PlanMaskNode): string {
  return node.clip.shape === 'ellipse' ? '50%' : `${node.clip.radius}px`;
}

/** Scène active à une frame (frames de fin exclusives). */
export function sceneAt(plan: RenderPlan, frame: number): PlanScene | undefined {
  return plan.scenes.find((s) => frame >= s.from && frame < s.to);
}

/** Les primitives que ce renderer sait dessiner (P1.4 : toutes). */
export const SUPPORTED_NODE_TYPES = ['text', 'shape', 'path', 'group', 'image', 'mask'] as const;

export function unsupportedNodes(plan: RenderPlan): string[] {
  const out: string[] = [];
  const visit = (node: PlanNode) => {
    if (!(SUPPORTED_NODE_TYPES as readonly string[]).includes(node.type)) out.push(`${node.id} (${node.type})`);
    if (node.type === 'group' || node.type === 'mask') node.children.forEach(visit);
  };
  plan.scenes.forEach((s) => s.nodes.forEach(visit));
  return out;
}
