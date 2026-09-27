import { readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

/** Profil de rendu : résolution, encodage, parallélisme, cibles audio. Données, pas code. */
export const RenderProfileSchema = z.strictObject({
  name: z.string().regex(/^[a-z][a-z0-9_-]*$/),
  description: z.string().max(200),
  width: z.number().int().min(16).max(4096),
  height: z.number().int().min(16).max(4096),
  fps: z.number().int().min(1).max(120),
  codec: z.literal('h264'),
  crf: z.number().int().min(0).max(51),
  pixel_format: z.literal('yuv420p'),
  /** bt709 : plage vidéo standard (16–235) et balises BT.709, attendues par les plateformes sociales. */
  color_space: z.enum(['bt601', 'bt709', 'bt2020-ncl']),
  concurrency: z.number().int().min(1).max(16),
  audio: z.strictObject({ target_lufs: z.number().min(-30).max(-8), true_peak_dbtp: z.number().min(-6).max(0) }),
});
export type RenderProfile = z.infer<typeof RenderProfileSchema>;

export const PROFILES_DIR = path.resolve(import.meta.dirname, '..', '..', 'profiles');

export function loadRenderProfile(nameOrFile: string): RenderProfile {
  const file = nameOrFile.endsWith('.json') ? nameOrFile : path.join(PROFILES_DIR, `${nameOrFile}.json`);
  return RenderProfileSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}
