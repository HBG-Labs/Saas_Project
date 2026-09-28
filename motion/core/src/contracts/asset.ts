import { z } from 'zod';

import { IdSchema, ResourceRefSchema, SemVerSchema, Sha256Schema } from './common.ts';

export const ASSET_SCHEMA = 'asset-definition';
export const ASSET_VERSION = '0.1.0';

const Unit = z.number().min(0).max(1);

/** Rectangle en fractions de l'image source (0..1), origine en haut à gauche. */
export const UnitRectSchema = z
  .strictObject({ x: Unit, y: Unit, w: z.number().gt(0).max(1), h: z.number().gt(0).max(1) })
  .refine((r) => r.x + r.w <= 1 + 1e-9 && r.y + r.h <= 1 + 1e-9, 'région hors de l’image');
export type UnitRect = z.infer<typeof UnitRectSchema>;

const RegionNameSchema = z.string().regex(/^[a-z][a-z0-9_]*$/, 'nom de région attendu');

/**
 * Un asset visuel et ce que le moteur doit en savoir pour le cadrer :
 * dimensions réelles (vérifiées à la lecture), point focal, régions
 * sémantiques nommées (sujet, ciel, espace négatif…) et provenance.
 * Le moteur ne devine jamais ce qu'il y a dans une image : c'est écrit ici.
 */
export const AssetDefinitionSchema = z.strictObject({
  schema: z.literal(ASSET_SCHEMA),
  schema_version: SemVerSchema,
  id: IdSchema,
  kind: z.literal('image'),
  file: ResourceRefSchema,
  sha256: Sha256Schema,
  format: z.enum(['png', 'jpeg']),
  width: z.number().int().positive().max(16384),
  height: z.number().int().positive().max(16384),
  /** Point à garder au plus près du centre du cadre (fractions 0..1). */
  focal_point: z.strictObject({ x: Unit, y: Unit }),
  regions: z.record(RegionNameSchema, UnitRectSchema),
  alt: z.string().min(1).max(300),
  provenance: z.strictObject({
    source: z.enum(['generated', 'owned', 'licensed']),
    license: z.string().min(1).max(200),
    /** Comment l'image a été obtenue (commande, outil, auteur). */
    method: z.string().min(1).max(600),
  }),
});
export type AssetDefinition = z.infer<typeof AssetDefinitionSchema>;

export type AssetRegistry = ReadonlyMap<string, AssetDefinition>;
