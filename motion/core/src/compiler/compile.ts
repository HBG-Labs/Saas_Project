import type { Layer, MotionSceneSpec, Scene } from '../contracts/motion-spec.ts';
import { patternKey } from '../contracts/pattern.ts';
import type { PatternRegistry, SlotGeometry } from '../contracts/pattern.ts';
import type { PlatformPresets } from '../contracts/platform.ts';
import { RENDER_PLAN_SCHEMA, RENDER_PLAN_VERSION, RenderPlanSchema } from '../contracts/render-plan.ts';
import type { AudioPlan, Box, PlanLine, PlanNode, PlanRun, RenderPlan, SubtitlePlan, Track } from '../contracts/render-plan.ts';
import type { ResolvedStyle } from '../contracts/resolved-style.ts';
import type { CreativeStyleProfile } from '../contracts/style-profile.ts';
import { hashDocument } from '../integrity/canonical.ts';
import { IssueCollector } from '../validation/issues.ts';
import type { ValidationResult } from '../validation/issues.ts';
import { validateRenderPlanSemantics } from '../validation/semantic-plan.ts';
import { validateSpecSemantics } from '../validation/semantic-spec.ts';
import { BEHAVIOR_REGISTRY, BehaviorError, expandBehavior } from './behaviors.ts';
import type { PathContext, SceneFrames, TextContext } from './behaviors.ts';
import { alignHorizontally, alignVertically, columnsLength, layoutFrame, LayoutError, placementBox, regionBox } from './layout.ts';
import type { LayoutFrame } from './layout.ts';
import { resolveSceneTimeline, TimelineError, toFrame } from './timeline.ts';
import type { SceneTimeline } from './timeline.ts';

export const COMPILER_VERSION = '0.1.0';

export interface OutputConfig {
  width: number;
  height: number;
  fps: number;
}

export interface CompileInput {
  spec: MotionSceneSpec;
  resolved: ResolvedStyle;
  presets: PlatformPresets;
  patterns: PatternRegistry;
  output: OutputConfig;
  /** Cibles de mixage : fournies par le profil de rendu, jamais inventées par le compilateur. */
  audioTargets: { target_lufs: number; true_peak_dbtp: number };
  allowStyleSubstitution?: boolean;
}

export interface CompileOutput {
  plan: RenderPlan;
  audio: AudioPlan;
  subtitles: SubtitlePlan;
  timeline: SceneTimeline[];
}

class CompileError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const tokenKey = (ref: string) => ref.slice(ref.indexOf('.') + 1);
const fontId = (family: string, weight: number) => `${family.replace(/[^a-z0-9_]/g, '_')}_${weight}`;

function color(style: CreativeStyleProfile, ref: string): string {
  const value = style.palette[tokenKey(ref)];
  if (!value) throw new CompileError('compile.color', `couleur « ${ref} » absente du style`);
  return value;
}

interface SceneBuild {
  style: CreativeStyleProfile;
  frame: LayoutFrame;
  locale: string;
  slots: Record<string, SlotGeometry>;
  /** Boîte effectivement occupée par le calque placé dans chaque slot. */
  occupied: Map<string, Box>;
  regions: Map<string, Box>;
  fonts: Map<string, RenderPlan['fonts'][number]>;
}

function slotRegion(build: SceneBuild, slot: string): { box: Box; align_x: 'start' | 'center' | 'end'; align_y: 'start' | 'center' | 'end' } {
  const geometry = build.slots[slot];
  if (!geometry) throw new CompileError('compile.slot', `slot « ${slot} » inconnu du pattern`);
  if (geometry.kind === 'region') {
    return { box: regionBox(build.frame, geometry.x, geometry.y), align_x: geometry.align_x, align_y: geometry.align_y };
  }
  const ref = build.occupied.get(geometry.of);
  const refRegion = build.regions.get(geometry.of);
  if (!ref || !refRegion) throw new CompileError('compile.slot_order', `le slot « ${geometry.of} » doit être placé avant « ${slot} »`);
  const gap = build.style.space[geometry.gap];
  if (gap === undefined) throw new CompileError('compile.space', `espacement « ${geometry.gap} » absent du style`);
  const top = ref.y + ref.h + gap * build.frame.scale;
  return { box: { x: refRegion.x, y: top, w: refRegion.w, h: 0 }, align_x: geometry.align_x, align_y: 'start' };
}

