import { z } from 'zod';

import { CueIdSchema, HexColorSchema, IdSchema, SemVerSchema, Sha256Schema } from './common.ts';
import { EasingSchema } from './style-profile.ts';

export const RENDER_PLAN_SCHEMA = 'render-plan';
/** 0.2.0 : pistes fusionnées par propriété (sources multiples), provenance des comportements, source du timing. */
/** 0.3.0 : annotation « voix seule » par scène (intervalles en frames, ignorés par les renderers). */
/**
 * 0.4.0 : texte mesuré par le compilateur (HarfBuzz) — runs positionnés, glyphes,
 * lignes de base, encre, ajustement ; images recadrées (point focal, régions,
 * traitement) ; zone utile du canevas ; provenance typographique.
 */
/**
 * 0.5.0 (P1.5 — Visual Integrity & Image Motion) : propriétés génériques de
 * contenu d'image (content_scale, content_x, content_y) et origine du contenu ;
 * rapport de contraste MESURÉ par texte (et dérogation explicite) ; provenance
 * des analyses d'assets et des règles de lisibilité ; portabilité déclarée.
 */
export const RENDER_PLAN_VERSION = '0.5.0';

const Frame = z.number().int().min(0);
const Px = z.number().finite();

export const BoxSchema = z.strictObject({ x: Px, y: Px, w: z.number().min(0), h: z.number().min(0) });
export type Box = z.infer<typeof BoxSchema>;

/** Propriétés animables. Un nouveau type de rendu (morphing, uniformes de shader) ajoute ici une propriété. */
export const TRACK_PROPERTIES = [
  'opacity',
  'translate_x',
  'translate_y',
  'scale',
  'rotate',
  'clip_top',
  'clip_right',
  'clip_bottom',
  'clip_left',
  'path_progress',
  'color',
  'content_scale',
  'content_x',
  'content_y',
] as const;
export const TrackPropertySchema = z.enum(TRACK_PROPERTIES);
export type TrackProperty = z.infer<typeof TrackPropertySchema>;

export const KeyframeSchema = z.strictObject({
  frame: Frame,
  value: z.union([z.number().finite(), HexColorSchema]),
  /** Courbe appliquée entre cette clé et la suivante. */
  ease: EasingSchema.optional(),
});
export type Keyframe = z.infer<typeof KeyframeSchema>;

export const TrackSchema = z.strictObject({
  property: TrackPropertySchema,
  target: z.strictObject({ run: IdSchema.optional(), line: z.number().int().min(0).optional() }).optional(),
  keys: z.array(KeyframeSchema).min(1),
  /** Instances de comportements ayant produit ces clés, dans l'ordre du temps (traçabilité). */
  sources: z.array(IdSchema).min(1),
});
export type Track = z.infer<typeof TrackSchema>;

/** Glyphe mis en forme : identifiant dans la police, grappe source, position (px, relative au run). */
export const PlanGlyphSchema = z.strictObject({
  g: z.number().int().min(0),
  cl: z.number().int().min(0),
  x: Px,
  dx: Px,
  dy: Px,
});
export type PlanGlyph = z.infer<typeof PlanGlyphSchema>;

export const PlanRunSchema = z.strictObject({
  /** Identifiant du run de la spec ; un run coupé sur deux lignes garde son identifiant. */
  id: IdSchema,
  /** Texte affiché : typographie de locale et casse appliquées. */
  text: z.string(),
  font: IdSchema,
  weight: z.number().int(),
  size: z.number().positive(),
  tracking_px: Px,
  color: HexColorSchema,
  /** Origine du run, relative à la boîte du calque (px), mesurée par le compilateur. */
  x: Px,
  /** Avance mesurée (px, espacement compris). */
  width: z.number().min(0),
  glyphs: z.array(PlanGlyphSchema),
});
export type PlanRun = z.infer<typeof PlanRunSchema>;

