import { z } from 'zod';

import {
  AnchorSchema,
  BehaviorIdSchema,
  ColorTokenSchema,
  CueIdSchema,
  DottedIdSchema,
  DurationSchema,
  EnergySchema,
  GridPlacementSchema,
  IdSchema,
  LocaleSchema,
  MotifTokenSchema,
  OffsetSchema,
  PlatformSchema,
  RhythmPhaseSchema,
  SemVerSchema,
  Sha256Schema,
  SpaceTokenSchema,
  StrokeTokenSchema,
  TemporalEventKindSchema,
  TypeTokenSchema,
} from './common.ts';
import type { Anchor, Duration, GridPlacement } from './common.ts';

export const MOTION_SPEC_SCHEMA = 'motion-scene-spec';
/**
 * 0.2.0 : chaque comportement épingle sa version (registre fermé) ; ancres
 * étendues ; cible de durée facultative. Migration depuis 0.1.0 : version 1.0.0.
 */
/*
 * 0.3.0 : placement dans une région sémantique d'image (`region`), image plein
 * cadre (`bleed`). Champs facultatifs : migration depuis 0.2.0 sans changement.
 */
/*
 * 0.4.0 (P1.5 — Visual Integrity & Image Motion) : portabilité DÉCLARÉE
 * (`composition.portability`), placements portables en fractions de la zone
 * utile (`area`, `area_points`), dérogation de contraste explicite et tracée,
 * durée `{ until: 'scene_end' }` des mouvements d'image. Migration depuis 0.3.0 :
 * `style_bound` (jamais de promesse de portabilité inférée).
 */
export const MOTION_SPEC_VERSION = '0.4.0';

const ParamValueSchema = z.union([z.number().finite(), z.string().max(64), z.boolean()]);

/** Instance d'un comportement de la grammaire de mouvement. */
export const BehaviorInstanceSchema = z.strictObject({
  id: IdSchema,
  behavior: BehaviorIdSchema,
  /** Version du comportement dans le registre : aucune résolution implicite vers « la dernière ». */
  version: SemVerSchema,
  variant: IdSchema.optional(),
  params: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), ParamValueSchema).optional(),
  target: z
    .strictObject({
      run: IdSchema.optional(),
      line: z.number().int().min(0).max(16).optional(),
    })
    .optional(),
  at: AnchorSchema,
  /** `{ until: 'scene_end' }` (P1.5) : résolue par le compilateur, ne rallonge jamais la scène. */
  duration: z.union([DurationSchema, z.strictObject({ until: z.literal('scene_end') })]).optional(),
  continues_in: z.strictObject({ scene: IdSchema, layer: IdSchema }).optional(),
});
export type BehaviorInstance = z.infer<typeof BehaviorInstanceSchema>;

const SlotNameSchema = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, 'nom de slot attendu');

export const TextRunSchema = z.strictObject({
  id: IdSchema,
  text: z.string().min(1).max(160),
  role: z.enum(['base', 'accent', 'muted']).optional(),
  break_after: z.boolean().optional(),
});
export type TextRun = z.infer<typeof TextRunSchema>;

// Les calques sont récursifs (group, mask) : types écrits à la main, schémas
// annotés, pour que TypeScript suive la récursion.
/**
 * Placement dans une région sémantique d'une image déjà placée de la scène
 * (ex. le « ciel » d'une photo, pour y poser un titre). La région vient des
 * métadonnées de l'asset ; le compilateur la projette selon le recadrage réel.
 */
/**
 * Placement PORTABLE (P1.5) : fractions de la zone utile (marges du style ∩
 * zones sûres), indépendantes de la grille du style. Jamais calé sur la grille.
 */
export interface AreaPlacement {
  x: [number, number];
  y: [number, number];
  align_x?: 'start' | 'center' | 'end' | undefined;
  align_y?: 'start' | 'center' | 'end' | undefined;
}

export interface RegionPlacement {
  layer: string;
  name: string;
  align_x?: 'start' | 'center' | 'end' | undefined;
  align_y?: 'start' | 'center' | 'end' | undefined;
}