function layerRegion(build: SceneBuild, layer: Layer) {
  if (layer.placement) {
    return {
      box: placementBox(build.frame, layer.placement),
      align_x: layer.placement.align_x ?? 'start',
      align_y: layer.placement.align_y ?? 'start',
    };
  }
  if (layer.slot) return slotRegion(build, layer.slot);
  return { box: build.frame.content, align_x: 'start' as const, align_y: 'start' as const };
}

function buildNode(build: SceneBuild, layer: Layer, accentTargets: ReadonlySet<string>): { node: PlanNode; context: TextContext | PathContext | null } {
  const { style, frame } = build;
  const s = frame.scale;
  const region = layerRegion(build, layer);
  const base = { id: layer.id, origin: { x: 0.5, y: 0.5 }, opacity: layer.opacity ?? 1, tracks: [] as Track[] };

  switch (layer.primitive) {
    case 'text': {
      const typeStyle = style.typography.scale[tokenKey(layer.style.type)];
      if (!typeStyle) throw new CompileError('compile.type', `style typographique « ${layer.style.type} » absent`);
      const family = style.typography.families[typeStyle.family];
      const file = family?.files.find((f) => f.weight === typeStyle.weight && f.style === 'normal');
      if (!family || !file) throw new CompileError('compile.font', `police ${typeStyle.family} ${typeStyle.weight} absente`);
      const id = fontId(typeStyle.family, typeStyle.weight);
      build.fonts.set(id, { id, css_name: family.css_name, weight: typeStyle.weight, style: 'normal', file: file.src, sha256: file.sha256 });

      const size = typeStyle.size * s;
      const lineHeight = size * typeStyle.line_height;
      const baseColor = color(style, layer.style.color);
      const accentColor = layer.style.accent_color ? color(style, layer.style.accent_color) : null;
      const mutedColor = layer.style.muted_color ? color(style, layer.style.muted_color) : null;
      const runBaseColor = new Map<string, string>();
      const lines: PlanLine[] = [];
      let current: PlanRun[] = [];
      const flush = () => {
        if (current.length === 0) return;
        lines.push({ runs: current, top: lines.length * lineHeight, height: lineHeight, measured_width: null });
        current = [];
      };
      for (const run of layer.content.runs) {
        const text = typeStyle.case === 'upper' ? run.text.toLocaleUpperCase(build.locale) : run.text;
        const animatedAccent = run.role === 'accent' && accentTargets.has(run.id);
        const runColor =
          run.role === 'accent' && !animatedAccent && accentColor
            ? accentColor
            : run.role === 'muted' && mutedColor
              ? mutedColor
              : baseColor;
        runBaseColor.set(run.id, runColor);
        current.push({ id: run.id, text, font: id, weight: typeStyle.weight, size, tracking_px: typeStyle.tracking_em * size, color: runColor });
        if (run.break_after) flush();
      }
      flush();
      const height = lines.length * lineHeight;
      const box: Box = { x: region.box.x, y: alignVertically(region.box, height, region.align_y), w: region.box.w, h: height };
      if (layer.slot) {
        build.occupied.set(layer.slot, box);
        build.regions.set(layer.slot, region.box);
      }
      const align = layer.style.align ?? region.align_x;
      return {
        node: { ...base, type: 'text', box, align, lines },
        context: { kind: 'text', lineCount: lines.length, runBaseColor, accentColor },
      };
    }
    case 'path': {
      if (!('motif' in layer.geometry)) throw new CompileError('compile.unsupported', `${layer.id} : tracé par points non pris en charge en P1.2`);
      const motif = style.motifs[tokenKey(layer.geometry.motif)];
      const weight = style.strokes[tokenKey(layer.style.weight)];
      if (!motif || weight === undefined) throw new CompileError('compile.motif', `${layer.id} : motif ou trait absent du style`);
      const strokeWidth = weight * s;
      const length = Math.max(strokeWidth, columnsLength(frame, motif.length_cols));
      const x = alignHorizontally(region.box, length, region.align_x);
      const box: Box = { x, y: region.box.y, w: length, h: strokeWidth };
      const cap = layer.style.cap ?? motif.cap;
      // Une extrémité ronde ou carrée déborde d'une demi-épaisseur : on la reprend dans la longueur.
      const inset = cap === 'butt' ? 0 : strokeWidth / 2;
      if (layer.slot) {
        build.occupied.set(layer.slot, box);
        build.regions.set(layer.slot, region.box);
      }
      return {
        node: {
          ...base,
          type: 'path',
          box,
          d: `M ${inset} ${strokeWidth / 2} L ${length - inset} ${strokeWidth / 2}`,
          stroke: { color: color(style, layer.style.stroke), width: strokeWidth, cap },
        },
        context: { kind: 'path' },
      };
    }
    case 'shape': {
      const radius = layer.radius ? (style.space[tokenKey(layer.radius)] ?? 0) * s : 0;
      const stroke = layer.stroke
        ? { color: color(style, layer.stroke.color), width: (style.strokes[tokenKey(layer.stroke.weight)] ?? 0) * s }
        : null;
      return {
        node: { ...base, type: 'shape', box: region.box, shape: layer.shape, radius, fill: layer.fill ? color(style, layer.fill) : null, stroke },
        context: null,
      };
    }
    case 'group': {
      const children = layer.children.map((child) => buildNode(build, child, accentTargets).node);
      return { node: { ...base, type: 'group', box: region.box, children }, context: null };
    }
    case 'mask':
    case 'image':
      throw new CompileError('compile.unsupported', `${layer.id} : primitive « ${layer.primitive} » non prise en charge en P1.2`);
  }
}