const InkSchema = z.strictObject({ x0: Px, x1: Px, y0: Px, y1: Px });

/** Ligne déjà coupée ET positionnée par le compilateur : le renderer ne recoupe ni ne place jamais. */
export const PlanLineSchema = z.strictObject({
  runs: z.array(PlanRunSchema).min(1),
  /** Haut de la boîte de ligne, relatif à la boîte du calque. */
  top: Px,
  height: z.number().positive(),
  /** Ligne de base, relative à la boîte du calque (px). */
  baseline: Px,
  /** Largeur d'avance du texte visible (espaces de fin exclues). */
  measured_width: z.number().min(0),
  /** Encre de la ligne, relative à la boîte du calque. */
  ink: InkSchema.nullable(),
});
export type PlanLine = z.infer<typeof PlanLineSchema>;

interface PlanNodeCommon {
  id: string;
  box: Box;
  /** Origine des transformations, relative à la boîte (0..1). */
  origin: { x: number; y: number };
  opacity: number;
  tracks: Track[];
}

export interface PlanTextNode extends PlanNodeCommon {
  type: 'text';
  align: 'start' | 'center' | 'end';
  lines: PlanLine[];
  /** Ajustement retenu : rôle, rapport à la taille du rôle, taille finale, politique de coupure. */
  fit: { role: string; ratio: number; size: number; policy: 'explicit' | 'balance' };
  /** Encre du bloc au repos, coordonnées absolues (null : aucun glyphe dessiné). */
  ink: Box | null;
  /** Lisibilité MESURÉE sur le fond réellement rencontré (P1.5). */
  contrast: PlanTextContrast;
}
export interface PlanTextContrast {
  category: 'large' | 'normal';
  /** Seuil appliqué : plancher du moteur relevé par le style, ou dérogation explicite. */
  required: number;
  /** Plus petit contraste mesuré (quantile par glyphe, minimum sur glyphes, couleurs et frames). */
  measured: number;
  /** Où le minimum a été rencontré. */
  worst: { run: string; line: number; frame: number };
  /** Frames examinées (une seule si rien ne bouge sous le texte). */
  frames: number;
  override: { min_ratio: number; reason: string } | null;
}
export interface PlanShapeNode extends PlanNodeCommon {
  type: 'shape';
  shape: 'rect' | 'ellipse';
  radius: number;
  fill: string | null;
  stroke: { color: string; width: number } | null;
}
export interface PlanImageTreatment {
  /** 0 : couleur d'origine ; 1 : niveaux de gris. */
  grayscale: number;
  /** Multiplicateur de contraste (1 : inchangé). */
  contrast: number;
  /** Voile coloré posé sur l'image (étalonnage chaud/froid, duotone approché). */
  tint: { color: string; opacity: number } | null;
}
export interface PlanImageNode extends PlanNodeCommon {
  type: 'image';
  asset: string;
  fit: 'cover' | 'contain';
  /** Recadrage dans l'image source, en pixels source ; la boîte est la zone réellement dessinée. */
  crop: Box;
  /** Point focal retenu, en pixels source (traçabilité). */
  focus: { x: number; y: number };
  /** Origine des transformations de CONTENU (content_*), relative à la boîte (0..1) : le point focal projeté. */
  content_origin: { x: number; y: number };
  /** Régions sémantiques projetées sur le canevas (coordonnées absolues, découpées à la boîte). */
  regions: Record<string, Box>;
  treatment: PlanImageTreatment;
}
export interface PlanPathNode extends PlanNodeCommon {
  type: 'path';
  /** Tracé SVG en pixels, relatif à la boîte. */
  d: string;
  stroke: { color: string; width: number; cap: 'butt' | 'round' | 'square' };
}
export interface PlanGroupNode extends PlanNodeCommon {
  type: 'group';
  children: PlanNode[];
}
export interface PlanMaskNode extends PlanNodeCommon {
  type: 'mask';
  clip: { shape: 'rect' | 'ellipse'; radius: number };
  children: PlanNode[];
}
export type PlanNode = PlanTextNode | PlanShapeNode | PlanImageNode | PlanPathNode | PlanGroupNode | PlanMaskNode;

