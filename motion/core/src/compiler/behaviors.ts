import type { BehaviorInstance } from '../contracts/motion-spec.ts';
import type { Keyframe, Track, TrackProperty } from '../contracts/render-plan.ts';
import type { CreativeStyleProfile, Easing } from '../contracts/style-profile.ts';
import type { BehaviorInfo, SemanticRegistry } from '../validation/semantic-spec.ts';
import type { Interval } from './timeline.ts';
import { toFrame } from './timeline.ts';

// Grammaire de mouvement minimale (P1.2). Chaque comportement décrit une FORME
// générique ; ses amplitudes, ses courbes et ses durées viennent du style et
// de la spec. Les proportions ci-dessous définissent la forme du geste, pas
// une marque : elles sont les mêmes pour tous les styles.

/** Part de l'accent consacrée au changement de couleur. */
const ACCENT_COLOR_SHARE = 0.5;
/** Instant du pic de micro-échelle, en part de la durée de l'accent. */
const ACCENT_PEAK_SHARE = 0.4;

export class BehaviorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BehaviorError';
  }
}

const SUPPORTED_BEHAVIORS: Record<string, BehaviorInfo> = {
  REVEAL_TEXT: { applies_to: ['text'], variants: ['mask_up', 'fade_up'] },
  ACCENT_WORD: { applies_to: ['text'], variants: ['color_settle', 'color_only'] },
  DRAW_PATH: { applies_to: ['path'], variants: [] },
  CUT: { applies_to: ['text', 'shape', 'path', 'group'], variants: [] },
};

/** Comportements que ce compilateur sait réellement produire (P1.2). */
export const BEHAVIOR_REGISTRY: SemanticRegistry = {
  behavior: (id) => SUPPORTED_BEHAVIORS[id],
};

export function supportedBehaviors(): string[] {
  return Object.keys(SUPPORTED_BEHAVIORS).sort();
}

interface Point {
  ms: number;
  value: number | string;
  ease?: Easing;
}

export interface SceneFrames {
  from: number;
  to: number;
  fps: number;
}

/** Clés strictement croissantes, dans les bornes de la scène. */
export function keysFromPoints(points: readonly Point[], scene: SceneFrames): Keyframe[] {
  const keys: Keyframe[] = [];
  let previous = scene.from - 1;
  for (const p of points) {
    let frame = Math.max(scene.from, toFrame(p.ms, scene.fps));
    if (frame <= previous) frame = previous + 1;
    if (frame >= scene.to) throw new BehaviorError(`clé à la frame ${frame} hors de la scène [${scene.from}, ${scene.to})`);
    const key: Keyframe = { frame, value: p.value };
    if (p.ease) key.ease = p.ease;
    keys.push(key);
    previous = frame;
  }
  return keys;
}

export interface TextContext {
  kind: 'text';
  lineCount: number;
  /** Couleur de départ de chaque run (avant accent). */
  runBaseColor: ReadonlyMap<string, string>;
  accentColor: string | null;
}

export interface PathContext {
  kind: 'path';
}

export interface ExpandInput {
  behavior: BehaviorInstance;
  interval: Interval;
  style: CreativeStyleProfile;
  scale: number;
  beatMs: number;
  scene: SceneFrames;
  target: TextContext | PathContext;
}

function ease(style: CreativeStyleProfile, role: 'enter' | 'exit' | 'inout' | 'settle'): Easing {
  const easing = style.motion_personality.easings[role];
  if (!easing) throw new BehaviorError(`courbe « ${role} » absente du style`);
  return easing;
}

function track(property: TrackProperty, points: Point[], input: ExpandInput, target?: Track['target']): Track {
  const t: Track = { property, keys: keysFromPoints(points, input.scene), source: input.behavior.id };
  if (target) t.target = target;
  return t;
}

export function expandBehavior(input: ExpandInput): Track[] {
  const { behavior: b, interval, style } = input;
  const start = interval.start_ms;
  const d = interval.end_ms - interval.start_ms;

  switch (b.behavior) {
    case 'REVEAL_TEXT': {
      if (input.target.kind !== 'text') throw new BehaviorError(`${b.id} : REVEAL_TEXT exige un texte`);
      const staggerBeats = typeof b.params?.['stagger_beats'] === 'number' ? b.params['stagger_beats'] : 0;
      const travelKey = b.params?.['travel'];
      if (typeof travelKey !== 'string' || style.space[travelKey] === undefined) {
        throw new BehaviorError(`${b.id} : amplitude « ${String(travelKey)} » absente des espacements du style`);
      }
      const travel = style.space[travelKey] * input.scale;
      const stagger = staggerBeats * input.beatMs;
      const tracks: Track[] = [];
      for (let line = 0; line < input.target.lineCount; line++) {
        const t0 = start + line * stagger;
        const t1 = t0 + d;
        const enter = ease(style, 'enter');
        if (b.variant === 'mask_up') {
          tracks.push(track('clip_top', [{ ms: t0, value: 1, ease: enter }, { ms: t1, value: 0 }], input, { line }));
        } else if (b.variant === 'fade_up') {
          tracks.push(track('opacity', [{ ms: t0, value: 0, ease: enter }, { ms: t1, value: 1 }], input, { line }));
        } else {
          throw new BehaviorError(`${b.id} : variante « ${String(b.variant)} » de REVEAL_TEXT non prise en charge`);
        }
        tracks.push(track('translate_y', [{ ms: t0, value: travel, ease: enter }, { ms: t1, value: 0 }], input, { line }));
      }
      return tracks;
    }
    case 'ACCENT_WORD': {
      if (input.target.kind !== 'text') throw new BehaviorError(`${b.id} : ACCENT_WORD exige un texte`);
      const run = b.target?.run;
      const base = run ? input.target.runBaseColor.get(run) : undefined;
      if (!run || !base || !input.target.accentColor) throw new BehaviorError(`${b.id} : run ou couleur d'accent introuvable`);
      const tracks = [
        track(
          'color',
          [
            { ms: start, value: base, ease: ease(style, 'inout') },
            { ms: start + d * ACCENT_COLOR_SHARE, value: input.target.accentColor },
          ],
          input,
          { run },
        ),
      ];
      const overshoot = style.motion_personality.max_overshoot;
      if (b.variant === 'color_settle' && overshoot > 0) {
        tracks.push(
          track(
            'scale',
            [
              { ms: start, value: 1, ease: ease(style, 'enter') },
              { ms: start + d * ACCENT_PEAK_SHARE, value: 1 + overshoot, ease: ease(style, 'settle') },
              { ms: start + d, value: 1 },
            ],
            input,
            { run },
          ),
        );
      } else if (b.variant !== 'color_settle' && b.variant !== 'color_only') {
        throw new BehaviorError(`${b.id} : variante « ${String(b.variant)} » d'ACCENT_WORD non prise en charge`);
      }
      return tracks;
    }
    case 'DRAW_PATH': {
      if (input.target.kind !== 'path') throw new BehaviorError(`${b.id} : DRAW_PATH exige un tracé`);
      return [track('path_progress', [{ ms: start, value: 0, ease: ease(style, 'enter') }, { ms: start + d, value: 1 }], input)];
    }
    case 'CUT':
      return [];
    default:
      throw new BehaviorError(`${b.id} : comportement ${b.behavior} non pris en charge en P1.2`);
  }
}
