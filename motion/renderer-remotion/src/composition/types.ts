import type { RenderPlan } from '@motion-engine/core/runtime';

/** Police fournie au navigateur : octets du fichier déclaré par le Render Plan, déjà vérifiés par empreinte. */
export interface FontSource {
  id: string;
  css_name: string;
  weight: number;
  style: 'normal' | 'italic';
  data_url: string;
}

/**
 * Plan audio accepté par la composition. En P1.2 aucune piste n'a de fichier :
 * la composition ne produit donc aucun son. La forme est prête pour P3.
 */
export interface CompositionAudio {
  voice: { src: string; start_s: number } | null;
  cues: { src: string; t_s: number; gain_db: number }[];
}

/** Image fournie au navigateur : octets de l'asset déclaré par le Render Plan, vérifiés par empreinte. */
export interface ImageSource {
  asset: string;
  data_url: string;
}

export interface PlanVideoProps extends Record<string, unknown> {
  plan: RenderPlan;
  fonts: FontSource[];
  images: ImageSource[];
  audio: CompositionAudio | null;
}

/** Préfixe des messages de contrôle qualité émis depuis le navigateur. */
export const QC_PREFIX = '[motion-qc]';

/** Identifiant de la composition Remotion (partagé entre le bundle et le côté Node). */
export const COMPOSITION_ID = 'motion-plan';