interface LayerCommon {
  id: string;
  slot?: string | undefined;
  placement?: GridPlacement | undefined;
  region?: RegionPlacement | undefined;
  area?: AreaPlacement | undefined;
  opacity?: number | undefined;
  behaviors: BehaviorInstance[];
}

export interface TextLayer extends LayerCommon {
  primitive: 'text';
  /**
   * Dérogation EXPLICITE au contraste minimal (P1.5) : jamais implicite, toujours
   * motivée, recopiée dans le Render Plan et signalée à chaque compilation.
   */
  contrast_override?: { min_ratio: number; reason: string } | undefined;
  content: { runs: TextRun[]; break_policy: 'explicit' | 'balance' };
  style: {
    type: string;
    color: string;
    accent_color?: string | undefined;
    muted_color?: string | undefined;
    align?: 'start' | 'center' | 'end' | undefined;
  };
}

export interface ShapeLayer extends LayerCommon {
  primitive: 'shape';
  shape: 'rect' | 'ellipse';
  radius?: string | undefined;
  fill?: string | undefined;
  stroke?: { color: string; weight: string } | undefined;
}

export interface ImageLayer extends LayerCommon {
  primitive: 'image';
  asset: string;
  fit: 'cover' | 'contain';
  /** Plein cadre : l'image couvre tout le canevas, zones sûres ignorées (décor). */
  bleed?: boolean | undefined;
  focus?:
    | { region: string; fill?: boolean | undefined }
    | { point: { x: number; y: number } }
    | undefined;
}

export interface PathLayer extends LayerCommon {
  primitive: 'path';
  geometry:
    | { motif: string }
    | { points: { x: number; y: number }[]; closed?: boolean | undefined }
    /** Points en fractions de la zone utile (0..1) : portable (P1.5). */
    | { area_points: { x: number; y: number }[]; closed?: boolean | undefined };
  style: { stroke: string; weight: string; cap?: 'butt' | 'round' | 'square' | undefined };
}

export interface GroupLayer extends LayerCommon {
  primitive: 'group';
  children: Layer[];
}

export interface MaskLayer extends LayerCommon {
  primitive: 'mask';
  clip: { shape: 'rect' | 'ellipse'; radius?: string | undefined };
  children: Layer[];
}

export type Layer = TextLayer | ShapeLayer | ImageLayer | PathLayer | GroupLayer | MaskLayer;
export type PrimitiveType = Layer['primitive'];
export const PRIMITIVE_TYPES = ['text', 'shape', 'image', 'path', 'group', 'mask'] as const;

const AlignSchema = z.enum(['start', 'center', 'end']);

const layerCommon = {
  id: IdSchema,
  slot: SlotNameSchema.optional(),
  placement: GridPlacementSchema.optional(),
  region: z
    .strictObject({ layer: IdSchema, name: SlotNameSchema, align_x: AlignSchema.optional(), align_y: AlignSchema.optional() })
    .optional(),
  area: z
    .strictObject({
      x: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
      y: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
      align_x: AlignSchema.optional(),
      align_y: AlignSchema.optional(),
    })
    .refine((a) => a.x[0] < a.x[1] && a.y[0] < a.y[1], 'zone vide ou inversée')
    .optional(),
  opacity: z.number().min(0).max(1).optional(),
  behaviors: z.array(BehaviorInstanceSchema).max(12),
};

const TextLayerSchema = z.strictObject({
  ...layerCommon,
  primitive: z.literal('text'),
  content: z.strictObject({
    runs: z.array(TextRunSchema).min(1).max(24),
    break_policy: z.enum(['explicit', 'balance']),
  }),
  style: z.strictObject({
    type: TypeTokenSchema,
    color: ColorTokenSchema,
    accent_color: ColorTokenSchema.optional(),
    muted_color: ColorTokenSchema.optional(),
    align: z.enum(['start', 'center', 'end']).optional(),
  }),
  contrast_override: z.strictObject({ min_ratio: z.number().min(1).max(21), reason: z.string().min(12).max(300) }).optional(),
});

