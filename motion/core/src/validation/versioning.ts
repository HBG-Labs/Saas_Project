import type { z } from 'zod';

import { ASSET_SCHEMA, ASSET_VERSION, AssetDefinitionSchema } from '../contracts/asset.ts';
import type { AssetDefinition } from '../contracts/asset.ts';
import { BRAND_PROFILE_SCHEMA, BRAND_PROFILE_VERSION, BrandMotionProfileSchema } from '../contracts/brand-profile.ts';
import type { BrandMotionProfile } from '../contracts/brand-profile.ts';
import { CREATIVE_INTENT_SCHEMA, CREATIVE_INTENT_VERSION, CreativeIntentSchema } from '../contracts/creative-intent.ts';
import type { CreativeIntent } from '../contracts/creative-intent.ts';
import { MANIFEST_SCHEMA, MANIFEST_VERSION, ReproducibilityManifestSchema } from '../contracts/manifest.ts';
import type { ReproducibilityManifest } from '../contracts/manifest.ts';
import { MOTION_SPEC_SCHEMA, MOTION_SPEC_VERSION, MotionSceneSpecSchema } from '../contracts/motion-spec.ts';
import type { MotionSceneSpec } from '../contracts/motion-spec.ts';
import { PATTERN_SCHEMA, PATTERN_VERSION, PatternDefinitionSchema } from '../contracts/pattern.ts';
import type { PatternDefinition } from '../contracts/pattern.ts';
import { PLATFORM_PRESETS_SCHEMA, PLATFORM_PRESETS_VERSION, PlatformPresetsSchema } from '../contracts/platform.ts';
import type { PlatformPresets } from '../contracts/platform.ts';
import { RENDER_PLAN_SCHEMA, RENDER_PLAN_VERSION, RenderPlanSchema } from '../contracts/render-plan.ts';
import type { RenderPlan } from '../contracts/render-plan.ts';
import { RESOLVED_STYLE_SCHEMA, RESOLVED_STYLE_VERSION, ResolvedStyleSchema } from '../contracts/resolved-style.ts';
import type { ResolvedStyle } from '../contracts/resolved-style.ts';
import { SERIES_PROFILE_SCHEMA, SERIES_PROFILE_VERSION, SeriesMotionProfileSchema } from '../contracts/series-profile.ts';
import type { SeriesMotionProfile } from '../contracts/series-profile.ts';
import { STYLE_PROFILE_SCHEMA, STYLE_PROFILE_VERSION, CreativeStyleProfileSchema } from '../contracts/style-profile.ts';
import type { CreativeStyleProfile } from '../contracts/style-profile.ts';
import type { ValidationIssue } from './issues.ts';
import { parseStructure } from './structural.ts';

export interface DocumentKinds {
  'asset-definition': AssetDefinition;
  'creative-intent': CreativeIntent;
  'creative-style-profile': CreativeStyleProfile;
  'brand-motion-profile': BrandMotionProfile;
  'series-motion-profile': SeriesMotionProfile;
  'resolved-style': ResolvedStyle;
  'platform-presets': PlatformPresets;
  'pattern-definition': PatternDefinition;
  'motion-scene-spec': MotionSceneSpec;
  'render-plan': RenderPlan;
  'reproducibility-manifest': ReproducibilityManifest;
}
export type DocumentKind = keyof DocumentKinds;

type Migrator = (doc: Record<string, unknown>) => Record<string, unknown>;

interface KindEntry<T> {
  current: string;
  schema: z.ZodType<T>;
  /** Migrations d'une version vers la suivante. Vide tant qu'une seule version existe. */
  migrations: Record<string, { to: string; migrate: Migrator }>;
}

const REGISTRY: { [K in DocumentKind]: KindEntry<DocumentKinds[K]> } = {
  [ASSET_SCHEMA]: { current: ASSET_VERSION, schema: AssetDefinitionSchema, migrations: {} },
  [CREATIVE_INTENT_SCHEMA]: { current: CREATIVE_INTENT_VERSION, schema: CreativeIntentSchema, migrations: {} },
  [STYLE_PROFILE_SCHEMA]: {
    current: STYLE_PROFILE_VERSION,
    schema: CreativeStyleProfileSchema,
    migrations: {
      // Avant 0.4.0, rien n'était mesuré ni réduit : min_scale 1 conserve ce comportement.
      '0.3.0': {
        to: '0.4.0',
        migrate: (doc) => ({
          ...doc,
          typography: { ...(doc['typography'] as Record<string, unknown>), fit: { min_scale: 1, scope: 'role' } },
          // Aucun voile n'était appliqué avant 0.4.0.
          image_treatment: { ...(doc['image_treatment'] as Record<string, unknown>), tint: null },
        }),
      },
      // P1.5 : aucun mouvement d'image avant 0.5.0 (amplitudes nulles) ; planchers du moteur.
      '0.4.0': {
        to: '0.5.0',
        migrate: (doc) => {
          const motion = doc['motion_personality'] as Record<string, unknown>;
          const rhythm = doc['rhythm_personality'] as Record<string, unknown>;
          return {
            ...doc,
            motion_personality: {
              ...motion,
              amplitude: { ...(motion['amplitude'] as Record<string, unknown>), image_push_scale: null, image_pan_scale: null, image_pan_travel: null },
            },
            rhythm_personality: {
              ...rhythm,
              reading: { ...(rhythm['reading'] as Record<string, unknown>), min_contrast: { large: 3, normal: 4.5 } },
            },
          };
        },
      },
    },
  },
  [BRAND_PROFILE_SCHEMA]: { current: BRAND_PROFILE_VERSION, schema: BrandMotionProfileSchema, migrations: {} },
  [SERIES_PROFILE_SCHEMA]: { current: SERIES_PROFILE_VERSION, schema: SeriesMotionProfileSchema, migrations: {} },
  [RESOLVED_STYLE_SCHEMA]: { current: RESOLVED_STYLE_VERSION, schema: ResolvedStyleSchema, migrations: {} },
  [PLATFORM_PRESETS_SCHEMA]: { current: PLATFORM_PRESETS_VERSION, schema: PlatformPresetsSchema, migrations: {} },
  [PATTERN_SCHEMA]: { current: PATTERN_VERSION, schema: PatternDefinitionSchema, migrations: {} },
  [MOTION_SPEC_SCHEMA]: { current: MOTION_SPEC_VERSION, schema: MotionSceneSpecSchema, migrations: {} },
  [RENDER_PLAN_SCHEMA]: { current: RENDER_PLAN_VERSION, schema: RenderPlanSchema, migrations: {} },
  [MANIFEST_SCHEMA]: {
    current: MANIFEST_VERSION,
    schema: ReproducibilityManifestSchema,
    migrations: {
      // Un manifeste 0.1.0 ne disait rien de l'espace colorimétrique : il reste inconnu.
      // L'empreinte d'origine est conservée telle quelle, elle décrivait le document 0.1.0.
      '0.1.0': {
        to: '0.2.0',
        migrate: (doc) => ({
          ...doc,
          render_config: { ...(doc['render_config'] as Record<string, unknown>), color_space: null },
        }),
      },
      // Un manifeste 0.2.0 ne disait rien de l'état git ni de la source du
      // timing : ils restent inconnus, et un rendu inconnu n'est jamais « de référence ».
      '0.2.0': {
        to: '0.3.0',
        migrate: (doc) => ({
          ...doc,
          engine: { ...(doc['engine'] as Record<string, unknown>), git_dirty: null },
          reference_eligible: false,
          timing_source: 'unknown',
          behavior_registry: null,
          render_config: { ...(doc['render_config'] as Record<string, unknown>), reduced_motion: false },
        }),
      },
    },
  },
};

