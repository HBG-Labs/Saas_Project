import { z } from 'zod';

import { ANCHOR_KINDS, BehaviorIdSchema, IdSchema, SemVerSchema } from './common.ts';
import { PRIMITIVE_TYPES } from './motion-spec.ts';

export const BEHAVIOR_DEFINITION_SCHEMA = 'behavior-definition';
/**
 * 0.2.0 (P1.5 — Visual Integrity & Image Motion) : phase `ambient`, propriétés
 * de contenu d'image et de rognage de nœud, amplitudes d'image, stratégie
 * « mouvement réduit » `static`, contrainte `until_scene_end`. Ajouts seuls :
 * une définition 0.1.0 reste valide et garde son empreinte.
 */
export const BEHAVIOR_DEFINITION_VERSION = '0.2.0';

/**
 * Phase temporelle d'un comportement. `transition` : entre deux scènes, sans piste.
 * `ambient` (P1.5) : mouvement de fond qui dure jusqu'à la fin de la scène sans
 * jamais la rallonger (pousser une image, la faire glisser).
 */
export const BEHAVIOR_PHASES = ['enter', 'accent', 'settle', 'exit', 'transition', 'ambient'] as const;
export type BehaviorPhase = (typeof BEHAVIOR_PHASES)[number];

/**
 * Propriétés animables. Aucun moteur CSS général.
 * P1.5 : `content_*` transforment le CONTENU d'une image dans sa boîte (qui reste
 * fixe et rogne) ; `clip_*` rognent un nœud entier (fraction de chaque bord).
 */
export const MOTION_PROPERTIES = [
  'opacity',
  'translate_x',
  'translate_y',
  'scale',
  'color',
  'path_progress',
  'content_scale',
  'content_x',
  'content_y',
  'clip_top',
  'clip_right',
  'clip_bottom',
  'clip_left',
] as const;
export type MotionProperty = (typeof MOTION_PROPERTIES)[number];

/** Rôles de courbe : le style fournit la courbe concrète de chaque rôle. */
export const EASING_ROLES = ['enter', 'exit', 'inout', 'settle'] as const;
export type EasingRole = (typeof EASING_ROLES)[number];

/** Amplitudes nommées : le style les fournit, un paramètre validé peut les surcharger. */
export const AMPLITUDE_NAMES = ['enter_travel', 'exit_travel', 'accent_scale', 'image_push_scale', 'image_pan_scale', 'image_pan_travel'] as const;
export type AmplitudeName = (typeof AMPLITUDE_NAMES)[number];

/**
 * Source d'une valeur de clé : vocabulaire FERMÉ, sans expression.
 * - `const` : valeur fixe (0 pour une opacité nulle…) ;
 * - `amplitude` : amplitude nommée du style (négatée si demandé) ;
 * - `color` : couleur de base ou d'accent du calque ;
 * - `current` : valeur de la propriété à cet instant (continuité) ;
 * - `rest` : état stable de la propriété (opacité 1, translation 0, échelle 1, couleur de base).
 */
export const ValueSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('const'), value: z.number().finite() }),
  z.strictObject({ kind: z.literal('amplitude'), name: z.enum(AMPLITUDE_NAMES), negate: z.boolean().optional() }),
  z.strictObject({ kind: z.literal('color'), role: z.enum(['base', 'accent']) }),
  z.strictObject({ kind: z.literal('current') }),
  z.strictObject({ kind: z.literal('rest') }),
]);
export type ValueSource = z.infer<typeof ValueSourceSchema>;

export const TrackTemplateSchema = z.strictObject({
  property: z.enum(MOTION_PROPERTIES),
  /** Cible : le calque entier, chaque ligne (avec décalage) ou le run visé. */
  scope: z.enum(['layer', 'line', 'run']),
  keys: z
    .array(
      z.strictObject({
        /** Position dans la durée du comportement (0 = début, 1 = fin). */
        at: z.number().min(0).max(1),
        value: ValueSourceSchema,
        ease: z.enum(EASING_ROLES).optional(),
      }),
    )
    .min(2)
    .max(8),
});
export type TrackTemplate = z.infer<typeof TrackTemplateSchema>;

export const ParameterSpecSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('number'), min: z.number(), max: z.number(), unit: z.enum(['beats', 'ratio']) }),
  z.strictObject({ type: z.literal('enum'), values: z.array(z.string()).min(1) }),
  /** Clé d'espacement du style (surcharge une amplitude de même nom). */
  z.strictObject({ type: z.literal('space_role') }),
]);
export type ParameterSpec = z.infer<typeof ParameterSpecSchema>;

/** Stratégie « mouvement réduit » : ce qui reste quand l'utilisateur ou le profil de rendu la demande. */
export const ReducedMotionSchema = z.discriminatedUnion('strategy', [
  /** Garder le comportement tel quel (il ne déplace rien). */
  z.strictObject({ strategy: z.literal('keep') }),
  /** Retirer certaines propriétés (typiquement translations et échelles). */
  z.strictObject({ strategy: z.literal('drop_properties'), properties: z.array(z.enum(MOTION_PROPERTIES)).min(1) }),
  /** Aller directement à l'état final au début du comportement. */
  z.strictObject({ strategy: z.literal('instant') }),
  /** Aucune piste : l'élément reste immobile dans son état de repos (P1.5). */
  z.strictObject({ strategy: z.literal('static') }),
]);

export const BehaviorDefinitionSchema = z.strictObject({
  schema: z.literal(BEHAVIOR_DEFINITION_SCHEMA),
  schema_version: SemVerSchema,
  id: BehaviorIdSchema,
  version: SemVerSchema,
  intent: z.string().min(1).max(200),
  phase: z.enum(BEHAVIOR_PHASES),
  /** `layer` : pistes sur un calque ; `transition` : entre deux scènes, sans piste. */
  scope: z.enum(['layer', 'transition']),
  compatible_primitives: z.array(z.enum(PRIMITIVE_TYPES)),
  parameters_schema: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), ParameterSpecSchema),
  variants: z.record(IdSchema, z.strictObject({ description: z.string().min(1).max(200), tracks: z.array(TrackTemplateSchema) })),
  default_variant: IdSchema,
  animatable_properties: z.array(z.enum(MOTION_PROPERTIES)),
  accepted_anchors: z.array(z.enum(Object.keys(ANCHOR_KINDS) as [keyof typeof ANCHOR_KINDS, ...(keyof typeof ANCHOR_KINDS)[]])),
  constraints: z.strictObject({
    /** Le comportement exige une cible `target.run`. */
    requires_run: z.boolean(),
    /** Le comportement accepte une cible `target.run` (sinon il vise le calque). */
    accepts_run: z.boolean(),
    /**
     * P1.5 : l'instance DOIT durer jusqu'à la fin de la scène (`duration: { until: 'scene_end' }`),
     * résolue par le compilateur une fois la durée connue. Absent : durée de phase.
     */
    until_scene_end: z.literal('required').optional(),
  }),
  /** Comportements qui ne peuvent pas agir sur le même calque pendant le même intervalle. */
  incompatibilities: z.array(BehaviorIdSchema),
  duration_budget: z.strictObject({ min_ms: z.number().int().min(0), max_ms: z.number().int().min(0) }),
  /** Charge d'attention (0 = invisible, 5 = monopolise le regard). */
  attention_cost: z.number().int().min(0).max(5),
  render_cost: z.enum(['C0', 'C1', 'C2', 'C3']),
  reduced_motion_strategy: ReducedMotionSchema,
});
export type BehaviorDefinition = z.infer<typeof BehaviorDefinitionSchema>;
