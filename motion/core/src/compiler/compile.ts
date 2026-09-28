import type { AssetRegistry } from '../contracts/asset.ts';
import type { MotionSceneSpec } from '../contracts/motion-spec.ts';
import type { PatternRegistry } from '../contracts/pattern.ts';
import type { PlatformPresets } from '../contracts/platform.ts';
import { RENDER_PLAN_SCHEMA, RENDER_PLAN_VERSION, RenderPlanSchema } from '../contracts/render-plan.ts';
import type { AudioPlan, PlanNode, RenderPlan, SubtitlePlan } from '../contracts/render-plan.ts';
import type { ResolvedStyle } from '../contracts/resolved-style.ts';
import { hashDocument } from '../integrity/canonical.ts';
import { EasingError } from '../motion/easing-catalog.ts';
import { BEHAVIORS } from '../motion/registry.ts';
import type { BehaviorRegistry } from '../motion/registry.ts';
import { compileTracks, TrackError } from '../motion/tracks.ts';
import { resolveTemporalPlan, TemporalError } from '../temporal/engine.ts';
import type { TemporalPlan } from '../temporal/engine.ts';
import { FrameError, msToFrame } from '../temporal/frames.ts';
import { IssueCollector } from '../validation/issues.ts';
import type { ValidationResult } from '../validation/issues.ts';
import { validateRenderPlanSemantics } from '../validation/semantic-plan.ts';
import { validateSpecSemantics } from '../validation/semantic-spec.ts';
import { TextFitError } from '../text/layout-text.ts';
import { ShaperError } from '../text/shaper.ts';
import type { TextShaper } from '../text/shaper.ts';
import { typographyProvenance } from '../text/typography.ts';
import { ImageFitError } from '../visual/image-fit.ts';
import { analysisFingerprint, ANALYSIS_ALGORITHM_VERSION } from '../visual/analysis.ts';
import type { AssetAnalysis } from '../visual/analysis.ts';
import { READABILITY_RULES_VERSION } from '../visual/contrast.ts';
import { buildScenes, color, CompileError } from './build-nodes.ts';
import { checkImageMotion, measureContrast } from './visual-integrity.ts';
import type { BuildContext, TextSamples } from './build-nodes.ts';
import { layoutFrame, LayoutError } from './layout.ts';

/**
 * 0.2.0 : mouvement résolu par le registre de comportements et le moteur temporel (P1.3).
 * 0.3.0 : annotation « voix seule ».
 * 0.4.0 : cœur visuel (P1.4) — texte mesuré et ajusté, typographie de locale,
 * images recadrées, masques, tracés par points, régions sémantiques, zone sûre.
 */
/*
 * 0.5.0 : P1.5 — Visual Integrity & Image Motion : mouvements d'image vérifiés
 * image par image, contraste mesuré dans les pixels, portabilité validée.
 */
export const COMPILER_VERSION = '0.5.0';

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
  /** Mesure du texte (HarfBuzz) : le compilateur ne place aucun glyphe sans mesure réelle. */
  shaper: TextShaper;
  /** Assets visuels disponibles (métadonnées vérifiées à la lecture). */
  assets?: AssetRegistry;
  /** Analyses de pixels des assets (P1.5), par identifiant d'asset. */
  analyses?: ReadonlyMap<string, AssetAnalysis>;
}

