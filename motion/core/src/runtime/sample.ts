import type { Keyframe, Track, TrackProperty } from '../contracts/render-plan.ts';
import { evaluateEasing } from './easing.ts';

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(rgb: readonly number[]): string {
  return `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function mixColor(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((v, i) => v + (cb[i]! - v) * k));
}

/**
 * Valeur d'une piste à une frame. Avant la première clé : valeur de la
 * première clé ; après la dernière : valeur de la dernière. La courbe portée
 * par une clé s'applique jusqu'à la clé suivante.
 */
export function sampleTrack(track: Pick<Track, 'keys'>, frame: number, fps: number): number | string {
  const keys: readonly Keyframe[] = track.keys;
  const first = keys[0]!;
  if (frame <= first.frame) return first.value;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (frame < b.frame) {
      const span = b.frame - a.frame;
      const e = evaluateEasing(a.ease, (frame - a.frame) / span, span / fps);
      if (typeof a.value === 'string' || typeof b.value === 'string') {
        return mixColor(String(a.value), String(b.value), e);
      }
      return a.value + (b.value - a.value) * e;
    }
  }
  return keys[keys.length - 1]!.value;
}

export interface TrackTarget {
  run?: string | undefined;
  line?: number | undefined;
}

/** Valeur courante d'une propriété pour une cible donnée, ou `fallback` s'il n'existe aucune piste. */
export function sampleProperty(
  tracks: readonly Track[],
  property: TrackProperty,
  target: TrackTarget,
  frame: number,
  fps: number,
  fallback: number | string,
): number | string {
  const track = tracks.find(
    (t) => t.property === property && t.target?.run === target.run && t.target?.line === target.line,
  );
  return track ? sampleTrack(track, frame, fps) : fallback;
}