const ShapeLayerSchema = z.strictObject({
  ...layerCommon,
  primitive: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse']),
  radius: SpaceTokenSchema.optional(),
  fill: ColorTokenSchema.optional(),
  stroke: z.strictObject({ color: ColorTokenSchema, weight: StrokeTokenSchema }).optional(),
});

const ImageLayerSchema = z.strictObject({
  ...layerCommon,
  primitive: z.literal('image'),
  asset: IdSchema,
  fit: z.enum(['cover', 'contain']),
  bleed: z.boolean().optional(),
  focus: z
    .union([
      // fill : la région remplit le cadre (recadrage serré), au lieu d'y être seulement gardée.
      z.strictObject({ region: SlotNameSchema, fill: z.boolean().optional() }),
      z.strictObject({
        point: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      }),
    ])
    .optional(),
});

const PathLayerSchema = z.strictObject({
  ...layerCommon,
  primitive: z.literal('path'),
  geometry: z.union([
    z.strictObject({ motif: MotifTokenSchema }),
    z.strictObject({
      // Points en unités de grille (colonnes, rangées), jamais en pixels.
      points: z
        .array(z.strictObject({ x: z.number().min(0).max(48), y: z.number().min(0).max(96) }))
        .min(2)
        .max(64),
      closed: z.boolean().optional(),
    }),
    z.strictObject({
      area_points: z
        .array(z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }))
        .min(2)
        .max(64),
      closed: z.boolean().optional(),
    }),
  ]),
  style: z.strictObject({
    stroke: ColorTokenSchema,
    weight: StrokeTokenSchema,
    cap: z.enum(['butt', 'round', 'square']).optional(),
  }),
});

export const LayerSchema: z.ZodType<Layer> = z.lazy(() =>
  z.discriminatedUnion('primitive', [
    TextLayerSchema,
    ShapeLayerSchema,
    ImageLayerSchema,
    PathLayerSchema,
    z.strictObject({
      ...layerCommon,
      primitive: z.literal('group'),
      children: z.array(LayerSchema).min(1).max(24),
    }),
    z.strictObject({
      ...layerCommon,
      primitive: z.literal('mask'),
      clip: z.strictObject({ shape: z.enum(['rect', 'ellipse']), radius: SpaceTokenSchema.optional() }),
      children: z.array(LayerSchema).min(1).max(24),
    }),
  ]),
);

/** Axes de variation déclarés par le pattern et figés dans la spec. */
export const VariationSchema = z.strictObject({
  layout_variant: IdSchema.optional(),
  motion_variant: IdSchema.optional(),
  energy: EnergySchema.optional(),
  hierarchy_variant: IdSchema.optional(),
});
export type Variation = z.infer<typeof VariationSchema>;

export const PatternRefSchema = z.strictObject({
  id: DottedIdSchema,
  version: SemVerSchema,
  variation: VariationSchema,
});

export const SceneTimingSchema = z.strictObject({
  anchor: z.union([
    z.strictObject({ voice_segments: z.array(IdSchema).min(1).max(8) }),
    z.strictObject({ duration: DurationSchema }),
  ]),
  lead_in: OffsetSchema.optional(),
  tail: DurationSchema.optional(),
  min_hold: z.union([z.literal('reading'), DurationSchema]).optional(),
});

export const SceneEventSchema = z.strictObject({
  id: IdSchema,
  kind: TemporalEventKindSchema,
  at: AnchorSchema,
});

export const LOCKABLE_PATH = /^(layers|behaviors|events|timing|pattern|background|sound|subtitles)(\.[a-z0-9_]+)*$/;

