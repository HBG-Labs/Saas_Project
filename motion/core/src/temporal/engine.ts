import type { BehaviorDefinition, BehaviorPhase } from '../contracts/behavior.ts';
import { anchorKind, isEndAnchor } from '../contracts/common.ts';
import type { Anchor, Duration, Offset, RhythmPhase } from '../contracts/common.ts';
import type { BehaviorInstance, Layer, MotionSceneSpec, Scene } from '../contracts/motion-spec.ts';
import type { CreativeStyleProfile } from '../contracts/style-profile.ts';
import type { BehaviorRegistry } from '../motion/registry.ts';
import { findWordMatches } from '../text/voice-words.ts';
import { voiceOnlyIntervals } from './activity.ts';
import type { Interval } from './activity.ts';
import { readingTime } from './readability.ts';
import type { ReadingRequirement } from './readability.ts';
import { estimateSpeech } from './speech.ts';
import type { SpeechTiming } from './speech.ts';

// Moteur temporel déterministe. Tout est en MILLISECONDES ENTIÈRES, en temps
// local de scène, puis placé en temps absolu. Aucune frame ici : la
// conversion appartient au compilateur, en toute fin.

export class TemporalError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'TemporalError';
    this.code = code;
  }
}

export const SCENE_PHASES = ['ENTER', 'ACCENT', 'SETTLE', 'HOLD', 'EXIT', 'CUT'] as const;
export type ScenePhase = (typeof SCENE_PHASES)[number];

/** `ambient` (P1.5) n'est pas une phase de scène : il accompagne la scène entière. */
const PHASE_OF: Record<Exclude<BehaviorPhase, 'transition' | 'ambient'>, ScenePhase> = {
  enter: 'ENTER',
  accent: 'ACCENT',
  settle: 'SETTLE',
  exit: 'EXIT',
};

export interface Lane {
  /** Index de ligne pour les pistes « line », null sinon. */
  unit: number | null;
  start_ms: number;
  end_ms: number;
}

export interface ResolvedBehavior {
  instance: string;
  behavior: string;
  version: string;
  definition: BehaviorDefinition;
  variant: string;
  phase: BehaviorPhase;
  layer: string;
  primitive: Layer['primitive'];
  target_run: string | null;
  /** Durée d'une unité (ligne) ; `locked` si imposée par la spec. */
  duration_ms: number;
  duration_locked: boolean;
  stagger_ms: number;
  start_ms: number;
  end_ms: number;
  lanes: Lane[];
  declaration_index: number;
  params: Record<string, number | string | boolean>;
  /**
   * P1.5 : `scene_end` — dure jusqu'à la dernière milliseconde de la scène,
   * résolu APRÈS la durée de la scène, dont il ne dépend jamais.
   */
  span: 'scene_end' | null;
}

export interface PhaseSpan {
  phase: ScenePhase;
  start_ms: number;
  end_ms: number;
}

export interface TemporalScene {
  id: string;
  rhythm_phase: RhythmPhase;
  beat_ms: number;
  energy: 'low' | 'medium' | 'high';
  energy_factor: number;
  start_ms: number;
  end_ms: number;
  speech: SpeechTiming[];
  behaviors: ResolvedBehavior[];
  events: Record<string, number>;
  phases: PhaseSpan[];
  hold: { ms: number; min_ms: number; preferred_ms: number; max_ms: number };
  /** Plage admissible de la fin de scène (temps local) avant ajustement global. */
  range: { min_ms: number; preferred_ms: number; max_ms: number; fixed: boolean };
  readability: { layer: string; requirement: ReadingRequirement; stable_ms: number }[];
  /** Annotation dérivée (pas une phase) : la voix continue, aucun comportement visuel actif. */
  voice_only: Interval[];
  transition_out: { behavior: string; version: string; at_ms: number } | null;
}

