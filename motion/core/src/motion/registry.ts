import { BEHAVIOR_DEFINITION_SCHEMA, BEHAVIOR_DEFINITION_VERSION, BehaviorDefinitionSchema } from '../contracts/behavior.ts';
import type { BehaviorDefinition } from '../contracts/behavior.ts';
import { hashDocument } from '../integrity/canonical.ts';

// Registre FERMÉ des comportements. Chaque définition est une donnée pure :
// gabarits de pistes, vocabulaire de valeurs fermé, aucune fonction.
// Ajouter ou modifier un comportement = nouvelle version, jamais une retouche
// silencieuse d'une version publiée (le test d'empreinte le surveille).

export const BEHAVIOR_REGISTRY_VERSION = '1.1.0';

const header = { schema: BEHAVIOR_DEFINITION_SCHEMA, schema_version: BEHAVIOR_DEFINITION_VERSION } as const;
const VISIBLE_START = ['scene_start', 'after', 'with', 'after_previous', 'with_layer', 'after_layer', 'beat', 'voice_segment', 'voice_word'] as const;

const DEFINITIONS: BehaviorDefinition[] = [
  {
    ...header,
    id: 'REVEAL_TEXT',
    version: '1.0.0',
    intent: 'Faire entrer un contenu textuel, unité par unité.',
    phase: 'enter',
    scope: 'layer',
    compatible_primitives: ['text'],
    parameters_schema: {
      stagger_beats: { type: 'number', min: 0, max: 2, unit: 'beats' },
      enter_travel: { type: 'space_role' },
    },
    variants: {
      rise: {
        description: 'Chaque ligne apparaît en montant de l’amplitude d’entrée du style.',
        tracks: [
          { property: 'opacity', scope: 'line', keys: [{ at: 0, value: { kind: 'const', value: 0 }, ease: 'enter' }, { at: 1, value: { kind: 'rest' } }] },
          { property: 'translate_y', scope: 'line', keys: [{ at: 0, value: { kind: 'amplitude', name: 'enter_travel' }, ease: 'enter' }, { at: 1, value: { kind: 'rest' } }] },
        ],
      },
      fade: {
        description: 'Chaque ligne apparaît en fondu, sans déplacement.',
        tracks: [{ property: 'opacity', scope: 'line', keys: [{ at: 0, value: { kind: 'const', value: 0 }, ease: 'enter' }, { at: 1, value: { kind: 'rest' } }] }],
      },
    },
    default_variant: 'rise',
    animatable_properties: ['opacity', 'translate_y'],
    accepted_anchors: [...VISIBLE_START],
    constraints: { requires_run: false, accepts_run: false },
    incompatibilities: ['EXIT_CLEAR'],
    duration_budget: { min_ms: 120, max_ms: 3000 },
    attention_cost: 2,
    render_cost: 'C0',
    reduced_motion_strategy: { strategy: 'drop_properties', properties: ['translate_y'] },
  },
  {
    ...header,
    id: 'ACCENT_WORD',
    version: '1.0.0',
    intent: 'Accentuer un mot au moment où il compte (souvent quand la voix le prononce).',
    phase: 'accent',
    scope: 'layer',
    compatible_primitives: ['text'],
    parameters_schema: {},
    variants: {
      color_scale: {
        description: 'Le run prend la couleur d’accent et grandit de l’échelle d’accent du style.',
        tracks: [
          { property: 'color', scope: 'run', keys: [{ at: 0, value: { kind: 'current' }, ease: 'inout' }, { at: 1, value: { kind: 'color', role: 'accent' } }] },
          { property: 'scale', scope: 'run', keys: [{ at: 0, value: { kind: 'current' }, ease: 'enter' }, { at: 1, value: { kind: 'amplitude', name: 'accent_scale' } }] },
        ],
      },
      color_only: {
        description: 'Le run prend la couleur d’accent, sans changement d’échelle.',
        tracks: [{ property: 'color', scope: 'run', keys: [{ at: 0, value: { kind: 'current' }, ease: 'inout' }, { at: 1, value: { kind: 'color', role: 'accent' } }] }],
      },
    },
    default_variant: 'color_scale',
    animatable_properties: ['color', 'scale'],
    accepted_anchors: [...VISIBLE_START],
    constraints: { requires_run: true, accepts_run: true },
    incompatibilities: [],
    duration_budget: { min_ms: 80, max_ms: 2000 },
    attention_cost: 3,
    render_cost: 'C0',
    reduced_motion_strategy: { strategy: 'drop_properties', properties: ['scale'] },
  },
  {
    ...header,
    id: 'SETTLE',
    version: '1.0.0',
    intent: 'Ramener un élément déplacé ou agrandi à son état stable.',
    phase: 'settle',
    scope: 'layer',
    compatible_primitives: ['text', 'shape', 'path', 'group'],
    parameters_schema: {},
    variants: {
      rest: {
        description: 'Échelle et translations reviennent au repos avec la courbe de stabilisation du style.',
        tracks: [
          { property: 'scale', scope: 'run', keys: [{ at: 0, value: { kind: 'current' }, ease: 'settle' }, { at: 1, value: { kind: 'rest' } }] },
          { property: 'translate_x', scope: 'layer', keys: [{ at: 0, value: { kind: 'current' }, ease: 'settle' }, { at: 1, value: { kind: 'rest' } }] },
          { property: 'translate_y', scope: 'layer', keys: [{ at: 0, value: { kind: 'current' }, ease: 'settle' }, { at: 1, value: { kind: 'rest' } }] },
        ],
      },
    },
    default_variant: 'rest',
    animatable_properties: ['scale', 'translate_x', 'translate_y'],
    accepted_anchors: ['after', 'with', 'after_previous', 'after_layer', 'beat', 'voice_word', 'voice_segment'],
    constraints: { requires_run: false, accepts_run: true },
    incompatibilities: [],
    duration_budget: { min_ms: 80, max_ms: 3000 },
    attention_cost: 1,
    render_cost: 'C0',
    // Sans déplacement préalable, la stabilisation ne fait rien : rien à retirer.
    reduced_motion_strategy: { strategy: 'keep' },
  },
  {
    ...header,
    id: 'EXIT_CLEAR',
    version: '1.0.0',
    intent: 'Libérer l’attention avant la scène suivante.',
    phase: 'exit',
    scope: 'layer',
    compatible_primitives: ['text', 'shape', 'path', 'group'],
    parameters_schema: { exit_travel: { type: 'space_role' } },
    variants: {
      fade: {
        description: 'Le calque s’efface.',
        tracks: [{ property: 'opacity', scope: 'layer', keys: [{ at: 0, value: { kind: 'current' }, ease: 'exit' }, { at: 1, value: { kind: 'const', value: 0 } }] }],
      },
      lift: {
        description: 'Le calque s’efface en remontant de l’amplitude de sortie du style.',
        tracks: [
          { property: 'opacity', scope: 'layer', keys: [{ at: 0, value: { kind: 'current' }, ease: 'exit' }, { at: 1, value: { kind: 'const', value: 0 } }] },
          { property: 'translate_y', scope: 'layer', keys: [{ at: 0, value: { kind: 'current' }, ease: 'exit' }, { at: 1, value: { kind: 'amplitude', name: 'exit_travel', negate: true } }] },
        ],
      },
    },
    default_variant: 'fade',
    animatable_properties: ['opacity', 'translate_y'],
    accepted_anchors: ['scene_end', 'before_next', 'after', 'with', 'after_previous', 'after_layer', 'with_layer', 'beat'],
    constraints: { requires_run: false, accepts_run: false },
    incompatibilities: ['REVEAL_TEXT'],
    duration_budget: { min_ms: 80, max_ms: 2500 },
    attention_cost: 1,
    render_cost: 'C0',
    reduced_motion_strategy: { strategy: 'drop_properties', properties: ['translate_y'] },
  },
  {
    ...header,
    id: 'CUT',
    version: '1.0.0',
    intent: 'Passer à la scène suivante instantanément, sans interpolation.',
    phase: 'transition',
    scope: 'transition',
    compatible_primitives: [],
    parameters_schema: {},
    variants: { hard: { description: 'Coupe franche.', tracks: [] } },
    default_variant: 'hard',
    animatable_properties: [],
    accepted_anchors: ['scene_end'],
    constraints: { requires_run: false, accepts_run: false },
    incompatibilities: [],
    duration_budget: { min_ms: 0, max_ms: 0 },
    attention_cost: 0,
    render_cost: 'C0',
    reduced_motion_strategy: { strategy: 'keep' },
  },
  {
    ...header,
    id: 'DRAW_PATH',
    version: '1.0.0',
    intent: 'Tracer un trait progressivement (maintenu pour la compatibilité P1.2 ; tracés complets en P1.4).',
    phase: 'enter',
    scope: 'layer',
    compatible_primitives: ['path'],
    parameters_schema: {},
    variants: {
      stroke: {
        description: 'Le trait se dessine du début à la fin.',
        tracks: [{ property: 'path_progress', scope: 'layer', keys: [{ at: 0, value: { kind: 'const', value: 0 }, ease: 'enter' }, { at: 1, value: { kind: 'const', value: 1 } }] }],
      },
    },
    default_variant: 'stroke',
    animatable_properties: ['path_progress'],
    accepted_anchors: [...VISIBLE_START],
    constraints: { requires_run: false, accepts_run: false },
    incompatibilities: [],
    duration_budget: { min_ms: 80, max_ms: 3000 },
    attention_cost: 1,
    render_cost: 'C1',
    reduced_motion_strategy: { strategy: 'instant' },
  },
];

