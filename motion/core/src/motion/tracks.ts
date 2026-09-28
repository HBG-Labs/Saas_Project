import type { EasingRole, MotionProperty, TrackTemplate, ValueSource } from '../contracts/behavior.ts';
import type { Keyframe, Track } from '../contracts/render-plan.ts';
import type { CreativeStyleProfile, Easing } from '../contracts/style-profile.ts';
import { sampleTrack } from '../runtime/sample.ts';
import type { ResolvedBehavior, TemporalPlan } from '../temporal/engine.ts';
import { toSceneFrames } from '../temporal/frames.ts';
import { resolveEasing } from './easing-catalog.ts';

// Compilation des pistes : gabarits du registre + temps résolus + style →
// pistes concrètes. Tout le « comment » du mouvement se décide ici ; le
// renderer n'en recevra que le résultat (propriété, clés, courbes résolues).

export class TrackError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'TrackError';
    this.code = code;
  }
}

/** Ce que le compilateur de pistes doit savoir d'un calque déjà mis en page. */
export interface LayerContext {
  scene: string;
  baseColor: string | null;
  accentColor: string | null;
  runBaseColor: ReadonlyMap<string, string>;
}

export interface TrackCompileInput {
  temporal: TemporalPlan;
  style: CreativeStyleProfile;
  /** Facteur entre le canevas de référence du style et la sortie. */
  scale: number;
  fps: number;
  reducedMotion: boolean;
  layers: ReadonlyMap<string, LayerContext>;
  sceneFrames: ReadonlyMap<string, { from: number; to: number }>;
}

interface MsKey {
  ms: number;
  value: number | string;
  ease?: Easing;
}

interface MsTrack {
  layer: string;
  property: MotionProperty;
  target: { run?: string; line?: number } | undefined;
  source: string;
  keys: MsKey[];
}

const targetKey = (t: MsTrack['target']) => (t?.run !== undefined ? `run:${t.run}` : t?.line !== undefined ? `line:${t.line}` : 'layer');
const trackKey = (layer: string, property: string, target: MsTrack['target']) => `${layer}|${property}|${targetKey(target)}`;

function restValue(property: MotionProperty, baseColor: string | null): number | string {
  switch (property) {
    case 'opacity':
    case 'scale':
    case 'path_progress':
    case 'content_scale':
      return 1;
    case 'translate_x':
    case 'translate_y':
    case 'content_x':
    case 'content_y':
    case 'clip_top':
    case 'clip_right':
    case 'clip_bottom':
    case 'clip_left':
      return 0;
    case 'color':
      if (!baseColor) throw new TrackError('motion.color_unavailable', 'couleur de base absente pour une piste de couleur');
      return baseColor;
  }
}

/** Applique la stratégie « mouvement réduit » du comportement. */
function reduce(b: ResolvedBehavior, templates: readonly TrackTemplate[], reducedMotion: boolean): { templates: TrackTemplate[]; instant: boolean } {
  if (!reducedMotion) return { templates: [...templates], instant: false };
  const strategy = b.definition.reduced_motion_strategy;
  if (strategy.strategy === 'drop_properties') {
    return { templates: templates.filter((t) => !strategy.properties.includes(t.property)), instant: false };
  }
  // « static » (P1.5) : aucune piste, l'élément reste dans son état de repos.
  if (strategy.strategy === 'static') return { templates: [], instant: false };
  return { templates: [...templates], instant: strategy.strategy === 'instant' };
}

export interface CompiledTracks {
  /** Pistes par calque, fusionnées par (propriété, cible). */
  byLayer: Map<string, Track[]>;
}