export interface CompileOutput {
  plan: RenderPlan;
  audio: AudioPlan;
  subtitles: SubtitlePlan;
  temporal: TemporalPlan;
  /** Encre réelle des glyphes (P1.5) : diagnostic et vérification de la métrique de contraste contre un rendu réel. */
  textSamples: ReadonlyMap<string, TextSamples>;
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
    ...validateSpecSemantics(spec, resolved, {
      patterns,
      registry,
      allowStyleSubstitution: input.allowStyleSubstitution ?? false,
      assets: input.assets ?? new Map(),
    }),
  );
  if (c.issues.some((i) => i.severity === 'error')) return { ok: false, issues: c.issues };

  try {
    const frame = layoutFrame(style, presets, spec.format.preset, spec.format.platform_safe_zones, output);
    // 1. Temps : moteur temporel (millisecondes entières, ancres sémantiques).
    const temporal = resolveTemporalPlan({ spec, style, registry });
    for (const w of temporal.warnings) c.warn(w.code, '', w.message);

    // 2. Frames des scènes, depuis le temps absolu.
    const sceneFrames = new Map<string, { from: number; to: number }>();
    for (const [i, scene] of spec.scenes.entries()) {
      const timing = temporal.scenes[i]!;
      const from = msToFrame(timing.start_ms, output.fps);
      const to = msToFrame(timing.end_ms, output.fps);
      if (to <= from) {
        throw new CompileError('temporal.scene_too_short', `${scene.id} : ${timing.end_ms - timing.start_ms} ms ne couvrent aucune frame à ${output.fps} fps`);
      }
      sceneFrames.set(scene.id, { from, to });
    }

    // 3. Mise en page sur mesures réelles. Portée « role » : chaque rôle
    //    typographique prend le plus petit rapport de ses calques (second passage).
    const makeContext = (forcedRatios: ReadonlyMap<string, number>): BuildContext => ({
      style,
      frame,
      locale: spec.locale,
      shaper: input.shaper,
      assets: input.assets ?? new Map(),
      forcedRatios,
      fonts: new Map(),
      planAssets: new Map(),
      ratios: new Map(),
      substitutions: new Map(),
      warnings: [],
      textSamples: new Map(),
    });
    let context = makeContext(new Map());
    let built = buildScenes(spec, patterns, context);
    if (style.typography.fit.scope === 'role') {
      const perRole = new Map<string, number>();
      for (const { role, ratio } of context.ratios.values()) perRole.set(role, Math.min(perRole.get(role) ?? 1, ratio));
      const uneven = [...context.ratios.values()].some(({ role, ratio }) => ratio !== perRole.get(role));
      if (uneven) {
        context = makeContext(perRole);
        built = buildScenes(spec, patterns, context);
      }
    }
    for (const w of context.warnings) c.warn(w.code, w.path, w.message);
    for (const sub of context.substitutions.values()) {
      c.warn('type.glyph_substituted', '', `police ${sub.font.slice(0, 12)}… : U+${sub.character.codePointAt(0)!.toString(16).toUpperCase()} absent, remplacé par U+${sub.replacement.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);
    }
    const sceneNodes = built.nodes;
    const contexts = built.contexts;
    const fonts = context.fonts;

    // 4. Mouvement : gabarits du registre → pistes concrètes (frames en dernier).
    const tracks = compileTracks({ temporal, style, scale: frame.scale, fps: output.fps, reducedMotion, layers: contexts, sceneFrames });
    for (const [layerId, list] of tracks.byLayer) {
      const scene = contexts.get(layerId)!.scene;
      const node = findNode(sceneNodes.get(scene)!, layerId);
      if (!node) throw new CompileError('compile.node_missing', `calque ${layerId} introuvable`);
      node.tracks = list;
    }

    // 5. Audio (signaux dérivés des événements) et sous-titres (parole).
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
      composition: { portability: spec.composition.portability },
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
        visual: {
          readability_rules: `${READABILITY_RULES_VERSION}`,
          analysis_algorithm: ANALYSIS_ALGORITHM_VERSION,
          analyses: [...context.planAssets.keys()]
            .sort()
            .filter((ref) => (input.analyses ?? new Map()).has(ref))
            .map((ref) => {
              const analysis = input.analyses!.get(ref)!;
              return { ref, decoder: analysis.decoder, sha256: analysisFingerprint(analysis) };
            }),
        },
        typography: {
          rules: typographyProvenance(spec.locale),
          shaper: input.shaper.engine,
          substitutions: [...context.substitutions.values()].sort((a, b) => a.font.localeCompare(b.font) || a.character.localeCompare(b.character)),
        },
      },
      canvas: {
        width: output.width,
        height: output.height,
        fps: output.fps,
        duration_frames: msToFrame(temporal.total_ms, output.fps),
        safe_area: frame.content,
      },
      fonts: [...fonts.values()].sort((a, b) => a.id.localeCompare(b.id)),
      assets: [...context.planAssets.values()].sort((a, b) => a.ref.localeCompare(b.ref)),
      scenes: spec.scenes.map((scene) => ({
        id: scene.id,
        ...sceneFrames.get(scene.id)!,
        background: color(style, scene.background.fill),
        nodes: sceneNodes.get(scene.id)!,
        // Frames depuis le temps absolu, comme les bornes de scène ; intervalles vides écartés.
        voice_only: temporal.scenes
          .find((t) => t.id === scene.id)!
          .voice_only.map((i) => ({ from: msToFrame(i.start_ms, output.fps), to: msToFrame(i.end_ms, output.fps) }))
          .filter((i) => i.to > i.from),
      })),
    });
    // 6. Intégrité visuelle (P1.5) : mouvement d'image image par image, puis contraste mesuré.
    checkImageMotion(plan);
    const measured = measureContrast({ plan, temporal, style, samples: context.textSamples, analyses: input.analyses ?? new Map() });
    const assign = (nodes: PlanNode[]) => {
      for (const node of nodes) {
        if (node.type === 'text') node.contrast = measured.contrasts.get(node.id)!;
        if (node.type === 'group' || node.type === 'mask') assign(node.children);
      }
    };
    for (const scene of plan.scenes) assign(scene.nodes);
    for (const [layer, report] of measured.contrasts) {
      if (report.override) {
        c.warn(
          'contrast.override',
          layer,
          `dérogation explicite : ${report.required}:1 au lieu du plancher, mesuré ${report.measured}:1 — « ${report.override.reason} »`,
        );
      }
    }
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
    return { ok: true, value: { plan, audio, subtitles, temporal, textSamples: context.textSamples }, warnings: c.issues };
  } catch (error) {
    if (
      error instanceof CompileError ||
      error instanceof TemporalError ||
      error instanceof TrackError ||
      error instanceof FrameError ||
      error instanceof TextFitError ||
      error instanceof ImageFitError ||
      error instanceof ShaperError
    ) {
      c.error(error.code, '', error.message);
    } else if (error instanceof LayoutError) c.error('compile.layout', '', error.message);
    else if (error instanceof EasingError) c.error('motion.easing', '', error.message);
    else throw error;
    return { ok: false, issues: c.issues };
  }
}