export interface TemporalPlan {
  scenes: TemporalScene[];
  total_ms: number;
  timing_source: 'estimated' | 'none';
  /** Ajustement appliqué pour tenir la durée cible (ms, signé). */
  fitted_ms: number;
  warnings: { code: string; message: string }[];
}

export interface TemporalInput {
  spec: MotionSceneSpec;
  style: CreativeStyleProfile;
  registry: BehaviorRegistry;
}

function flatten(layers: readonly Layer[]): Layer[] {
  return layers.flatMap((l) => (l.primitive === 'group' || l.primitive === 'mask' ? [l, ...flatten(l.children)] : [l]));
}

function lineCount(layer: Layer): number {
  if (layer.primitive !== 'text') return 1;
  return layer.content.runs.filter((r) => r.break_after).length + 1;
}

interface SceneContext {
  scene: Scene;
  style: CreativeStyleProfile;
  phase: RhythmPhase;
  beatMs: number;
  factor: number;
  ms: (d: Duration | Offset) => number;
}

function sceneContext(spec: MotionSceneSpec, scene: Scene, style: CreativeStyleProfile): SceneContext {
  const section = spec.rhythm.sections.find((s) => s.scenes.includes(scene.id));
  if (!section) throw new TemporalError('temporal.no_section', `scène ${scene.id} hors des sections de rythme`);
  const beatMs = style.rhythm_personality.tempo.beat_ms[section.phase];
  const energy = scene.pattern.variation.energy ?? 'medium';
  const factor = style.motion_personality.timing.energy[energy];
  const ms = (d: Duration | Offset) =>
    Math.round('beats' in d ? d.beats * beatMs : d.breaths * style.rhythm_personality.tempo.breath_ms);
  return { scene, style, phase: section.phase, beatMs, factor, ms };
}

/** Durée d'un comportement : verrou de la spec, sinon durée de phase du style × énergie. */
function behaviorDuration(ctx: SceneContext, b: BehaviorInstance, def: BehaviorDefinition): { ms: number; locked: boolean; span: 'scene_end' | null } {
  const until = b.duration !== undefined && 'until' in b.duration;
  if (def.phase === 'ambient' || def.constraints.until_scene_end === 'required') {
    if (!until) throw new TemporalError('temporal.span_required', `${b.id} : ${b.behavior} dure jusqu'à la fin de la scène (duration: { until: 'scene_end' })`);
    // Durée inconnue tant que la scène n'est pas placée : 0 ici, résolue dans place().
    return { ms: 0, locked: true, span: 'scene_end' };
  }
  if (until) throw new TemporalError('temporal.span_not_allowed', `${b.id} : ${b.behavior} n'accepte pas une durée « jusqu'à la fin de la scène »`);
  if (def.phase === 'transition') return { ms: 0, locked: true, span: null };
  if (b.duration && !('until' in b.duration)) return { ms: ctx.ms(b.duration), locked: true, span: null };
  const t = ctx.style.motion_personality.timing;
  const beats = { enter: t.enter_beats, accent: t.accent_beats, settle: t.settle_beats, exit: t.exit_beats }[def.phase];
  return { ms: Math.round(beats * ctx.factor * ctx.beatMs), locked: false, span: null };
}

const usesLines = (def: BehaviorDefinition): boolean => Object.values(def.variants).some((v) => v.tracks.some((t) => t.scope === 'line'));

function staggerMs(ctx: SceneContext, b: BehaviorInstance, def: BehaviorDefinition): number {
  if (!usesLines(def)) return 0;
  const param = b.params?.['stagger_beats'];
  const beats = typeof param === 'number' ? param : ctx.style.motion_personality.timing.stagger_beats * ctx.factor;
  return Math.round(beats * ctx.beatMs);
}

/** Nombre de voies (lignes) d'un comportement : une par ligne s'il anime des lignes, même sans décalage. */
const laneCount = (b: ResolvedBehavior, lines: number): number => (usesLines(b.definition) ? lines : 1);