const nodeCommon = {
  id: IdSchema,
  box: BoxSchema,
  origin: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  opacity: z.number().min(0).max(1),
  tracks: z.array(TrackSchema),
};

export const PlanNodeSchema: z.ZodType<PlanNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({
      ...nodeCommon,
      type: z.literal('text'),
      align: z.enum(['start', 'center', 'end']),
      lines: z.array(PlanLineSchema).min(1),
      fit: z.strictObject({
        role: z.string().min(1),
        ratio: z.number().gt(0).max(1),
        size: z.number().positive(),
        policy: z.enum(['explicit', 'balance']),
      }),
      ink: BoxSchema.nullable(),
      contrast: z.strictObject({
        category: z.enum(['large', 'normal']),
        required: z.number().min(1).max(21),
        measured: z.number().min(1).max(21),
        worst: z.strictObject({ run: IdSchema, line: z.number().int().min(0), frame: Frame }),
        frames: z.number().int().min(1),
        override: z.strictObject({ min_ratio: z.number().min(1).max(21), reason: z.string().min(1) }).nullable(),
      }),
    }),
    z.strictObject({
      ...nodeCommon,
      type: z.literal('shape'),
      shape: z.enum(['rect', 'ellipse']),
      radius: z.number().min(0),
      fill: HexColorSchema.nullable(),
      stroke: z.strictObject({ color: HexColorSchema, width: z.number().positive() }).nullable(),
    }),
    z.strictObject({
      ...nodeCommon,
      type: z.literal('image'),
      asset: IdSchema,
      fit: z.enum(['cover', 'contain']),
      crop: BoxSchema,
      focus: z.strictObject({ x: Px, y: Px }),
      content_origin: z.strictObject({ x: z.number(), y: z.number() }),
      regions: z.record(z.string(), BoxSchema),
      treatment: z.strictObject({
        grayscale: z.number().min(0).max(1),
        contrast: z.number().min(0).max(3),
        tint: z.strictObject({ color: HexColorSchema, opacity: z.number().min(0).max(1) }).nullable(),
      }),
    }),
    z.strictObject({
      ...nodeCommon,
      type: z.literal('path'),
      d: z.string().min(1),
      stroke: z.strictObject({
        color: HexColorSchema,
        width: z.number().positive(),
        cap: z.enum(['butt', 'round', 'square']),
      }),
    }),
    z.strictObject({ ...nodeCommon, type: z.literal('group'), children: z.array(PlanNodeSchema) }),
    z.strictObject({
      ...nodeCommon,
      type: z.literal('mask'),
      clip: z.strictObject({ shape: z.enum(['rect', 'ellipse']), radius: z.number().min(0) }),
      children: z.array(PlanNodeSchema),
    }),
  ]),
);

export const PlanSceneSchema = z.strictObject({
  id: IdSchema,
  from: Frame,
  /** Frame de fin exclusive. */
  to: Frame,
  background: HexColorSchema,
  nodes: z.array(PlanNodeSchema),
  /**
   * Annotation (pas une phase) : la parole continue sans aucun comportement
   * visuel actif. Frames [from, to). Ignorée par les renderers.
   */
  voice_only: z.array(z.strictObject({ from: Frame, to: Frame })),
});
export type PlanScene = z.infer<typeof PlanSceneSchema>;