export const SceneSchema = z.strictObject({
  id: IdSchema,
  pattern: PatternRefSchema,
  purpose: z.enum(['hook', 'tension', 'reveal', 'proof', 'resolution', 'cta', 'signature']),
  locks: z.array(z.string().regex(LOCKABLE_PATH, 'chemin verrouillable attendu')).max(32),
  timing: SceneTimingSchema,
  background: z.strictObject({ fill: ColorTokenSchema }),
  layers: z.array(LayerSchema).min(1).max(24),
  events: z.array(SceneEventSchema).max(16),
  sound: z.strictObject({
    derive_from_events: z.boolean(),
    overrides: z
      .array(
        z.strictObject({
          cue: CueIdSchema,
          at: AnchorSchema,
          gain_db: z.number().min(-40).max(0).optional(),
        }),
      )
      .max(8),
  }),
  subtitles: z.strictObject({ mode: z.enum(['auto', 'off']), reason: z.string().max(120).optional() }),
  transition_out: z.strictObject({ behavior: BehaviorIdSchema, version: SemVerSchema, to: IdSchema.optional() }).optional(),
});
export type Scene = z.infer<typeof SceneSchema>;
export type SceneEvent = z.infer<typeof SceneEventSchema>;

export const StyleBindingSchema = z.strictObject({
  kind: z.enum(['style', 'brand', 'series']),
  id: IdSchema,
  version: SemVerSchema,
});
export type StyleBinding = z.infer<typeof StyleBindingSchema>;

export const VoiceSegmentSchema = z.strictObject({
  id: IdSchema,
  text: z.string().min(1).max(400),
  gap_after: DurationSchema.nullable(),
  emphasis: z.array(z.string().min(1).max(64)).max(3),
});
export type VoiceSegment = z.infer<typeof VoiceSegmentSchema>;

export const MotionSceneSpecSchema = z.strictObject({
  schema: z.literal(MOTION_SPEC_SCHEMA),
  schema_version: SemVerSchema,
  spec_id: IdSchema,
  revision: z.number().int().min(1),
  parent_revision: z.number().int().min(1).nullable(),
  created_from: z.strictObject({
    intent_id: IdSchema,
    intent_sha256: Sha256Schema.optional(),
    builder_version: SemVerSchema,
  }),
  locale: LocaleSchema,
  /**
   * P1.5 : promesse de la composition. `portable` : n'utilise que des placements
   * indépendants du style (slots de pattern, régions d'image, zones `area`,
   * `area_points`, enfants de masque, plein cadre) et peut être rendue avec
   * n'importe quel style par substitution explicite. `style_bound` : peut
   * utiliser la grille de SON style, et refuse toute substitution.
   */
  composition: z.strictObject({ portability: z.enum(['portable', 'style_bound']) }),
  /**
   * Style prévu pour cette spec. Le compilateur reçoit un ResolvedStyle : s'il
   * ne correspond pas à cette liaison, c'est une substitution explicite,
   * tracée dans le manifeste.
   */
  style_binding: StyleBindingSchema,
  format: z.strictObject({
    preset: z.enum(['vertical_9x16']),
    platform_safe_zones: z.array(PlatformSchema).min(1).max(3),
  }),
  system: z.strictObject({ id: DottedIdSchema, version: SemVerSchema }),
  rhythm: z.strictObject({
    curve: DottedIdSchema,
    sections: z
      .array(
        z.strictObject({
          id: IdSchema,
          phase: RhythmPhaseSchema,
          scenes: z.array(IdSchema).min(1).max(12),
        }),
      )
      .min(1)
      .max(12),
  }),
  voice: z.strictObject({
    direction: z.strictObject({
      persona: IdSchema,
      intention: z.string().min(1).max(200),
      tempo: z.enum(['calm', 'measured', 'brisk']),
    }),
    segments: z.array(VoiceSegmentSchema).max(24),
  }),
  /** Durée visée pour l'ensemble : les silences élastiques s'ajustent, rien n'est accéléré. */
  duration_target: z.strictObject({ min_ms: z.number().int().min(0), max_ms: z.number().int().min(0) }).optional(),
  scenes: z.array(SceneSchema).min(1).max(16),
});
export type MotionSceneSpec = z.infer<typeof MotionSceneSpecSchema>;

export type { Anchor, Duration };
