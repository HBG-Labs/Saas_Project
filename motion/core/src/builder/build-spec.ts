import type { Duration, RhythmPhase } from '../contracts/common.ts';
import type { CreativeIntent, IntentBeat } from '../contracts/creative-intent.ts';
import type {
  BehaviorInstance,
  Layer,
  MotionSceneSpec,
  Scene,
  SceneEvent,
  StyleBinding,
  TextRun,
  VoiceSegment,
} from '../contracts/motion-spec.ts';
import { MOTION_SPEC_SCHEMA, MOTION_SPEC_VERSION } from '../contracts/motion-spec.ts';
import type { PatternDefinition, PatternRegistry } from '../contracts/pattern.ts';
import type { PlatformPresets } from '../contracts/platform.ts';
import type { ResolvedStyle } from '../contracts/resolved-style.ts';
import { hashDocument } from '../integrity/canonical.ts';
import { IssueCollector } from '../validation/issues.ts';
import type { ValidationResult } from '../validation/issues.ts';
import { validateSpec } from '../validation/validate.ts';
import { BEHAVIORS, latestVersion } from '../motion/registry.ts';
import type { BehaviorRegistry } from '../motion/registry.ts';

/** 0.2.0 : versions de comportements épinglées, phases stabilisation/sortie, durées laissées au style. */
/** 0.3.0 (P1.5) : la spec produite est déclarée portable (slots de pattern uniquement). */
export const SPEC_BUILDER_VERSION = '0.3.0';

// Correspondances sémantiques du récit : elles décrivent le sens d'un rôle
// narratif, jamais une valeur visuelle ou temporelle.
const PHASE_BY_ROLE: Record<IntentBeat['role'], RhythmPhase> = {
  setup: 'CALM',
  tension: 'BUILD',
  interruption: 'INTERRUPTION',
  turn: 'REVEAL',
  explanation: 'BUILD',
  proof: 'REVEAL',
  resolution: 'RESOLUTION',
  signature: 'RESOLUTION',
  cta: 'RESOLUTION',
};

const PURPOSE_BY_ROLE: Record<IntentBeat['role'], Scene['purpose']> = {
  setup: 'hook',
  tension: 'tension',
  interruption: 'tension',
  turn: 'reveal',
  explanation: 'reveal',
  proof: 'proof',
  resolution: 'resolution',
  signature: 'signature',
  cta: 'cta',
};

const GAP_BY_PAUSE: Record<NonNullable<IntentBeat['pause_after']>, Duration | null> = {
  none: null,
  breath: { breaths: 1 },
  beat: { beats: 1 },
  hold: { beats: 2 },
};

const TEMPO_BY_ENERGY = { low: 'calm', medium: 'measured', high: 'brisk' } as const;

export interface BuildSpecInput {
  intent: CreativeIntent;
  resolved: ResolvedStyle;
  presets: PlatformPresets;
  patterns: PatternRegistry;
  format?: string;
  /** Registre de comportements (par défaut : celui du moteur). */
  registry?: BehaviorRegistry;
}

function bindingOf(resolved: ResolvedStyle): StyleBinding {
  if (resolved.mode === 'series' && resolved.sources.series) {
    return { kind: 'series', id: resolved.sources.series.id, version: resolved.sources.series.version };
  }
  if (resolved.mode === 'brand' && resolved.sources.brand) {
    return { kind: 'brand', id: resolved.sources.brand.id, version: resolved.sources.brand.version };
  }
  return { kind: 'style', id: resolved.sources.style.id, version: resolved.sources.style.version };
}

/** Un comportement (et sa variante) est-il permis par le style résolu ? */
function allowed(resolved: ResolvedStyle, behavior: string, variant?: string): boolean {
  if (resolved.style.forbidden.behaviors.includes(behavior)) return false;
  const policy = resolved.style.motion_personality.behaviors[behavior];
  if (!policy?.allowed) return false;
  return variant === undefined || policy.variants === undefined || policy.variants.includes(variant);
}

/**
 * Choisit la première valeur d'axe (défaut d'abord, puis ordre déclaré) que
 * le style autorise. Déterministe : aucun tirage.
 */
function chooseMotion(pattern: PatternDefinition, resolved: ResolvedStyle): string | null {
  const axis = pattern.variation_axes.motion_variant;
  const ordered = [axis.default, ...axis.values.filter((v) => v !== axis.default)];
  return (
    ordered.find((id) => {
      const m = pattern.motions[id];
      return m !== undefined && [m.reveal, m.settle, m.punctuate, m.exit].every((call) => allowed(resolved, call.behavior, call.variant));
    }) ?? null
  );
}

