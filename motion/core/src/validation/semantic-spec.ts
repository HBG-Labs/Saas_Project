import { anchorKind, ANCHOR_KINDS } from '../contracts/common.ts';
import type { Anchor } from '../contracts/common.ts';
import type { BehaviorInstance, Layer, MotionSceneSpec, Scene } from '../contracts/motion-spec.ts';
import type { BehaviorRegistry } from '../motion/registry.ts';
import { patternKey } from '../contracts/pattern.ts';
import type { PatternRegistry } from '../contracts/pattern.ts';
import type { ResolvedStyle } from '../contracts/resolved-style.ts';
import { bindingMatches, describeResolved } from '../style/binding.ts';
import { findWordMatches } from '../text/voice-words.ts';
import { IssueCollector } from './issues.ts';
import type { ValidationIssue } from './issues.ts';
import { hasToken } from './tokens.ts';

export interface SpecSemanticOptions {
  /** Registre fermé des comportements : s'il est fourni, tout comportement doit y exister à la version demandée. */
  registry?: BehaviorRegistry;
  /** Assets disponibles en plus de ceux approuvés par l'identité. */
  assetRefs?: ReadonlySet<string>;
  /** Autorise un style différent de la liaison de la spec (substitution tracée). */
  allowStyleSubstitution?: boolean;
  /** Patterns disponibles : s'ils sont fournis, chaque scène doit référencer un pattern connu. */
  patterns?: PatternRegistry;
}

interface LayerVisit {
  layer: Layer;
  path: string;
}

function visitLayers(layers: readonly Layer[], basePath: string, out: LayerVisit[] = []): LayerVisit[] {
  layers.forEach((layer, i) => {
    const path = `${basePath}[${i}]`;
    out.push({ layer, path });
    if (layer.primitive === 'group' || layer.primitive === 'mask') visitLayers(layer.children, `${path}.children`, out);
  });
  return out;
}

function layerTokens(layer: Layer): string[] {
  switch (layer.primitive) {
    case 'text':
      return [layer.style.type, layer.style.color, layer.style.accent_color, layer.style.muted_color].filter(
        (t): t is string => t !== undefined,
      );
    case 'shape':
      return [layer.radius, layer.fill, layer.stroke?.color, layer.stroke?.weight].filter(
        (t): t is string => t !== undefined,
      );
    case 'path':
      return [
        ...('motif' in layer.geometry ? [layer.geometry.motif] : []),
        layer.style.stroke,
        layer.style.weight,
      ];
    case 'mask':
      return layer.clip.radius ? [layer.clip.radius] : [];
    case 'image':
    case 'group':
      return [];
  }
}