/** Spec 0.1.0 → 0.2.0 : chaque comportement épingle la version 1.0.0 (sémantique d'origine). */
function pinBehaviorVersions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pinBehaviorVersions);
  if (value === null || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(obj)) {
    if (key === 'transition_out' && child !== null && typeof child === 'object') {
      out[key] = { ...(child as Record<string, unknown>), version: '1.0.0' };
    } else if (key === 'behaviors' && Array.isArray(child)) {
      out[key] = child.map((b) => ({ ...(b as Record<string, unknown>), version: '1.0.0' }));
    } else {
      out[key] = pinBehaviorVersions(child);
    }
  }
  return out;
}
REGISTRY[MOTION_SPEC_SCHEMA].migrations['0.1.0'] = {
  to: '0.2.0',
  migrate: (doc) => ({ ...doc, scenes: pinBehaviorVersions(doc['scenes']) }),
};
/** Spec 0.2.0 → 0.3.0 : ajouts facultatifs (region, bleed), rien à transformer. */
REGISTRY[MOTION_SPEC_SCHEMA].migrations['0.2.0'] = { to: '0.3.0', migrate: (doc) => doc };
/**
 * Spec 0.3.0 → 0.4.0 (P1.5) : une spec antérieure n'a jamais PROMIS d'être portable.
 * Elle devient `style_bound` ; la déclarer portable est un acte explicite, validé.
 */
REGISTRY[MOTION_SPEC_SCHEMA].migrations['0.3.0'] = {
  to: '0.4.0',
  migrate: (doc) => ({ ...doc, composition: { portability: 'style_bound' } }),
};

export function currentVersion(kind: DocumentKind): string {
  return REGISTRY[kind].current;
}

export function documentKinds(): DocumentKind[] {
  return Object.keys(REGISTRY) as DocumentKind[];
}

/**
 * Lit un document versionné : vérifie son type, le migre jusqu'à la version
 * courante si un chemin existe, puis applique le schéma strict. Une version
 * inconnue est refusée, jamais interprétée « au mieux ».
 */
export function readVersioned<K extends DocumentKind>(
  kind: K,
  input: unknown,
): { ok: true; value: DocumentKinds[K]; migratedFrom: string | null } | { ok: false; issues: ValidationIssue[] } {
  const entry = REGISTRY[kind] as KindEntry<DocumentKinds[K]>;
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, issues: [issue('version.not_object', '', 'objet JSON attendu')] };
  }
  let doc = input as Record<string, unknown>;
  if (doc['schema'] !== kind) {
    return {
      ok: false,
      issues: [issue('version.wrong_kind', 'schema', `document « ${kind} » attendu, reçu « ${String(doc['schema'])} »`)],
    };
  }
  const original = typeof doc['schema_version'] === 'string' ? doc['schema_version'] : null;
  if (original === null) {
    return { ok: false, issues: [issue('version.missing', 'schema_version', 'version de schéma absente')] };
  }
  let version = original;
  const seen = new Set<string>();
  while (version !== entry.current) {
    const step = entry.migrations[version];
    if (!step || seen.has(version)) {
      return {
        ok: false,
        issues: [
          issue(
            'version.unsupported',
            'schema_version',
            `version ${version} non prise en charge (courante : ${entry.current}) et aucune migration disponible`,
          ),
        ],
      };
    }
    seen.add(version);
    doc = { ...step.migrate(doc), schema_version: step.to };
    version = step.to;
  }
  const parsed = parseStructure(entry.schema, doc);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value, migratedFrom: original === entry.current ? null : original };
}

function issue(code: string, path: string, message: string): ValidationIssue {
  return { code, path, message, severity: 'error' };
}