export const RenderPlanSchema = z.strictObject({
  schema: z.literal(RENDER_PLAN_SCHEMA),
  schema_version: SemVerSchema,
  spec: z.strictObject({ spec_id: IdSchema, revision: z.number().int().min(1), sha256: Sha256Schema }),
  /** Style résolu utilisé : empreinte du ResolvedStyle et mode. */
  style: z.strictObject({ mode: z.enum(['creative', 'brand', 'series']), sha256: Sha256Schema }),
  compiler_version: SemVerSchema,
  /** Promesse de la spec compilée (P1.5). */
  composition: z.strictObject({ portability: z.enum(['portable', 'style_bound']) }),
  /** estimated : parole estimée (aucune voix réelle) ; aligned : voix alignée (P3) ; none : aucune ancre de parole. */
  timing_source: z.enum(['estimated', 'aligned', 'none']),
  reduced_motion: z.boolean(),
  /** Métadonnées de traçabilité : ignorées par les renderers. */
  provenance: z.strictObject({
    behavior_registry: z.strictObject({ version: SemVerSchema, sha256: Sha256Schema }),
    behaviors: z.array(
      z.strictObject({ instance: IdSchema, behavior: z.string(), version: SemVerSchema, scene: IdSchema, layer: IdSchema.nullable() }),
    ),
    /** Règles typographiques de locale, moteur de mesure, et replis de glyphes appliqués. */
    /** Analyses de pixels utilisées (empreinte du document d'analyse) et règles de lisibilité. */
    visual: z.strictObject({
      readability_rules: z.string().min(1),
      analysis_algorithm: SemVerSchema,
      analyses: z.array(z.strictObject({ ref: IdSchema, decoder: z.string().min(1), sha256: Sha256Schema })),
    }),
    typography: z.strictObject({
      rules: z.string().min(1),
      shaper: z.string().min(1),
      substitutions: z.array(z.strictObject({ font: Sha256Schema, character: z.string(), replacement: z.string() })),
    }),
  }),
  canvas: z.strictObject({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
    duration_frames: z.number().int().positive(),
    /** Zone utile : marges du style ∩ zones sûres des plateformes visées. */
    safe_area: BoxSchema,
  }),
  fonts: z.array(
    z.strictObject({
      id: IdSchema,
      css_name: z.string(),
      weight: z.number().int(),
      style: z.enum(['normal', 'italic']),
      file: z.string(),
      sha256: Sha256Schema,
    }),
  ),
  assets: z.array(
    z.strictObject({
      ref: IdSchema,
      file: z.string(),
      sha256: Sha256Schema,
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  ),
  scenes: z.array(PlanSceneSchema).min(1),
});
export type RenderPlan = z.infer<typeof RenderPlanSchema>;

/** Montage audio : la voix n'est jamais étirée, seuls les silences entre segments changent. */
export const AudioPlanSchema = z.strictObject({
  schema: z.literal('audio-plan'),
  schema_version: SemVerSchema,
  duration_s: z.number().positive(),
  voice: z
    .strictObject({
      file: z.string(),
      sha256: Sha256Schema,
      segments: z.array(
        z.strictObject({
          id: IdSchema,
          source_start_s: z.number().min(0),
          source_end_s: z.number().min(0),
          start_s: z.number().min(0),
        }),
      ),
    })
    .nullable(),
  cues: z.array(
    z.strictObject({
      cue: CueIdSchema,
      t_s: z.number().min(0),
      gain_db: z.number().max(0),
      source_event: IdSchema,
    }),
  ),
  target_lufs: z.number().min(-30).max(-8),
  true_peak_dbtp: z.number().min(-6).max(0),
});
export type AudioPlan = z.infer<typeof AudioPlanSchema>;

export const SubtitlePlanSchema = z.strictObject({
  schema: z.literal('subtitle-plan'),
  schema_version: SemVerSchema,
  cues: z.array(
    z.strictObject({
      scene: IdSchema,
      start_s: z.number().min(0),
      end_s: z.number().min(0),
      lines: z.array(z.string()).min(1).max(3),
    }),
  ),
});
export type SubtitlePlan = z.infer<typeof SubtitlePlanSchema>;
