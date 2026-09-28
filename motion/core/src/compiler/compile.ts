import type { Layer, MotionSceneSpec } from '../contracts/motion-spec.ts';
import { patternKey } from '../contracts/pattern.ts';
import type { PatternRegistry, SlotGeometry } from '../contracts/pattern.ts';
import type { PlatformPresets } from '../contracts/platform.ts';
import { RENDER_PLAN_SCHEMA, RENDER_PLAN_VERSION, RenderPlanSchema } from '../contracts/render-plan.ts';
import type { AudioPlan, Box, PlanLine, PlanNode, PlanRun, RenderPlan, SubtitlePlan, Track } from '../contracts/render-plan.ts';
import type { ResolvedStyle } from '../contracts/resolved-style.ts';
import type { CreativeStyleProfile } from '../contracts/style-profile.ts';
import { hashDocument } from '../integrity/canonical.ts';
import { EasingError } from '../motion/easing-catalog.ts';
import { BEHAVIORS } from '../motion/registry.ts';
import type { BehaviorRegistry } from '../motion/registry.ts';
import { compileTracks, TrackError } from '../motion/tracks.ts';
import type { LayerContext } from '../motion/tracks.ts';
import { resolveTemporalPlan, TemporalError } from '../temporal/engine.ts';
import type { TemporalPlan } from '../temporal/engine.ts';
import { FrameError, msToFrame } from '../temporal/frames.ts';
import { IssueCollector } from '../validation/issues.ts';
import type { ValidationResult } from '../validation/issues.ts';
import { validateRenderPlanSemantics } from '../validation/semantic-plan.ts';
import { validateSpecSemantics } from '../validation/semantic-spec.ts';
import { alignHorizontally, alignVertically, columnsLength, layoutFrame, LayoutError, placementBox, regionBox } from './layout.ts';
import type { LayoutFrame } from './layout.ts';

/** 0.2.0 : mouvement résolu par le registre de comportements et le moteur temporel (P1.3). */
export const COMPILER_VERSION = '0.2.0';

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
  /** Applique la stratégie « mouvement réduit » de chaque comportement. */
  reducedMotion?: boolean;
  /** Registre de comportements (par défaut : celui du moteur). */
  registry?: BehaviorRegistry;
}