export function compileTracks(input: TrackCompileInput): CompiledTracks {
  const { style, scale } = input;
  const all = new Map<string, MsTrack[]>();

  /** État d'une propriété à un instant, d'après les pistes déjà produites. */
  const current = (layer: string, property: MotionProperty, target: MsTrack['target'], ms: number, rest: number | string) => {
    const tracks = (all.get(trackKey(layer, property, target)) ?? []).filter((t) => t.keys[0]!.ms <= ms);
    const last = tracks[tracks.length - 1];
    if (!last) return rest;
    return sampleTrack({ keys: last.keys.map((k) => ({ frame: k.ms, value: k.value, ...(k.ease ? { ease: k.ease } : {}) })) }, ms, 1000);
  };

  const behaviors = input.temporal.scenes.flatMap((scene) =>
    [...scene.behaviors].sort((a, b) => a.start_ms - b.start_ms || a.declaration_index - b.declaration_index),
  );

  for (const b of behaviors) {
    if (b.definition.scope === 'transition') continue;
    const variant = b.definition.variants[b.variant];
    if (!variant) throw new TrackError('behavior.variant_unknown', `${b.instance} : variante « ${b.variant} » inconnue de ${b.behavior}@${b.version}`);
    const context = input.layers.get(b.layer);
    if (!context) throw new TrackError('motion.layer_unknown', `${b.instance} : calque ${b.layer} non mis en page`);
    const { templates, instant } = reduce(b, variant.tracks, input.reducedMotion);

    for (const template of templates) {
      const targets: { target: MsTrack['target']; start: number; end: number }[] =
        template.scope === 'line'
          ? b.lanes.map((lane) => ({ target: { line: lane.unit ?? 0 }, start: lane.start_ms, end: lane.end_ms }))
          : [{ target: template.scope === 'run' && b.target_run ? { run: b.target_run } : undefined, start: b.start_ms, end: b.end_ms }];

      for (const { target, start, end } of targets) {
        const baseColor = target?.run !== undefined ? (context.runBaseColor.get(target.run) ?? context.baseColor) : context.baseColor;
        const rest = template.property === 'color' ? restValue('color', baseColor) : restValue(template.property, baseColor);
        const valueOf = (source: ValueSource, at: number): number | string => {
          switch (source.kind) {
            case 'const':
              return source.value;
            case 'rest':
              return rest;
            case 'current':
              return current(b.layer, template.property, target, at, rest);
            case 'color': {
              const color = source.role === 'accent' ? context.accentColor : baseColor;
              if (!color) throw new TrackError('motion.color_unavailable', `${b.instance} : couleur « ${source.role} » absente du calque`);
              return color;
            }
            case 'amplitude': {
              const override = b.params[source.name];
              let value: number;
              const amplitude = style.motion_personality.amplitude;
              if (source.name === 'accent_scale') value = amplitude.accent_scale;
              else if (source.name === 'image_push_scale' || source.name === 'image_pan_scale') {
                // Échelles d'image : jamais de valeur par défaut, un style sans amplitude refuse le mouvement.
                const factor = amplitude[source.name];
                if (factor === null) throw new TrackError('motion.amplitude_missing', `${b.instance} : le style ne définit pas « ${source.name} » (${b.behavior} indisponible)`);
                value = factor;
              } else {
                const key = typeof override === 'string' ? override : amplitude[source.name];
                if (key === null) throw new TrackError('motion.amplitude_missing', `${b.instance} : le style ne définit pas « ${source.name} » (${b.behavior} indisponible)`);
                const space = style.space[key];
                if (space === undefined) throw new TrackError('motion.amplitude_unknown', `${b.instance} : espacement « ${key} » absent du style`);
                value = space * scale;
              }
              return source.negate ? -value : value;
            }
          }
        };
        const ease = (role: EasingRole | undefined) => (role ? resolveEasing(style, role) : undefined);
        let keys: MsKey[] = template.keys.map((k) => {
          const ms = start + Math.round(k.at * (end - start));
          const key: MsKey = { ms, value: valueOf(k.value, ms) };
          const e = ease(k.ease);
          if (e) key.ease = e;
          return key;
        });
        if (instant) keys = [{ ms: start, value: keys[0]!.value }, { ms: start + 1, value: keys[keys.length - 1]!.value }];
        // Aucun changement ET déjà au repos : pas de piste. Une valeur constante hors repos (échelle
        // tenue pendant un panoramique, P1.5) est une piste à part entière.
        if (keys.every((k) => k.value === keys[0]!.value) && keys[0]!.value === rest) continue;

        const id = trackKey(b.layer, template.property, target);
        const list = all.get(id) ?? [];
        list.push({ layer: b.layer, property: template.property, target, source: b.instance, keys });
        all.set(id, list);
      }
    }
  }

  // Conflits : deux comportements qui animent la même propriété de la même
  // cible pendant un même intervalle. Jamais de « dernier qui écrit gagne ».
  for (const [id, list] of all) {
    const sorted = [...list].sort((a, b) => a.keys[0]!.ms - b.keys[0]!.ms);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const next = sorted[i]!;
      if (next.keys[0]!.ms < prev.keys[prev.keys.length - 1]!.ms) {
        throw new TrackError('motion.track_conflict', `${prev.source} et ${next.source} animent ${id.replaceAll('|', ' / ')} sur des intervalles qui se chevauchent`);
      }
    }
    all.set(id, sorted);
  }

  // Fusion par (propriété, cible) et conversion en frames, en dernier.
  const byLayer = new Map<string, Track[]>();
  for (const list of all.values()) {
    const first = list[0]!;
    const frames = input.sceneFrames.get(input.layers.get(first.layer)!.scene)!;
    const merged: MsKey[] = [];
    for (const track of list) {
      const previous = merged[merged.length - 1];
      const head = track.keys[0]!;
      // Entre deux comportements, la valeur est TENUE (pas d'interpolation parasite).
      if (previous && head.ms > previous.ms + 1 && previous.value !== head.value) merged.push({ ms: head.ms - 1, value: previous.value });
      merged.push(...track.keys);
    }
    const frameList = toSceneFrames(merged.map((k) => k.ms), input.fps, frames.from, frames.to);
    const keys: Keyframe[] = merged.map((k, i) => ({ frame: frameList[i]!, value: k.value, ...(k.ease ? { ease: k.ease } : {}) }));
    const track: Track = { property: first.property, keys, sources: [...new Set(list.map((t) => t.source))] };
    if (first.target) track.target = first.target;
    const existing = byLayer.get(first.layer) ?? [];
    existing.push(track);
    byLayer.set(first.layer, existing);
  }
  return { byLayer };
}