function withLanes(b: ResolvedBehavior, start: number, lines: number): void {
  const lanes = laneCount(b, lines);
  b.start_ms = start;
  b.lanes = Array.from({ length: lanes }, (_, i) => ({
    unit: usesLines(b.definition) ? i : null,
    start_ms: start + i * b.stagger_ms,
    end_ms: start + i * b.stagger_ms + b.duration_ms,
  }));
  b.end_ms = b.lanes[b.lanes.length - 1]!.end_ms;
}

interface LocalScene {
  ctx: SceneContext;
  speech: SpeechTiming[];
  behaviors: ResolvedBehavior[];
  events: Record<string, number>;
  contentEnd: number;
  exitLead: number;
  holdMin: number;
  holdPreferred: number;
  holdMax: number;
  range: TemporalScene['range'];
  tail: number;
  /** Place les comportements ancrés sur la fin, puis ce qui en dépend, pour une fin de scène donnée. */
  place: (end: number) => void;
  readability: { layer: string; requirement: ReadingRequirement; enteredAt: number; exitLead: number }[];
}

function resolveLocalScene(spec: MotionSceneSpec, scene: Scene, style: CreativeStyleProfile, registry: BehaviorRegistry): LocalScene {
  const ctx = sceneContext(spec, scene, style);

  // 1. Parole ESTIMÉE (aucune voix réelle en P1.3).
  const speech: SpeechTiming[] = [];
  let voiceEnd = 0;
  const anchor = scene.timing.anchor;
  if ('voice_segments' in anchor) {
    const wpm = style.voice_personality.pace_wpm[spec.voice.direction.tempo];
    let cursor = Math.max(0, scene.timing.lead_in ? ctx.ms(scene.timing.lead_in) : 0);
    for (const segId of anchor.voice_segments) {
      const segment = spec.voice.segments.find((s) => s.id === segId);
      if (!segment) throw new TemporalError('temporal.unknown_segment', `segment ${segId} introuvable`);
      const timing = estimateSpeech(segId, segment.text, cursor, wpm);
      speech.push(timing);
      cursor = timing.end_ms + (segment.gap_after ? ctx.ms(segment.gap_after) : 0);
    }
    voiceEnd = cursor;
  }

  // 2. Comportements : définition, variante, durée, décalage.
  const layers = flatten(scene.layers);
  const behaviors: ResolvedBehavior[] = [];
  let index = 0;
  for (const layer of layers) {
    for (const b of layer.behaviors) {
      const def = registry.get(b.behavior, b.version);
      if (!def) throw new TemporalError('behavior.unknown_version', `${b.behavior}@${b.version} absent du registre`);
      const duration = behaviorDuration(ctx, b, def);
      // Budget d'un comportement « jusqu'à la fin » : vérifié une fois sa durée connue (place()).
      if (duration.span === null && (duration.ms < def.duration_budget.min_ms || duration.ms > def.duration_budget.max_ms)) {
        throw new TemporalError(
          'temporal.duration_out_of_budget',
          `${b.id} : ${duration.ms} ms hors du budget de ${b.behavior} [${def.duration_budget.min_ms}, ${def.duration_budget.max_ms}]`,
        );
      }
      behaviors.push({
        instance: b.id,
        behavior: b.behavior,
        version: b.version,
        definition: def,
        variant: b.variant ?? def.default_variant,
        phase: def.phase,
        layer: layer.id,
        primitive: layer.primitive,
        target_run: b.target?.run ?? null,
        duration_ms: duration.ms,
        duration_locked: duration.locked,
        stagger_ms: staggerMs(ctx, b, def),
        start_ms: Number.NaN,
        end_ms: Number.NaN,
        lanes: [],
        declaration_index: index++,
        params: b.params ?? {},
        span: duration.span,
      });
    }
  }
  const byId = new Map(behaviors.map((b) => [b.instance, b]));
  const lines = new Map(layers.map((l) => [l.id, lineCount(l)]));
  const events: Record<string, number> = {};
  const anchorOf = new Map<string, Anchor>();
  for (const layer of layers) for (const b of layer.behaviors) anchorOf.set(b.id, b.at);
  for (const e of scene.events) anchorOf.set(e.id, e.at);

  const resolved = (id: string) => byId.get(id) ?? (events[id] !== undefined ? { start_ms: events[id], end_ms: events[id] } : undefined);
  const isResolved = (id: string) => {
    const r = resolved(id);
    return r !== undefined && !Number.isNaN(r.start_ms);
  };
  const layerBehaviors = (layerId: string) => behaviors.filter((b) => b.layer === layerId);

  /** Début d'un élément ancré sur le début de scène, un autre élément ou la parole ; null si pas encore résolvable. */
  const startOf = (id: string, a: Anchor): number | null => {
    const offset = a.offset ? ctx.ms(a.offset) : 0;
    const kind = anchorKind(a);
    switch (kind) {
      case 'scene_start':
        return offset;
      case 'beat':
        return Math.round(('beat' in a ? a.beat : 0) * ctx.beatMs) + offset;
      case 'after':
      case 'with': {
        const ref = 'after' in a ? a.after : 'with' in a ? a.with : '';
        if (kind === 'after' && byId.get(ref)?.span) {
          throw new TemporalError('temporal.anchor_after_span', `${id} : « après » ${ref}, qui dure jusqu'à la fin de la scène, n'a pas de sens`);
        }
        if (!isResolved(ref)) return null;
        const r = resolved(ref)!;
        return (kind === 'after' ? r.end_ms : r.start_ms) + offset;
      }
      case 'after_previous': {
        const self = byId.get(id);
        const previous = self
          ? behaviors.filter((b) => b.declaration_index < self.declaration_index && !isEndAnchor(anchorOf.get(b.instance)!) && b.span === null).pop()
          : undefined;
        if (!previous) return offset;
        return isResolved(previous.instance) ? previous.end_ms + offset : null;
      }
      case 'with_layer':
      case 'after_layer': {
        const layerId = 'with_layer' in a ? a.with_layer : 'after_layer' in a ? a.after_layer : '';
        const own = layerBehaviors(layerId).filter((b) => b.phase !== 'exit' && b.span === null && b.instance !== id);
        if (own.some((b) => !isResolved(b.instance))) return null;
        if (own.length === 0) return offset;
        return (kind === 'with_layer' ? Math.min(...own.map((b) => b.start_ms)) : Math.max(...own.map((b) => b.end_ms))) + offset;
      }
      case 'voice_segment':
      case 'voice_word': {
        const segId = 'voice_segment' in a ? a.voice_segment.segment : 'voice_word' in a ? a.voice_word.segment : '';
        const seg = speech.find((s) => s.segment === segId);
        if (!seg) throw new TemporalError('temporal.unknown_segment', `${id} : segment ${segId} non rattaché à la scène`);
        if ('voice_segment' in a) return (a.voice_segment.edge === 'start' ? seg.start_ms : seg.end_ms) + offset;
        if (!('voice_word' in a)) return null;
        const text = spec.voice.segments.find((s) => s.id === segId)?.text ?? '';
        const wordIndex = findWordMatches(text, a.voice_word.match)[(a.voice_word.occurrence ?? 1) - 1];
        const word = seg.words.find((w) => w.index === wordIndex);
        if (!word) throw new TemporalError('temporal.word_missing', `${id} : mot « ${a.voice_word.match} » introuvable`);
        return word.start_ms + offset;
      }
      case 'voice_breath':
        throw new TemporalError('temporal.anchor_reserved', `${id} : ancre « voice_breath » réservée tant qu'aucune voix n'est alignée`);
      case 'scene_end':
      case 'before_next':
        return null;
    }
  };

  // 3. Éléments « tardifs » : ancrés sur la fin de scène, ou sur un élément tardif.
  //    Ils ne sont placés qu'une fois la fin de scène connue (voir place()).
  const refOf = (a: Anchor): string | null => ('after' in a ? a.after : 'with' in a ? a.with : null);
  const late = new Set<string>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const [id, a] of anchorOf) {
      const ref = refOf(a);
      if (!late.has(id) && (isEndAnchor(a) || (ref !== null && late.has(ref)))) {
        late.add(id);
        grew = true;
      }
    }
  }
  const resolvePending = (ids: string[]) => {
    let pending = ids;
    while (pending.length > 0) {
      const next = pending.filter((id) => {
        const start = startOf(id, anchorOf.get(id)!);
        if (start === null) return true;
        const clamped = Math.max(0, start);
        const b = byId.get(id);
        if (b) withLanes(b, clamped, lines.get(b.layer) ?? 1);
        else events[id] = clamped;
        return false;
      });
      if (next.length === pending.length) {
        throw new TemporalError('temporal.unresolved_anchor', `ancres non résolues dans ${scene.id} : ${next.join(', ')}`);
      }
      pending = next;
    }
  };
  resolvePending([...anchorOf.keys()].filter((id) => !late.has(id)));

  // 4. Contraintes de fin de scène.
  // Les comportements « jusqu'à la fin » ne comptent JAMAIS dans la durée de la scène.
  const startAnchored = behaviors.filter((b) => !late.has(b.instance) && b.span === null);
  const spanning = behaviors.filter((b) => b.span !== null);
  const endAnchored = behaviors.filter((b) => isEndAnchor(anchorOf.get(b.instance)!));
  const earlyEvents = Object.entries(events).filter(([id]) => !late.has(id)).map(([, ms]) => ms);
  const contentEnd = Math.max(voiceEnd, 0, ...startAnchored.map((b) => b.end_ms), ...earlyEvents);
  const offsetOf = (id: string) => {
    const a = anchorOf.get(id);
    return a?.offset ? ctx.ms(a.offset) : 0;
  };
  /** Temps entre le début de la sortie et la fin de scène. */
  /** Emprise d'un comportement ancré sur la fin : durée + décalage des lignes. */
  const spanOf = (b: ResolvedBehavior) => b.duration_ms + (laneCount(b, lines.get(b.layer) ?? 1) - 1) * b.stagger_ms;
  const leadOf = (b: ResolvedBehavior) => spanOf(b) - offsetOf(b.instance);
  const exitLead = Math.max(0, ...endAnchored.map(leadOf));
  const t = style.motion_personality.timing;
  const holdMin = Math.round(t.hold.min_beats * ctx.factor * ctx.beatMs);
  const holdPreferred = Math.max(holdMin, Math.round(t.hold.preferred_beats * ctx.factor * ctx.beatMs));
  const holdMax = Math.max(holdPreferred, Math.round(t.hold.max_beats * ctx.factor * ctx.beatMs));

  const readability = layers
    .filter((l) => l.primitive === 'text')
    .map((l) => {
      const text = l.primitive === 'text' ? l.content.runs.map((r) => r.text).join(' ') : '';
      const own = layerBehaviors(l.id);
      const enteredAt = Math.max(0, ...own.filter((b) => b.phase === 'enter' && !Number.isNaN(b.end_ms)).map((b) => b.end_ms));
      const exits = own.filter((b) => endAnchored.includes(b));
      return {
        layer: l.id,
        requirement: readingTime({ text, locale: spec.locale, importance: 'primary' }, style),
        enteredAt,
        exitLead: Math.max(0, ...exits.map(leadOf)),
      };
    });
  const readabilityEnd = Math.max(0, ...readability.map((r) => r.enteredAt + r.requirement.required_ms + r.exitLead));
  const minHoldLock = scene.timing.min_hold && scene.timing.min_hold !== 'reading' ? ctx.ms(scene.timing.min_hold) : 0;
  const tail = scene.timing.tail ? ctx.ms(scene.timing.tail) : 0;

  const min = Math.max(contentEnd + holdMin + exitLead, readabilityEnd, minHoldLock);
  const preferred = Math.max(min, contentEnd + holdPreferred + exitLead);
  const max = Math.max(preferred, contentEnd + holdMax + exitLead);
  let range: TemporalScene['range'] = { min_ms: min, preferred_ms: preferred, max_ms: max, fixed: false };

  if ('duration' in anchor) {
    const target = ctx.ms(anchor.duration) - tail;
    if (target < min) {
      throw new TemporalError(
        'temporal.impossible_scene',
        `${scene.id} : durée imposée ${target + tail} ms < minimum ${min + tail} ms ` +
          `(contenu ${contentEnd} ms, pause min ${holdMin} ms, sortie ${exitLead} ms, lecture ${readabilityEnd} ms, fin imposée ${tail} ms). Aucune compression n'est appliquée.`,
      );
    }
    if (target > max) {
      throw new TemporalError('temporal.unfillable_scene', `${scene.id} : durée imposée ${target + tail} ms > maximum élastique ${max + tail} ms`);
    }
    range = { min_ms: target, preferred_ms: target, max_ms: target, fixed: true };
  }

  return {
    ctx,
    speech,
    behaviors,
    events,
    contentEnd,
    exitLead,
    holdMin,
    holdPreferred,
    holdMax,
    range,
    tail,
    place: (end: number) => {
      for (const b of endAnchored) withLanes(b, end + offsetOf(b.instance) - spanOf(b), lines.get(b.layer) ?? 1);
      resolvePending([...late].filter((id) => !isEndAnchor(anchorOf.get(id)!)));
      // Jusqu'à la dernière milliseconde de la scène (fin imposée comprise).
      for (const b of spanning) {
        const duration = end + tail - b.start_ms;
        if (duration <= 0) throw new TemporalError('temporal.span_empty', `${b.instance} commence à ${b.start_ms} ms, après la fin de la scène (${end + tail} ms)`);
        if (duration < b.definition.duration_budget.min_ms || duration > b.definition.duration_budget.max_ms) {
          throw new TemporalError(
            'temporal.duration_out_of_budget',
            `${b.instance} : ${duration} ms hors du budget de ${b.behavior} [${b.definition.duration_budget.min_ms}, ${b.definition.duration_budget.max_ms}]`,
          );
        }
        b.duration_ms = duration;
        withLanes(b, b.start_ms, 1);
      }
    },
    readability: readability.map((r) => ({ layer: r.layer, requirement: r.requirement, enteredAt: r.enteredAt, exitLead: r.exitLead })),
  };
}

