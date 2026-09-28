import { z } from 'zod';

import {
  BehaviorIdSchema,
  ColorTokenSchema,
  DottedIdSchema,
  ENERGY_LEVELS,
  IdSchema,
  MotifTokenSchema,
  SemVerSchema,
  StrokeTokenSchema,
  TypeTokenSchema,
} from './common.ts';
import { BEAT_ROLES } from './creative-intent.ts';

export const PATTERN_SCHEMA = 'pattern-definition';
/** 0.2.0 : les durées quittent le pattern (le style les gouverne) ; les mouvements décrivent entrée, accent, stabilisation, ponctuation et sortie. */
export const PATTERN_VERSION = '0.2.0';

const SlotNameSchema = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, 'nom de slot attendu');
/** Clé d'espacement du style (`sm`, `md`…), jamais une valeur. */
const SpaceKeySchema = z.string().regex(/^[a-z0-9_]+$/);
const Fraction = z.number().min(0).max(1);
const Align = z.enum(['start', 'center', 'end']);

/**
 * Géométrie d'un slot, relative à la zone utile (marges du style et zones
 * sûres des plateformes). Les fractions sont calées sur la grille du style au
 * moment de la compilation : le pattern ne connaît ni pixel ni nombre de colonnes.
 */
export const SlotGeometrySchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('region'),
    x: z.tuple([Fraction, Fraction]),
    y: z.tuple([Fraction, Fraction]),
    align_x: Align,
    align_y: Align,
  }),
  z.strictObject({
    kind: z.literal('follow'),
    of: SlotNameSchema,
    gap: SpaceKeySchema,
    align_x: Align,
  }),
]);
export type SlotGeometry = z.infer<typeof SlotGeometrySchema>;

const BehaviorCallSchema = z.strictObject({ behavior: BehaviorIdSchema, variant: IdSchema.optional() });

const axis = <T extends z.ZodType<string>>(value: T) =>
  z.strictObject({ values: z.array(value).min(1).max(8), default: value });

export const PatternDefinitionSchema = z.strictObject({
  schema: z.literal(PATTERN_SCHEMA),
  schema_version: SemVerSchema,
  id: DottedIdSchema,
  version: SemVerSchema,
  description: z.string().min(1).max(400),
  /** Famille de composition : détermine quels éléments le pattern assemble. */
  family: z.enum(['statement']),
  accepts: z.strictObject({
    roles: z.array(z.enum(BEAT_ROLES)).min(1),
    max_lines: z.number().int().min(1).max(6),
  }),
  variation_axes: z.strictObject({
    layout_variant: axis(IdSchema),
    motion_variant: axis(IdSchema),
    energy: axis(z.enum(ENERGY_LEVELS)),
    hierarchy_variant: axis(IdSchema),
  }),
  layouts: z.record(IdSchema, z.strictObject({ slots: z.record(SlotNameSchema, SlotGeometrySchema) })),
  motions: z.record(
    IdSchema,
    z.strictObject({
      reveal: BehaviorCallSchema,
      accent: BehaviorCallSchema.extend({ offset_beats: z.number().min(-4).max(4) }),
      settle: BehaviorCallSchema,
      punctuate: BehaviorCallSchema,
      exit: BehaviorCallSchema,
    }),
  ),
  hierarchies: z.record(IdSchema, z.strictObject({ accent: z.boolean() })),
  elements: z.strictObject({
    statement: z.strictObject({
      slot: SlotNameSchema,
      type: TypeTokenSchema,
      color: ColorTokenSchema,
      accent_color: ColorTokenSchema,
    }),
    rule: z
      .strictObject({ slot: SlotNameSchema, motif: MotifTokenSchema, stroke: ColorTokenSchema, weight: StrokeTokenSchema })
      .nullable(),
  }),
  background: ColorTokenSchema,
  subtitles: z.enum(['auto', 'off']),
});
export type PatternDefinition = z.infer<typeof PatternDefinitionSchema>;

/** Registre de patterns : clé `id@version`. */
export type PatternRegistry = ReadonlyMap<string, PatternDefinition>;

export function patternKey(id: string, version: string): string {
  return `${id}@${version}`;
}