export interface BehaviorRegistry {
  readonly version: string;
  readonly sha256: string;
  get(id: string, version: string): BehaviorDefinition | undefined;
  versions(id: string): string[];
  ids(): string[];
  all(): readonly BehaviorDefinition[];
}

export function createBehaviorRegistry(definitions: readonly BehaviorDefinition[], version: string): BehaviorRegistry {
  const map = new Map<string, BehaviorDefinition>();
  for (const raw of definitions) {
    const def = BehaviorDefinitionSchema.parse(raw);
    const key = `${def.id}@${def.version}`;
    if (map.has(key)) throw new Error(`Comportement ${key} défini deux fois.`);
    if (!def.variants[def.default_variant]) throw new Error(`${key} : variante par défaut « ${def.default_variant} » absente.`);
    for (const [variantId, variant] of Object.entries(def.variants)) {
      for (const track of variant.tracks) {
        if (!def.animatable_properties.includes(track.property)) {
          throw new Error(`${key}/${variantId} : propriété ${track.property} non déclarée animable.`);
        }
        if (track.scope === 'run' && !def.constraints.accepts_run) throw new Error(`${key}/${variantId} : cible run non acceptée.`);
        const ats = track.keys.map((k) => k.at);
        if (ats[0] !== 0 || ats[ats.length - 1] !== 1 || ats.some((a, i) => i > 0 && a <= ats[i - 1]!)) {
          throw new Error(`${key}/${variantId} : clés de ${track.property} mal ordonnées (0 … 1 strictement croissant).`);
        }
      }
    }
    if (def.duration_budget.min_ms > def.duration_budget.max_ms) throw new Error(`${key} : budget de durée inversé.`);
    map.set(key, def);
  }
  const all = [...map.values()].sort((a, b) => `${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`));
  return {
    version,
    sha256: hashDocument({ version, definitions: all }),
    get: (id, v) => map.get(`${id}@${v}`),
    versions: (id) => all.filter((d) => d.id === id).map((d) => d.version),
    ids: () => [...new Set(all.map((d) => d.id))],
    all: () => all,
  };
}

/** Registre du moteur. */
/**
 * Registre 1.1.0 (P1.4) : EXIT_CLEAR@1.1.0 s'applique aussi aux images et aux
 * masques. Même intention, mêmes pistes ; seule la compatibilité s'élargit.
 * La définition 1.0.0 reste inchangée et utilisable par les specs qui l'épinglent.
 */
const EXIT_CLEAR_1_0 = DEFINITIONS.find((d) => d.id === 'EXIT_CLEAR' && d.version === '1.0.0')!;
DEFINITIONS.push({ ...EXIT_CLEAR_1_0, version: '1.1.0', compatible_primitives: ['text', 'shape', 'path', 'group', 'image', 'mask'] });

export const BEHAVIORS = createBehaviorRegistry(DEFINITIONS, BEHAVIOR_REGISTRY_VERSION);

/** Version courante d'un comportement (utilisée par le SpecBuilder pour épingler). */
export function latestVersion(registry: BehaviorRegistry, id: string): string | undefined {
  return registry
    .versions(id)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .pop();
}