export interface CompileOutput {
  plan: RenderPlan;
  audio: AudioPlan;
  subtitles: SubtitlePlan;
  temporal: TemporalPlan;
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
  /** Contextes de couleur des calques imbriqués (groupes). */
  contexts: Map<string, Omit<LayerContext, 'scene'>>;
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

function buildNode(build: SceneBuild, layer: Layer, accentTargets: ReadonlySet<string>): { node: PlanNode; context: Omit<LayerContext, 'scene'> } {
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
        context: { baseColor, accentColor, runBaseColor },
      };
    }
    case 'path': {
      if (!('motif' in layer.geometry)) throw new CompileError('compile.unsupported', `${layer.id} : tracé par points non pris en charge (P1.4)`);
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
        context: { baseColor: color(style, layer.style.stroke), accentColor: null, runBaseColor: new Map() },
      };
    }
    case 'shape': {
      const radius = layer.radius ? (style.space[tokenKey(layer.radius)] ?? 0) * s : 0;
      const stroke = layer.stroke
        ? { color: color(style, layer.stroke.color), width: (style.strokes[tokenKey(layer.stroke.weight)] ?? 0) * s }
        : null;
      return {
        node: { ...base, type: 'shape', box: region.box, shape: layer.shape, radius, fill: layer.fill ? color(style, layer.fill) : null, stroke },
        context: { baseColor: layer.fill ? color(style, layer.fill) : null, accentColor: null, runBaseColor: new Map() },
      };
    }
    case 'group': {
      const children = layer.children.map((child) => {
        const built = buildNode(build, child, accentTargets);
        build.contexts.set(child.id, built.context);
        return built.node;
      });
      return { node: { ...base, type: 'group', box: region.box, children }, context: { baseColor: null, accentColor: null, runBaseColor: new Map() } };
    }
    case 'mask':
    case 'image':
      throw new CompileError('compile.unsupported', `${layer.id} : primitive « ${layer.primitive} » non prise en charge (P1.4)`);
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
  const registry = input.registry ?? BEHAVIORS;
  const reducedMotion = input.reducedMotion ?? false;
  const c = new IssueCollector();
  c.issues.push(
    ...validateSpecSemantics(spec, resolved, { patterns, registry, allowStyleSubstitution: input.allowStyleSubstitution ?? false }),
  );
  if (c.issues.some((i) => i.severity === 'error')) return { ok: false, issues: c.issues };

  try {
    const frame = layoutFrame(style, presets, spec.format.preset, spec.format.platform_safe_zones, output);
    // 1. Temps : moteur temporel (millisecondes entières, ancres sémantiques).
    const temporal = resolveTemporalPlan({ spec, style, registry });
    for (const w of temporal.warnings) c.warn(w.code, '', w.message);

    // 2. Mise en page des calques, par scène.
    const fonts = new Map<string, RenderPlan['fonts'][number]>();
    const contexts = new Map<string, LayerContext>();
    const sceneFrames = new Map<string, { from: number; to: number }>();
    const sceneNodes = new Map<string, PlanNode[]>();
    for (const [i, scene] of spec.scenes.entries()) {
      const timing = temporal.scenes[i]!;
      const from = msToFrame(timing.start_ms, output.fps);
      const to = msToFrame(timing.end_ms, output.fps);
      if (to <= from) {
        throw new CompileError('temporal.scene_too_short', `${scene.id} : ${timing.end_ms - timing.start_ms} ms ne couvrent aucune frame à ${output.fps} fps`);
      }
      sceneFrames.set(scene.id, { from, to });
      const pattern = patterns.get(patternKey(scene.pattern.id, scene.pattern.version))!;
      const layout = pattern.layouts[scene.pattern.variation.layout_variant ?? pattern.variation_axes.layout_variant.default]!;
      const build: SceneBuild = { style, frame, locale: spec.locale, slots: layout.slots, occupied: new Map(), regions: new Map(), fonts, contexts: new Map() };
      const accentTargets = new Set(
        flattenLayers(scene.layers).flatMap((l) => l.behaviors.filter((b) => b.behavior === 'ACCENT_WORD').map((b) => b.target?.run ?? '')),
      );
      sceneNodes.set(
        scene.id,
        scene.layers.map((layer) => {
          const built = buildNode(build, layer, accentTargets);
          build.contexts.set(layer.id, built.context);
          return built.node;
        }),
      );
      for (const [id, ctx] of build.contexts) contexts.set(id, { ...ctx, scene: scene.id });
    }

    // 3. Mouvement : gabarits du registre → pistes concrètes (frames en dernier).
    const tracks = compileTracks({ temporal, style, scale: frame.scale, fps: output.fps, reducedMotion, layers: contexts, sceneFrames });
    for (const [layerId, list] of tracks.byLayer) {
      const scene = contexts.get(layerId)!.scene;
      const node = findNode(sceneNodes.get(scene)!, layerId);
      if (!node) throw new CompileError('compile.node_missing', `calque ${layerId} introuvable`);
      node.tracks = list;
    }

    // 4. Audio (signaux dérivés des événements) et sous-titres (parole).
    const cues: AudioPlan['cues'] = [];
    const subtitleCues: SubtitlePlan['cues'] = [];
    const sound = style.sound_personality;
    for (const [i, scene] of spec.scenes.entries()) {
      const timing = temporal.scenes[i]!;
      if (scene.sound.derive_from_events) {
        for (const event of scene.events) {
          const cue = sound.event_cues[event.kind];
          const at = timing.events[event.id];
          if (cue && at !== undefined) cues.push({ cue, t_s: at / 1000, gain_db: sound.cues[cue]?.gain_db ?? 0, source_event: event.id });
        }
      }
      for (const override of scene.sound.overrides) {
        const ref = 'with' in override.at ? override.at.with : 'after' in override.at ? override.at.after : null;
        const b = ref ? timing.behaviors.find((x) => x.instance === ref) : undefined;
        const at = ref ? (timing.events[ref] ?? (b ? ('with' in override.at ? b.start_ms : b.end_ms) : undefined)) : undefined;
        if (at !== undefined) {
          cues.push({ cue: override.cue, t_s: at / 1000, gain_db: override.gain_db ?? sound.cues[override.cue]?.gain_db ?? 0, source_event: scene.id });
        }
      }
      if (scene.subtitles.mode === 'auto') {
        for (const speech of timing.speech) {
          const text = spec.voice.segments.find((s) => s.id === speech.segment)?.text ?? '';
          subtitleCues.push({ scene: scene.id, start_s: speech.start_ms / 1000, end_s: speech.end_ms / 1000, lines: [text] });
        }
      }
    }

    const plan = RenderPlanSchema.parse({
      schema: RENDER_PLAN_SCHEMA,
      schema_version: RENDER_PLAN_VERSION,
      spec: { spec_id: spec.spec_id, revision: spec.revision, sha256: hashDocument(spec) },
      style: { mode: resolved.mode, sha256: resolved.sha256 },
      compiler_version: COMPILER_VERSION,
      timing_source: temporal.timing_source,
      reduced_motion: reducedMotion,
      provenance: {
        behavior_registry: { version: registry.version, sha256: registry.sha256 },
        behaviors: temporal.scenes.flatMap((scene) => [
          ...scene.behaviors.map((b) => ({ instance: b.instance, behavior: b.behavior, version: b.version, scene: scene.id, layer: b.layer })),
          ...(scene.transition_out
            ? [{ instance: `${scene.id}_transition`, behavior: scene.transition_out.behavior, version: scene.transition_out.version, scene: scene.id, layer: null }]
            : []),
        ]),
      },
      canvas: { width: output.width, height: output.height, fps: output.fps, duration_frames: msToFrame(temporal.total_ms, output.fps) },
      fonts: [...fonts.values()].sort((a, b) => a.id.localeCompare(b.id)),
      assets: [],
      scenes: spec.scenes.map((scene) => ({
        id: scene.id,
        ...sceneFrames.get(scene.id)!,
        background: color(style, scene.background.fill),
        nodes: sceneNodes.get(scene.id)!,
      })),
    });
    const planIssues = validateRenderPlanSemantics(plan);
    if (planIssues.length > 0) return { ok: false, issues: [...c.issues, ...planIssues] };

    const maxCues = sound.max_cues_per_video;
    cues.sort((a, b) => a.t_s - b.t_s || a.source_event.localeCompare(b.source_event));
    if (cues.length > maxCues) {
      c.warn('audio.cues_truncated', 'scenes', `${cues.length} signaux sonores, limite du style ${maxCues} : les suivants sont ignorés`);
    }
    const audio: AudioPlan = {
      schema: 'audio-plan',
      schema_version: RENDER_PLAN_VERSION,
      duration_s: temporal.total_ms / 1000,
      voice: null,
      cues: cues.slice(0, maxCues),
      target_lufs: input.audioTargets.target_lufs,
      true_peak_dbtp: input.audioTargets.true_peak_dbtp,
    };
    const subtitles: SubtitlePlan = { schema: 'subtitle-plan', schema_version: RENDER_PLAN_VERSION, cues: subtitleCues };
    return { ok: true, value: { plan, audio, subtitles, temporal }, warnings: c.issues };
  } catch (error) {
    if (error instanceof CompileError || error instanceof TemporalError || error instanceof TrackError || error instanceof FrameError) {
      c.error(error.code, '', error.message);
    } else if (error instanceof LayoutError) c.error('compile.layout', '', error.message);
    else if (error instanceof EasingError) c.error('motion.easing', '', error.message);
    else throw error;
    return { ok: false, issues: c.issues };
  }
}