function flattenLayers(layers: readonly Layer[]): Layer[] {
  return layers.flatMap((l) => (l.primitive === 'group' || l.primitive === 'mask' ? [l, ...flattenLayers(l.children)] : [l]));
}

function findNode(nodes: readonly PlanNode[], id: string): PlanNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === 'group' || node.type === 'mask') {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function compileSpec(input: CompileInput): ValidationResult<CompileOutput> {
  const { spec, resolved, presets, patterns, output } = input;
  const style = resolved.style;
  const issues = validateSpecSemantics(spec, resolved, {
    patterns,
    registry: BEHAVIOR_REGISTRY,
    allowStyleSubstitution: input.allowStyleSubstitution ?? false,
  });
  const c = new IssueCollector();
  c.issues.push(...issues);
  if (c.issues.some((i) => i.severity === 'error')) return { ok: false, issues: c.issues };

  try {
    const frame = layoutFrame(style, presets, spec.format.preset, spec.format.platform_safe_zones, output);
    const fonts = new Map<string, RenderPlan['fonts'][number]>();
    const planScenes: RenderPlan['scenes'] = [];
    const timelines: SceneTimeline[] = [];
    const cues: AudioPlan['cues'] = [];
    const subtitleCues: SubtitlePlan['cues'] = [];
    let cursor = 0;

    for (const scene of spec.scenes) {
      const timeline = resolveSceneTimeline(spec, scene, style, cursor);
      timelines.push(timeline);
      const frames: SceneFrames = { from: toFrame(timeline.start_ms, output.fps), to: toFrame(timeline.end_ms, output.fps), fps: output.fps };
      const pattern = patterns.get(patternKey(scene.pattern.id, scene.pattern.version))!;
      const layout = pattern.layouts[scene.pattern.variation.layout_variant ?? pattern.variation_axes.layout_variant.default]!;
      const build: SceneBuild = { style, frame, locale: spec.locale, slots: layout.slots, occupied: new Map(), regions: new Map(), fonts };

      const accentTargets = new Set(
        flattenLayers(scene.layers).flatMap((l) => l.behaviors.filter((b) => b.behavior === 'ACCENT_WORD').map((b) => b.target?.run ?? '')),
      );
      const contexts = new Map<string, TextContext | PathContext | null>();
      const nodes: PlanNode[] = scene.layers.map((layer) => {
        const built = buildNode(build, layer, accentTargets);
        contexts.set(layer.id, built.context);
        return built.node;
      });

      const beatMs = style.rhythm_personality.tempo.beat_ms[timeline.phase];
      for (const layer of flattenLayers(scene.layers)) {
        const node = findNode(nodes, layer.id);
        const context = contexts.get(layer.id);
        for (const behavior of layer.behaviors) {
          if (!node || !context) {
            if (behavior.behavior === 'CUT') continue;
            throw new CompileError('compile.behavior_target', `${behavior.id} : calque « ${layer.id} » non animable en P1.2`);
          }
          node.tracks.push(
            ...expandBehavior({ behavior, interval: timeline.timed[behavior.id]!, style, scale: frame.scale, beatMs, scene: frames, target: context }),
          );
        }
      }

      collectAudio(scene, timeline, style, cues);
      if (scene.subtitles.mode === 'auto') {
        for (const segment of timeline.segments) {
          const text = spec.voice.segments.find((s) => s.id === segment.id)?.text ?? '';
          subtitleCues.push({ scene: scene.id, start_s: segment.start_ms / 1000, end_s: segment.end_ms / 1000, lines: [text] });
        }
      }
      planScenes.push({ id: scene.id, from: frames.from, to: frames.to, background: color(style, scene.background.fill), nodes });
      cursor = timeline.end_ms;
    }

    const durationFrames = planScenes[planScenes.length - 1]!.to;
    const plan = RenderPlanSchema.parse({
      schema: RENDER_PLAN_SCHEMA,
      schema_version: RENDER_PLAN_VERSION,
      spec: { spec_id: spec.spec_id, revision: spec.revision, sha256: hashDocument(spec) },
      style: { mode: resolved.mode, sha256: resolved.sha256 },
      compiler_version: COMPILER_VERSION,
      canvas: { width: output.width, height: output.height, fps: output.fps, duration_frames: durationFrames },
      fonts: [...fonts.values()].sort((a, b) => a.id.localeCompare(b.id)),
      assets: [],
      scenes: planScenes,
    });
    const planIssues = validateRenderPlanSemantics(plan);
    if (planIssues.length > 0) return { ok: false, issues: [...c.issues, ...planIssues] };

    const maxCues = style.sound_personality.max_cues_per_video;
    cues.sort((a, b) => a.t_s - b.t_s || a.source_event.localeCompare(b.source_event));
    if (cues.length > maxCues) {
      c.warn('audio.cues_truncated', 'scenes', `${cues.length} signaux sonores, limite du style ${maxCues} : les suivants sont ignorés`);
    }
    const audio: AudioPlan = {
      schema: 'audio-plan',
      schema_version: RENDER_PLAN_VERSION,
      duration_s: cursor / 1000,
      voice: null,
      cues: cues.slice(0, maxCues),
      target_lufs: input.audioTargets.target_lufs,
      true_peak_dbtp: input.audioTargets.true_peak_dbtp,
    };
    const subtitles: SubtitlePlan = { schema: 'subtitle-plan', schema_version: RENDER_PLAN_VERSION, cues: subtitleCues };
    return { ok: true, value: { plan, audio, subtitles, timeline: timelines }, warnings: c.issues };
  } catch (error) {
    if (error instanceof CompileError) c.error(error.code, '', error.message);
    else if (error instanceof LayoutError) c.error('compile.layout', '', error.message);
    else if (error instanceof TimelineError) c.error('compile.timeline', '', error.message);
    else if (error instanceof BehaviorError) c.error('compile.behavior', '', error.message);
    else throw error;
    return { ok: false, issues: c.issues };
  }
}

function collectAudio(scene: Scene, timeline: SceneTimeline, style: CreativeStyleProfile, cues: AudioPlan['cues']) {
  const sound = style.sound_personality;
  if (scene.sound.derive_from_events) {
    for (const event of scene.events) {
      const cue = sound.event_cues[event.kind];
      const at = timeline.timed[event.id];
      if (!cue || !at) continue;
      cues.push({ cue, t_s: at.start_ms / 1000, gain_db: sound.cues[cue]?.gain_db ?? 0, source_event: event.id });
    }
  }
  scene.sound.overrides.forEach((override) => {
    const at = 'with' in override.at ? timeline.timed[override.at.with] : 'after' in override.at ? timeline.timed[override.at.after] : undefined;
    if (!at) return;
    cues.push({ cue: override.cue, t_s: at.start_ms / 1000, gain_db: override.gain_db ?? sound.cues[override.cue]?.gain_db ?? 0, source_event: scene.id });
  });
}
