import type { Anchor, Duration, Offset, RhythmPhase } from '../contracts/common.ts';
import type { Layer, MotionSceneSpec, Scene } from '../contracts/motion-spec.ts';
import type { CreativeStyleProfile } from '../contracts/style-profile.ts';
import { findWordMatches, voiceWords } from '../text/voice-words.ts';

// Résolution temporelle minimale (P1.2) : la voix n'existe pas encore, elle
// est ESTIMÉE à partir du débit du style. Tout est calculé en millisecondes ;
// la conversion en frames se fait au tout dernier moment.

export class TimelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimelineError';
  }
}

export interface WordTiming {
  index: number;
  raw: string;
  start_ms: number;
}

export interface SegmentTiming {
  id: string;
  start_ms: number;
  end_ms: number;
  words: WordTiming[];
  /** `estimated` tant qu'aucune voix réelle n'a fourni ses horodatages. */
  source: 'estimated';
}

export interface Interval {
  start_ms: number;
  end_ms: number;
}

export interface SceneTimeline {
  id: string;
  phase: RhythmPhase;
  start_ms: number;
  end_ms: number;
  segments: SegmentTiming[];
  timed: Record<string, Interval>;
}

export function phaseOf(spec: MotionSceneSpec, sceneId: string): RhythmPhase {
  const section = spec.rhythm.sections.find((s) => s.scenes.includes(sceneId));
  if (!section) throw new TimelineError(`scène ${sceneId} hors des sections de rythme`);
  return section.phase;
}

export function durationMs(d: Duration | Offset, style: CreativeStyleProfile, phase: RhythmPhase): number {
  return 'beats' in d ? d.beats * style.rhythm_personality.tempo.beat_ms[phase] : d.breaths * style.rhythm_personality.tempo.breath_ms;
}

function textLayers(layers: readonly Layer[]): Layer[] {
  return layers.flatMap((l) => (l.primitive === 'group' || l.primitive === 'mask' ? [l, ...textLayers(l.children)] : [l]));
}

function onScreenWords(scene: Scene): number {
  return textLayers(scene.layers)
    .filter((l) => l.primitive === 'text')
    .reduce((n, l) => n + (l.primitive === 'text' ? voiceWords(l.content.runs.map((r) => r.text).join(' ')).length : 0), 0);
}

/** Durée estimée d'un segment, mots répartis au prorata de leur longueur. */
function estimateSegment(id: string, text: string, start: number, msPerWord: number): SegmentTiming {
  const words = voiceWords(text);
  const duration = words.length * msPerWord;
  const weights = words.map((w) => w.raw.length + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  const timed = words.map((w, i) => {
    const t = start + (duration * acc) / total;
    acc += weights[i]!;
    return { index: w.index, raw: w.raw, start_ms: t };
  });
  return { id, start_ms: start, end_ms: start + duration, words: timed, source: 'estimated' };
}

export function resolveSceneTimeline(
  spec: MotionSceneSpec,
  scene: Scene,
  style: CreativeStyleProfile,
  sceneStart: number,
): SceneTimeline {
  const phase = phaseOf(spec, scene.id);
  const ms = (d: Duration | Offset) => durationMs(d, style, phase);
  const wpm = style.voice_personality.pace_wpm[spec.voice.direction.tempo];
  const msPerWord = 60_000 / wpm;

  const segments: SegmentTiming[] = [];
  let voiceEnd = sceneStart;
  let contentEnd = sceneStart;
  const anchor = scene.timing.anchor;
  if ('voice_segments' in anchor) {
    let cursor = sceneStart + Math.max(0, scene.timing.lead_in ? ms(scene.timing.lead_in) : 0);
    for (const segId of anchor.voice_segments) {
      const segment = spec.voice.segments.find((s) => s.id === segId);
      if (!segment) throw new TimelineError(`segment ${segId} introuvable`);
      const timing = estimateSegment(segId, segment.text, cursor, msPerWord);
      segments.push(timing);
      cursor = timing.end_ms + (segment.gap_after ? ms(segment.gap_after) : 0);
    }
    voiceEnd = cursor;
  } else {
    contentEnd = sceneStart + ms(anchor.duration);
  }

  // Ancres : résolution itérative (la validation a déjà exclu les cycles).
  const items = [
    ...textLayers(scene.layers).flatMap((l) => l.behaviors.map((b) => ({ id: b.id, at: b.at, duration: b.duration ?? null }))),
    ...scene.events.map((e) => ({ id: e.id, at: e.at, duration: null })),
  ];
  const timed: Record<string, Interval> = {};
  const resolveAt = (at: Anchor): number | null => {
    const offset = at.offset ? ms(at.offset) : 0;
    if ('event' in at) {
      if (at.event === 'scene.end') throw new TimelineError('ancre « scene.end » non prise en charge en P1.2');
      return sceneStart + offset;
    }
    if ('voice_segment' in at) {
      const seg = segments.find((s) => s.id === at.voice_segment.segment);
      if (!seg) throw new TimelineError(`segment ${at.voice_segment.segment} non rattaché à la scène`);
      return (at.voice_segment.edge === 'start' ? seg.start_ms : seg.end_ms) + offset;
    }
    if ('voice_word' in at) {
      const seg = segments.find((s) => s.id === at.voice_word.segment);
      const segDoc = spec.voice.segments.find((s) => s.id === at.voice_word.segment);
      if (!seg || !segDoc) throw new TimelineError(`segment ${at.voice_word.segment} non rattaché à la scène`);
      const index = findWordMatches(segDoc.text, at.voice_word.match)[(at.voice_word.occurrence ?? 1) - 1];
      if (index === undefined) throw new TimelineError(`mot « ${at.voice_word.match} » introuvable`);
      return seg.words[index]!.start_ms + offset;
    }
    const ref = timed['after' in at ? at.after : at.with];
    if (!ref) return null;
    return ('after' in at ? ref.end_ms : ref.start_ms) + offset;
  };
  let pending = items;
  while (pending.length > 0) {
    const next = pending.filter((item) => {
      const start = resolveAt(item.at);
      if (start === null) return true;
      const clamped = Math.max(sceneStart, start);
      timed[item.id] = { start_ms: clamped, end_ms: clamped + (item.duration ? ms(item.duration) : 0) };
      return false;
    });
    if (next.length === pending.length) throw new TimelineError(`ancres non résolues : ${next.map((i) => i.id).join(', ')}`);
    pending = next;
  }

  const style_reading = style.rhythm_personality.reading;
  const hold = scene.timing.min_hold;
  const readingEnd =
    hold === undefined
      ? sceneStart
      : hold === 'reading'
        ? sceneStart + Math.max(style_reading.min_hold_ms, onScreenWords(scene) * style_reading.ms_per_word)
        : sceneStart + ms(hold);
  const behaviorEnd = Math.max(sceneStart, ...Object.values(timed).map((t) => t.end_ms));
  const end = Math.max(voiceEnd, contentEnd, readingEnd, behaviorEnd) + (scene.timing.tail ? ms(scene.timing.tail) : 0);
  return { id: scene.id, phase, start_ms: sceneStart, end_ms: end, segments, timed };
}

/** Conversion unique ms → frame (arrondi au plus proche). */
export function toFrame(msValue: number, fps: number): number {
  return Math.round((msValue * fps) / 1000);
}