function selectPattern(beat: IntentBeat, patterns: PatternRegistry): PatternDefinition | null {
  const lines = beat.on_screen?.lines.length ?? 0;
  const candidates = [...patterns.values()]
    .filter((p) => p.accepts.roles.includes(beat.role) && lines > 0 && lines <= p.accepts.max_lines)
    .sort((a, b) => (a.id === b.id ? b.version.localeCompare(a.version, 'en', { numeric: true }) : a.id.localeCompare(b.id)));
  return candidates[0] ?? null;
}

/** Découpe les lignes en runs ; l'accent devient un run distinct. */
function buildRuns(beatId: string, lines: readonly string[], accent: string | undefined): { runs: TextRun[]; accentRun: string | null } {
  const runs: TextRun[] = [];
  let accentRun: string | null = null;
  let n = 0;
  const push = (text: string, role: TextRun['role'], breakAfter: boolean) => {
    if (!text) return;
    const run: TextRun = { id: `r_${beatId}_${n++}`, text };
    if (role) run.role = role;
    if (breakAfter) run.break_after = true;
    runs.push(run);
    if (role === 'accent') accentRun = run.id;
  };
  lines.forEach((line, li) => {
    const last = li === lines.length - 1;
    const at = accent && accentRun === null ? line.toLocaleLowerCase().indexOf(accent.toLocaleLowerCase()) : -1;
    if (accent === undefined || at < 0) {
      push(line, undefined, !last);
      return;
    }
    const before = line.slice(0, at);
    const middle = line.slice(at, at + accent.length);
    const after = line.slice(at + accent.length);
    push(before, undefined, false);
    push(middle, 'accent', !last && after === '');
    push(after, undefined, !last);
  });
  return { runs, accentRun };
}