/** Répartition entière déterministe d'un total selon des capacités (plus forts restes, puis ordre). */
export function distribute(total: number, capacities: readonly number[]): number[] {
  const sum = capacities.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return capacities.map(() => 0);
  if (total > sum) throw new TemporalError('temporal.distribute', `répartition impossible : ${total} ms > capacité ${sum} ms`);
  const exact = capacities.map((c) => (total * c) / sum);
  const floors = exact.map(Math.floor);
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    if (floors[i]! < capacities[i]!) {
      floors[i]! += 1;
      rest -= 1;
    }
  }
  return floors;
}

export function resolveTemporalPlan(input: TemporalInput): TemporalPlan {
  const { spec, style, registry } = input;
  const locals = spec.scenes.map((scene) => resolveLocalScene(spec, scene, style, registry));

  // 5. Ajustement global : seules les pauses élastiques bougent, jamais le contenu.
  const ends = locals.map((l) => l.range.preferred_ms);
  let fitted = 0;
  const totalOf = () => ends.reduce((sum, e, i) => sum + e + locals[i]!.tail, 0);
  const target = spec.duration_target;
  if (target) {
    const total = totalOf();
    if (total < target.min_ms) {
      const need = target.min_ms - total;
      const caps = locals.map((l) => (l.range.fixed ? 0 : l.range.max_ms - l.range.preferred_ms));
      if (caps.reduce((a, b) => a + b, 0) < need) {
        throw new TemporalError(
          'temporal.unfillable_duration',
          `durée naturelle ${total} ms, cible minimale ${target.min_ms} ms : les pauses élastiques ne peuvent ajouter que ${caps.reduce((a, b) => a + b, 0)} ms`,
        );
      }
      distribute(need, caps).forEach((d, i) => (ends[i]! += d));
      fitted = need;
    } else if (total > target.max_ms) {
      const excess = total - target.max_ms;
      const caps = locals.map((l) => (l.range.fixed ? 0 : l.range.preferred_ms - l.range.min_ms));
      const available = caps.reduce((a, b) => a + b, 0);
      if (available < excess) {
        const minimum = total - available;
        throw new TemporalError(
          'temporal.impossible_duration',
          `durée minimale ${minimum} ms (lecture, parole estimée, comportements et verrous) > cible maximale ${target.max_ms} ms. ` +
            `Aucune compression du texte, de la parole ni des comportements n'est appliquée.`,
        );
      }
      distribute(excess, caps).forEach((d, i) => (ends[i]! -= d));
      fitted = -excess;
    }
  }

  // 6. Placement absolu, comportements de fin, phases.
  const warnings: TemporalPlan['warnings'] = [];
  let cursor = 0;
  const scenes: TemporalScene[] = locals.map((local, i) => {
    const scene = spec.scenes[i]!;
    const end = ends[i]!;
    const shift = (ms: number) => cursor + ms;
    local.place(end);

    const hold = end - local.exitLead - local.contentEnd;
    const phases: PhaseSpan[] = [];
    for (const phase of ['enter', 'accent', 'settle'] as const) {
      const own = local.behaviors.filter((b) => b.phase === phase);
      if (own.length > 0) phases.push({ phase: PHASE_OF[phase], start_ms: shift(Math.min(...own.map((b) => b.start_ms))), end_ms: shift(Math.max(...own.map((b) => b.end_ms))) });
    }
    if (hold > 0) phases.push({ phase: 'HOLD', start_ms: shift(local.contentEnd), end_ms: shift(local.contentEnd + hold) });
    const exits = local.behaviors.filter((b) => b.phase === 'exit');
    if (exits.length > 0) phases.push({ phase: 'EXIT', start_ms: shift(Math.min(...exits.map((b) => b.start_ms))), end_ms: shift(Math.max(...exits.map((b) => b.end_ms))) });

    const finalEnd = end + local.tail;
    let transition: TemporalScene['transition_out'] = null;
    if (scene.transition_out) {
      const version = scene.transition_out.version;
      const def = registry.get(scene.transition_out.behavior, version);
      if (!def || def.scope !== 'transition') {
        throw new TemporalError('behavior.not_transition', `${scene.id} : ${scene.transition_out.behavior}@${version} n'est pas une transition du registre`);
      }
      transition = { behavior: def.id, version: def.version, at_ms: shift(finalEnd) };
      phases.push({ phase: 'CUT', start_ms: shift(finalEnd), end_ms: shift(finalEnd) });
    }

    // Garde-fous : cohérence du placement.
    for (const b of local.behaviors) {
      if (b.start_ms < 0 || b.end_ms > finalEnd) {
        throw new TemporalError('temporal.out_of_scene', `${b.instance} [${b.start_ms}, ${b.end_ms}] hors de la scène [0, ${finalEnd}]`);
      }
    }

    const readability = local.readability.map((r) => ({
      layer: r.layer,
      requirement: r.requirement,
      stable_ms: end - r.exitLead - r.enteredAt,
    }));

    const result: TemporalScene = {
      id: scene.id,
      rhythm_phase: local.ctx.phase,
      beat_ms: local.ctx.beatMs,
      energy: scene.pattern.variation.energy ?? 'medium',
      energy_factor: local.ctx.factor,
      start_ms: cursor,
      end_ms: cursor + finalEnd,
      speech: local.speech.map((s) => ({ ...s, start_ms: shift(s.start_ms), end_ms: shift(s.end_ms), words: s.words.map((w) => ({ ...w, start_ms: shift(w.start_ms) })) })) as SpeechTiming[],
      behaviors: local.behaviors.map((b) => ({
        ...b,
        start_ms: shift(b.start_ms),
        end_ms: shift(b.end_ms),
        lanes: b.lanes.map((l) => ({ ...l, start_ms: shift(l.start_ms), end_ms: shift(l.end_ms) })),
      })),
      events: Object.fromEntries(Object.entries(local.events).map(([id, ms]) => [id, shift(ms)])),
      phases,
      hold: { ms: hold, min_ms: local.holdMin, preferred_ms: local.holdPreferred, max_ms: local.holdMax },
      range: local.range,
      readability,
      voice_only: [],
      transition_out: transition,
    };
    result.voice_only = voiceOnlyIntervals(
      result.speech,
      result.behaviors.filter((b) => b.definition.scope !== 'transition'),
    );
    cursor += finalEnd;
    return result;
  });

  for (const scene of scenes) warnings.push(...checkMotionRules(scene, style));

  return {
    scenes,
    total_ms: cursor,
    timing_source: scenes.some((s) => s.speech.length > 0) ? 'estimated' : 'none',
    fitted_ms: fitted,
    warnings,
  };
}