export function validateSpecSemantics(
  spec: MotionSceneSpec,
  resolved: ResolvedStyle,
  options: SpecSemanticOptions = {},
): ValidationIssue[] {
  const c = new IssueCollector();
  const style = resolved.style;
  const styleName = describeResolved(resolved);

  if (!bindingMatches(spec.style_binding, resolved)) {
    const b = spec.style_binding;
    const message = `spec liée à ${b.kind}:${b.id}@${b.version}, style fourni ${styleName}`;
    if (options.allowStyleSubstitution) c.warn('style.substituted', 'style_binding', `substitution explicite : ${message}`);
    else c.error('style.binding_mismatch', 'style_binding', `${message} (substitution non déclarée)`);
  }

  // Identifiants uniques dans tout le document : les ancres et les patches
  // désignent un objet par son seul identifiant.
  const seen = new Map<string, string>();
  const claim = (id: string, path: string) => {
    const previous = seen.get(id);
    if (previous) c.error('id.duplicate', path, `identifiant « ${id} » déjà utilisé en ${previous}`);
    else seen.set(id, path);
  };
  spec.rhythm.sections.forEach((s, i) => claim(s.id, `rhythm.sections[${i}]`));
  spec.voice.segments.forEach((s, i) => claim(s.id, `voice.segments[${i}]`));

  const segmentIndex = new Map(spec.voice.segments.map((s, i) => [s.id, i]));
  const sceneIndex = new Map<string, number>();
  const sceneLayers = new Map<string, Map<string, Layer>>();

  spec.scenes.forEach((scene, si) => {
    claim(scene.id, `scenes[${si}]`);
    sceneIndex.set(scene.id, si);
    const layers = new Map<string, Layer>();
    for (const { layer, path } of visitLayers(scene.layers, `scenes[${si}].layers`)) {
      claim(layer.id, path);
      layers.set(layer.id, layer);
      layer.behaviors.forEach((b, bi) => claim(b.id, `${path}.behaviors[${bi}]`));
      if (layer.primitive === 'text') layer.content.runs.forEach((r, ri) => claim(r.id, `${path}.content.runs[${ri}]`));
    }
    scene.events.forEach((e, ei) => claim(e.id, `scenes[${si}].events[${ei}]`));
    sceneLayers.set(scene.id, layers);
  });

  // Sections de rythme : chaque scène exactement une fois, dans l'ordre.
  const sectionOrder = spec.rhythm.sections.flatMap((s) => s.scenes);
  const sceneOrder = spec.scenes.map((s) => s.id);
  if (sectionOrder.join('|') !== sceneOrder.join('|')) {
    c.error(
      'rhythm.coverage',
      'rhythm.sections',
      `les sections doivent couvrir chaque scène une fois, dans l'ordre : attendu [${sceneOrder.join(', ')}], reçu [${sectionOrder.join(', ')}]`,
    );
  }

  // Voix : segments rattachés à une seule scène, dans l'ordre du récit.
  const segmentOwner = new Map<string, string>();
  let lastSegment = -1;
  spec.scenes.forEach((scene, si) => {
    if (!('voice_segments' in scene.timing.anchor)) return;
    scene.timing.anchor.voice_segments.forEach((segId, k) => {
      const path = `scenes[${si}].timing.anchor.voice_segments[${k}]`;
      const index = segmentIndex.get(segId);
      if (index === undefined) {
        c.error('voice.unknown_segment', path, `segment « ${segId} » inexistant`);
        return;
      }
      const owner = segmentOwner.get(segId);
      if (owner) c.error('voice.segment_shared', path, `segment « ${segId} » déjà rattaché à la scène « ${owner} »`);
      segmentOwner.set(segId, scene.id);
      if (index <= lastSegment) c.error('voice.order', path, `segment « ${segId} » hors de l'ordre du récit`);
      lastSegment = Math.max(lastSegment, index);
    });
  });
  spec.voice.segments.forEach((segment, i) => {
    if (!segmentOwner.has(segment.id)) {
      c.warn('voice.unused_segment', `voice.segments[${i}]`, `segment « ${segment.id} » rattaché à aucune scène`);
    }
    segment.emphasis.forEach((word, k) => {
      if (findWordMatches(segment.text, word).length === 0) {
        c.error('voice.emphasis_missing', `voice.segments[${i}].emphasis[${k}]`, `« ${word} » absent du segment`);
      }
    });
  });

  const assetRefs = new Set([...resolved.identity.approved_assets.map((a) => a.ref), ...(options.assetRefs ?? [])]);
  const policies = style.motion_personality.behaviors;

  spec.scenes.forEach((scene, si) => {
    validateScene(scene, si);
  });

  function validateScene(scene: Scene, si: number) {
    const base = `scenes[${si}]`;
    if (options.patterns) validatePatternUse(scene, base, options.patterns);
    const ownSegments = new Set(
      'voice_segments' in scene.timing.anchor ? scene.timing.anchor.voice_segments : [],
    );
    const layers = sceneLayers.get(scene.id) ?? new Map<string, Layer>();
    const visits = visitLayers(scene.layers, `${base}.layers`);
    const localTimed = new Set<string>([
      ...visits.flatMap(({ layer }) => layer.behaviors.map((b) => b.id)),
      ...scene.events.map((e) => e.id),
    ]);
    const edges = new Map<string, string>();

    const checkAnchor = (anchor: Anchor, path: string, owner: string) => {
      if (ANCHOR_KINDS[anchorKind(anchor)] === 'reserved') {
        c.error('anchor.reserved', path, `ancre « ${anchorKind(anchor)} » réservée : aucune voix alignée n'existe encore`);
        return;
      }
      if ('with_layer' in anchor || 'after_layer' in anchor) {
        const target = 'with_layer' in anchor ? anchor.with_layer : anchor.after_layer;
        if (!layers.has(target)) c.error('anchor.unknown_layer', path, `calque « ${target} » absent de la scène`);
      }
      if ('voice_segment' in anchor || 'voice_word' in anchor) {
        const segId = 'voice_segment' in anchor ? anchor.voice_segment.segment : anchor.voice_word.segment;
        if (!segmentIndex.has(segId)) {
          c.error('anchor.unknown_segment', path, `segment « ${segId} » inexistant`);
          return;
        }
        if (!ownSegments.has(segId)) {
          c.error('anchor.foreign_segment', path, `segment « ${segId} » n'appartient pas à la scène « ${scene.id} »`);
        }
        if ('voice_word' in anchor) {
          const text = spec.voice.segments[segmentIndex.get(segId) ?? 0]?.text ?? '';
          const matches = findWordMatches(text, anchor.voice_word.match);
          const occurrence = anchor.voice_word.occurrence ?? 1;
          if (matches.length < occurrence) {
            c.error(
              'anchor.word_missing',
              path,
              `mot « ${anchor.voice_word.match} » (occurrence ${occurrence}) introuvable dans « ${text} »`,
            );
          }
        }
      }
      if ('after' in anchor || 'with' in anchor) {
        const target = 'after' in anchor ? anchor.after : anchor.with;
        if (!localTimed.has(target)) {
          c.error('anchor.unknown_target', path, `« ${target} » n'est ni un comportement ni un événement de la scène`);
        } else if (target === owner) {
          c.error('anchor.self', path, `« ${owner} » ne peut pas s'ancrer sur lui-même`);
        } else {
          edges.set(owner, target);
        }
      }
    };

    for (const { layer, path } of visits) {
      for (const token of layerTokens(layer)) {
        if (!hasToken(resolved, token)) c.error('token.unknown', path, `jeton « ${token} » absent du style ${styleName}`);
      }
      if (layer.primitive === 'image' && !assetRefs.has(layer.asset)) {
        c.error('asset.unknown', `${path}.asset`, `asset « ${layer.asset} » introuvable`);
      }
      layer.behaviors.forEach((b, bi) => {
        const bpath = `${path}.behaviors[${bi}]`;
        checkBehavior(b, layer, bpath);
        checkAnchor(b.at, `${bpath}.at`, b.id);
      });
    }
    scene.events.forEach((e, ei) => checkAnchor(e.at, `${base}.events[${ei}].at`, e.id));
    scene.sound.overrides.forEach((o, oi) => {
      const opath = `${base}.sound.overrides[${oi}]`;
      if (!style.sound_personality.cues[o.cue]) c.error('sound.unknown_cue', `${opath}.cue`, `cue « ${o.cue} » absent du style`);
      checkAnchor(o.at, `${opath}.at`, `${scene.id}__override_${oi}`);
    });
    if (!hasToken(resolved, scene.background.fill)) {
      c.error('token.unknown', `${base}.background.fill`, `jeton « ${scene.background.fill} » absent du style ${styleName}`);
    }

    // Cycles d'ancrage (A après B après A) : aucun instant ne peut être résolu.
    for (const start of edges.keys()) {
      const chain = new Set<string>([start]);
      let cursor = edges.get(start);
      while (cursor !== undefined) {
        if (chain.has(cursor)) {
          c.error('anchor.cycle', base, `cycle d'ancrage : ${[...chain, cursor].join(' → ')}`);
          break;
        }
        chain.add(cursor);
        cursor = edges.get(cursor);
      }
    }

    for (const [li, lock] of scene.locks.entries()) {
      const [kind, id] = lock.split('.');
      if (!id) continue;
      const exists =
        kind === 'layers'
          ? layers.has(id)
          : kind === 'behaviors' || kind === 'events'
            ? localTimed.has(id)
            : true;
      if (!exists) c.error('lock.unknown_target', `${base}.locks[${li}]`, `verrou sur « ${id} » inexistant`);
    }

    if (scene.transition_out && options.registry) {
      const t = scene.transition_out;
      const def = options.registry.get(t.behavior, t.version);
      if (!def) c.error('behavior.unknown_version', `${base}.transition_out`, `${t.behavior}@${t.version} absent du registre`);
      else if (def.scope !== 'transition') c.error('behavior.not_transition', `${base}.transition_out`, `${t.behavior} n'est pas une transition`);
    }
    if (scene.transition_out?.to !== undefined) {
      const next = spec.scenes[si + 1];
      if (!next || next.id !== scene.transition_out.to) {
        c.error('transition.target', `${base}.transition_out.to`, 'la transition doit mener à la scène suivante');
      }
    }
  }

  function validatePatternUse(scene: Scene, base: string, patterns: PatternRegistry) {
    const pattern = patterns.get(patternKey(scene.pattern.id, scene.pattern.version));
    if (!pattern) {
      c.error('pattern.unknown', `${base}.pattern`, `pattern ${scene.pattern.id}@${scene.pattern.version} introuvable`);
      return;
    }
    const axes = pattern.variation_axes;
    const variation = scene.pattern.variation;
    const checks: [keyof typeof axes, string | undefined][] = [
      ['layout_variant', variation.layout_variant],
      ['motion_variant', variation.motion_variant],
      ['energy', variation.energy],
      ['hierarchy_variant', variation.hierarchy_variant],
    ];
    for (const [axis, value] of checks) {
      if (value !== undefined && !(axes[axis].values as readonly string[]).includes(value)) {
        c.error('pattern.variation', `${base}.pattern.variation.${axis}`, `« ${value} » n'est pas une valeur de ${axis}`);
      }
    }
    const layout = pattern.layouts[variation.layout_variant ?? axes.layout_variant.default];
    for (const { layer, path } of visitLayers(scene.layers, `${base}.layers`)) {
      if (layer.slot !== undefined && layout && !layout.slots[layer.slot]) {
        c.error('pattern.slot_unknown', `${path}.slot`, `slot « ${layer.slot} » absent de la mise en page du pattern`);
      }
    }
  }

  /** Comportement × registre fermé : existence, version, primitive, variante, ancre, cible, paramètres. */
  function checkAgainstRegistry(registry: BehaviorRegistry, b: BehaviorInstance, layer: Layer, path: string) {
    const def = registry.get(b.behavior, b.version);
    if (!def) {
      if (registry.versions(b.behavior).length === 0) c.error('behavior.unknown', path, `comportement ${b.behavior} inconnu du registre`);
      else c.error('behavior.unknown_version', `${path}.version`, `${b.behavior}@${b.version} n'existe pas (versions : ${registry.versions(b.behavior).join(', ')})`);
      return;
    }
    if (def.scope !== 'layer') c.error('behavior.scope', path, `${b.behavior} est une transition, pas un comportement de calque`);
    if (!def.compatible_primitives.includes(layer.primitive)) {
      c.error('behavior.primitive', path, `${b.behavior} ne s'applique pas à une primitive « ${layer.primitive} »`);
    }
    if (b.variant !== undefined && !def.variants[b.variant]) {
      c.error('behavior.variant_unknown', `${path}.variant`, `variante « ${b.variant} » inconnue de ${b.behavior}@${b.version}`);
    }
    const kind = anchorKind(b.at);
    if (!(def.accepted_anchors as readonly string[]).includes(kind)) {
      c.error('behavior.anchor_not_accepted', `${path}.at`, `${b.behavior} n'accepte pas l'ancre « ${kind} »`);
    }
    if (def.constraints.requires_run && b.target?.run === undefined) {
      c.error('behavior.target_required', `${path}.target`, `${b.behavior} exige une cible « run »`);
    }
    if (!def.constraints.accepts_run && b.target?.run !== undefined) {
      c.error('behavior.target', `${path}.target`, `${b.behavior} ne cible pas un run`);
    }
    for (const [name, value] of Object.entries(b.params ?? {})) {
      const spec = def.parameters_schema[name];
      if (!spec) {
        c.error('behavior.param_unknown', `${path}.params.${name}`, `paramètre « ${name} » inconnu de ${b.behavior}@${b.version}`);
        continue;
      }
      const valid =
        spec.type === 'number'
          ? typeof value === 'number' && value >= spec.min && value <= spec.max
          : spec.type === 'enum'
            ? typeof value === 'string' && spec.values.includes(value)
            : typeof value === 'string' && style.space[value] !== undefined;
      if (!valid) c.error('behavior.param_invalid', `${path}.params.${name}`, `valeur « ${String(value)} » invalide pour ${name}`);
    }
  }

  function checkBehavior(b: BehaviorInstance, layer: Layer, path: string) {
    if (style.forbidden.behaviors.includes(b.behavior)) {
      c.error('behavior.forbidden', path, `${b.behavior} est interdit par le style ${styleName}`);
    }
    const policy = policies[b.behavior];
    if (!policy || !policy.allowed) {
      c.error('behavior.not_allowed', path, `${b.behavior} n'est pas autorisé par le style ${styleName}`);
    } else {
      if (b.variant && policy.variants && !policy.variants.includes(b.variant)) {
        c.error('behavior.variant', `${path}.variant`, `variante « ${b.variant} » non autorisée pour ${b.behavior}`);
      }
      for (const [param, value] of Object.entries(b.params ?? {})) {
        const bounds = policy.param_bounds?.[param];
        if (bounds && typeof value === 'number' && (value < bounds.min || value > bounds.max)) {
          c.error('behavior.param_bounds', `${path}.params.${param}`, `${param}=${value} hors [${bounds.min}, ${bounds.max}]`);
        }
      }
    }
    if (options.registry) checkAgainstRegistry(options.registry, b, layer, path);
    if (b.target?.run !== undefined) {
      if (layer.primitive !== 'text') {
        c.error('behavior.target', `${path}.target`, 'une cible de run exige un calque texte');
      } else if (!layer.content.runs.some((r) => r.id === b.target?.run)) {
        c.error('behavior.target', `${path}.target.run`, `run « ${b.target.run} » absent du calque`);
      }
    }
    if (b.continues_in) {
      const targetIndex = sceneIndex.get(b.continues_in.scene);
      const currentScene = spec.scenes.findIndex((s) => sceneLayers.get(s.id)?.has(layer.id));
      if (targetIndex === undefined || targetIndex <= currentScene) {
        c.error('behavior.continues_in', `${path}.continues_in`, 'la continuité doit viser une scène suivante');
      } else {
        const target = sceneLayers.get(b.continues_in.scene)?.get(b.continues_in.layer);
        if (!target) c.error('behavior.continues_in', `${path}.continues_in.layer`, `calque « ${b.continues_in.layer} » introuvable`);
        else if (target.primitive !== layer.primitive) {
          c.error('behavior.continues_in', `${path}.continues_in`, 'la continuité relie deux calques de même primitive');
        }
      }
    }
  }

  return c.issues;
}