export function buildSpec(input: BuildSpecInput): ValidationResult<MotionSceneSpec> {
  const { intent, resolved, presets, patterns } = input;
  const format = input.format ?? 'vertical_9x16';
  const c = new IssueCollector();

  if (!presets.formats[format]) c.error('builder.format', 'format', `format « ${format} » absent des presets`);
  for (const platform of intent.platforms) {
    const preset = presets.platforms[platform];
    if (!preset || !preset.formats.includes(format)) {
      c.error('builder.platform', 'platforms', `la plateforme ${platform} ne propose pas le format ${format}`);
    }
  }

  const energy = intent.energy;
  const registry = input.registry ?? BEHAVIORS;
  const segments: VoiceSegment[] = [];
  const scenes: Scene[] = [];
  const phases: RhythmPhase[] = [];

  intent.beats.forEach((beat, bi) => {
    const path = `beats[${bi}]`;
    const pattern = selectPattern(beat, patterns);
    if (!pattern) {
      c.error('builder.no_pattern', path, `aucun pattern n'accepte le rôle « ${beat.role} » avec ce texte à l'écran`);
      return;
    }
    const motionId = chooseMotion(pattern, resolved);
    if (!motionId) {
      c.error('builder.no_motion', path, `aucune variante de mouvement de ${pattern.id} n'est autorisée par le style`);
      return;
    }
    const axes = pattern.variation_axes;
    const energyLevel = energy && axes.energy.values.includes(energy) ? energy : axes.energy.default;
    const layoutId = axes.layout_variant.default;
    const hierarchyId = axes.hierarchy_variant.default;
    const layout = pattern.layouts[layoutId];
    const motion = pattern.motions[motionId]!;
    if (!layout) {
      c.error('builder.pattern_incomplete', path, `${pattern.id} ne définit pas la mise en page ${layoutId}`);
      return;
    }

    const id = beat.id;
    const segmentId = `vo_${id}`;
    segments.push({
      id: segmentId,
      text: beat.voice,
      gap_after: beat.pause_after ? GAP_BY_PAUSE[beat.pause_after] : null,
      emphasis: beat.emphasis ?? [],
    });

    const wantsAccent = pattern.hierarchies[hierarchyId]?.accent === true;
    const { runs, accentRun } = buildRuns(id, beat.on_screen?.lines ?? [], wantsAccent ? beat.on_screen?.accent : undefined);
    const statement = pattern.elements.statement;
    const statementSlot = layout.slots[statement.slot];
    const align = statementSlot?.align_x ?? 'start';

    /** Instance épinglée à la version courante du registre ; durée laissée au style. */
    const instance = (suffix: string, call: { behavior: string; variant?: string | undefined }, at: BehaviorInstance['at']): BehaviorInstance => {
      const version = latestVersion(registry, call.behavior);
      if (!version) throw new Error(`${call.behavior} absent du registre`);
      const b: BehaviorInstance = { id: `bh_${id}_${suffix}`, behavior: call.behavior, version, at };
      if (call.variant) b.variant = call.variant;
      return b;
    };

    const reveal = instance('reveal', motion.reveal, { event: 'scene.start' });
    const textBehaviors: BehaviorInstance[] = [reveal];
    const events: SceneEvent[] = [];
    if (PHASE_BY_ROLE[beat.role] === 'INTERRUPTION') {
      events.push({ id: `ev_${id}_break`, kind: 'INTERRUPTION', at: { event: 'scene.start' } });
    }
    events.push({ id: `ev_${id}_reveal`, kind: 'REVEAL', at: { with: reveal.id } });

    let lastId = reveal.id;
    const emphasisWord = beat.emphasis?.[0];
    if (accentRun && allowed(resolved, motion.accent.behavior, motion.accent.variant)) {
      const accent = instance(
        'accent',
        motion.accent,
        emphasisWord
          ? {
              voice_word: { segment: segmentId, match: emphasisWord },
              ...(motion.accent.offset_beats !== 0 ? { offset: { beats: motion.accent.offset_beats } } : {}),
            }
          : { after: reveal.id },
      );
      accent.target = { run: accentRun };
      const settle = instance('settle', motion.settle, { after: accent.id });
      settle.target = { run: accentRun };
      textBehaviors.push(accent, settle);
      events.push({ id: `ev_${id}_impact`, kind: 'IMPACT', at: { with: accent.id } });
      lastId = settle.id;
    }
    textBehaviors.push(instance('exit', motion.exit, { before_next: true }));

    const layers: Layer[] = [
      {
        id: `tx_${id}`,
        primitive: 'text',
        slot: statement.slot,
        content: { runs, break_policy: 'explicit' },
        style: {
          type: statement.type,
          color: statement.color,
          ...(accentRun ? { accent_color: statement.accent_color } : {}),
          align,
        },
        behaviors: textBehaviors,
      },
    ];
    const rule = pattern.elements.rule;
    if (rule) {
      layers.push({
        id: `ln_${id}`,
        primitive: 'path',
        slot: rule.slot,
        geometry: { motif: rule.motif },
        style: { stroke: rule.stroke, weight: rule.weight },
        behaviors: [instance('draw', motion.punctuate, { after: lastId }), instance('rule_exit', motion.exit, { before_next: true })],
      });
    }

    phases.push(PHASE_BY_ROLE[beat.role]);
    scenes.push({
      id: `sc_${id}`,
      pattern: {
        id: pattern.id,
        version: pattern.version,
        variation: { layout_variant: layoutId, motion_variant: motionId, energy: energyLevel, hierarchy_variant: hierarchyId },
      },
      purpose: PURPOSE_BY_ROLE[beat.role],
      locks: [],
      timing: { anchor: { voice_segments: [segmentId] }, min_hold: 'reading' },
      background: { fill: pattern.background },
      layers,
      events,
      sound: { derive_from_events: true, overrides: [] },
      subtitles:
        pattern.subtitles === 'off' ? { mode: 'off', reason: 'le texte à l’écran reprend la voix' } : { mode: 'auto' },
    });
  });

  if (c.issues.length > 0) return { ok: false, issues: c.issues };

  // Transitions : coupe franche vers la scène suivante, version épinglée.
  const cutVersion = latestVersion(registry, 'CUT');
  scenes.forEach((scene, i) => {
    const next = scenes[i + 1];
    if (next && cutVersion) scene.transition_out = { behavior: 'CUT', version: cutVersion, to: next.id };
  });

  // Sections de rythme : scènes consécutives de même phase regroupées.
  const sections: MotionSceneSpec['rhythm']['sections'] = [];
  scenes.forEach((scene, i) => {
    const phase = phases[i]!;
    const last = sections[sections.length - 1];
    if (last && last.phase === phase) last.scenes.push(scene.id);
    else sections.push({ id: `sec_${sections.length + 1}`, phase, scenes: [scene.id] });
  });

  const spec: MotionSceneSpec = {
    schema: MOTION_SPEC_SCHEMA,
    schema_version: MOTION_SPEC_VERSION,
    spec_id: intent.intent_id,
    revision: 1,
    parent_revision: null,
    created_from: { intent_id: intent.intent_id, intent_sha256: hashDocument(intent), builder_version: SPEC_BUILDER_VERSION },
    locale: intent.locale,
    // Le builder ne place qu'avec des slots de pattern : la composition est portable (validée).
    composition: { portability: 'portable' },
    style_binding: bindingOf(resolved),
    format: { preset: 'vertical_9x16', platform_safe_zones: [...intent.platforms] },
    system: { id: intent.system ?? 'freeform', version: '0.1.0' },
    rhythm: { curve: intent.tension_curve, sections },
    voice: {
      direction: {
        persona: 'narrator',
        intention: intent.message.slice(0, 200),
        tempo: TEMPO_BY_ENERGY[energy ?? 'medium'],
      },
      segments,
    },
    ...(intent.target_duration_s
      ? { duration_target: { min_ms: Math.round(intent.target_duration_s.min * 1000), max_ms: Math.round(intent.target_duration_s.max * 1000) } }
      : {}),
    scenes,
  };
  return validateSpec(spec, resolved, { patterns, registry });
}