const overlaps = (a: { start_ms: number; end_ms: number }, b: { start_ms: number; end_ms: number }) =>
  a.start_ms < b.end_ms && b.start_ms < a.end_ms;

/**
 * Incompatibilités (erreur) et budget d'attention (avertissement, erreur au
 * double du seuil du style).
 */
function checkMotionRules(scene: TemporalScene, style: CreativeStyleProfile): { code: string; message: string }[] {
  const warnings: { code: string; message: string }[] = [];
  for (const a of scene.behaviors) {
    for (const b of scene.behaviors) {
      if (a === b || a.layer !== b.layer || !a.definition.incompatibilities.includes(b.behavior)) continue;
      if (overlaps(a, b)) {
        throw new TemporalError(
          'motion.incompatible_behaviors',
          `${scene.id} : ${a.instance} (${a.behavior}) et ${b.instance} (${b.behavior}) agissent en même temps sur ${a.layer}`,
        );
      }
    }
  }
  // Pic d'attention : balayage des instants de début.
  const budget = style.motion_personality.budget;
  const instants = scene.behaviors.map((b) => b.start_ms);
  const peak = Math.max(0, ...instants.map((t) => scene.behaviors.filter((b) => b.start_ms <= t && t < b.end_ms).reduce((s, b) => s + b.definition.attention_cost, 0)));
  const total = scene.behaviors.reduce((s, b) => s + b.definition.attention_cost, 0);
  if (peak > budget.attention_peak * 2) {
    throw new TemporalError('motion.budget_exceeded', `${scene.id} : pic d'attention ${peak} > 2 × seuil du style (${budget.attention_peak})`);
  }
  if (peak > budget.attention_peak) warnings.push({ code: 'motion.attention_peak', message: `${scene.id} : pic d'attention ${peak} > seuil ${budget.attention_peak}` });
  if (total > budget.attention_total) warnings.push({ code: 'motion.attention_total', message: `${scene.id} : attention cumulée ${total} > seuil ${budget.attention_total}` });
  const heavy = scene.behaviors.filter((b) => b.definition.render_cost === 'C2' || b.definition.render_cost === 'C3');
  if (heavy.some((a) => heavy.some((b) => a !== b && overlaps(a, b)))) {
    warnings.push({ code: 'motion.render_cost', message: `${scene.id} : plusieurs comportements coûteux simultanés` });
  }
  return warnings;
}
