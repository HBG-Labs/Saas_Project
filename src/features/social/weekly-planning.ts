import { z } from 'zod';

import type { Json, Tables, TablesUpdate } from '@/types/database';

export const SOCIAL_WEEK_DAYS = [
  'LUNDI',
  'MARDI',
  'MERCREDI',
  'JEUDI',
  'VENDREDI',
  'SAMEDI',
  'DIMANCHE',
] as const;

export const SOCIAL_OBJECTIVES = [
  'Gagner des abonnes qualifies',
  'Augmenter les visites du profil',
  'Obtenir des clics vers REZO360',
  'Obtenir des inscriptions',
  'Presenter une fonctionnalite',
  'Augmenter l’engagement',
  'Developper la notoriete',
] as const;

export const SOCIAL_AUDIENCES = [
  'Artisans',
  'Plombiers',
  'Electriciens',
  'Paysagistes',
  'Entreprises de nettoyage',
  'Climatisation',
  'BTP',
  'Maintenance',
  'Fibre/reseaux',
  'TPE',
  'PME',
  'Autre',
] as const;

export type SocialWeek = Tables<'social_weeks'>;
export type SocialPost = Tables<'social_posts'>;
export type SocialPostAsset = Tables<'social_post_assets'>;
export type SocialPostAssetWithPreview = SocialPostAsset & { signedUrl?: string };
export type SocialPostWithAssets = SocialPost & { assets: SocialPostAssetWithPreview[] };
export type SocialPublishState = SocialPost['publish_state'];

export interface SocialStudioWeek {
  week: SocialWeek;
  posts: SocialPostWithAssets[];
}

export const socialPostContentSchema = z
  .object({
    planned_for: z.string().datetime().nullable().optional(),
    objective: z.string().trim().max(120).nullable().optional(),
    audience: z.string().trim().max(120).nullable().optional(),
    mock_theme: z.string().trim().max(120).nullable().optional(),
    placeholder_variant: z.string().trim().max(40).nullable().optional(),
  })
  .passthrough();

export type SocialPostContent = z.infer<typeof socialPostContentSchema>;

export const socialPostFormSchema = z.object({
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  plannedTime: z.string().regex(/^\d{2}:\d{2}$/, 'Heure invalide'),
  hook: z.string().trim().max(180, '180 caracteres maximum'),
  visualText: z.string().trim().max(140, '140 caracteres maximum'),
  caption: z.string().trim().max(2200, '2200 caracteres maximum'),
  cta: z.string().trim().max(180, '180 caracteres maximum'),
  objective: z.string().trim().min(1, 'Objectif requis').max(120),
  audience: z.string().trim().min(1, 'Audience requise').max(120),
});

export type SocialPostFormValues = z.infer<typeof socialPostFormSchema>;

export type SocialPostSaveIntent = 'draft' | 'ready';

export function validateSocialPostForm(values: SocialPostFormValues, intent: SocialPostSaveIntent) {
  const parsed = socialPostFormSchema.safeParse(values);
  if (!parsed.success) return parsed;

  if (intent === 'ready') {
    const readySchema = socialPostFormSchema.extend({
      hook: z.string().trim().min(6, 'Hook requis pour passer en READY').max(180),
      visualText: z.string().trim().min(3, 'Texte visuel requis').max(140),
      caption: z.string().trim().min(10, 'Legende requise pour passer en READY').max(2200),
      cta: z.string().trim().min(3, 'CTA requis').max(180),
    });
    return readySchema.safeParse(values);
  }

  return parsed;
}

export function readSocialPostContent(content: Json): SocialPostContent {
  const parsed = socialPostContentSchema.safeParse(content);
  return parsed.success ? parsed.data : {};
}

export function mergeSocialPostContent(
  post: Pick<SocialPost, 'content'>,
  patch: SocialPostContent,
): Json {
  const current = readSocialPostContent(post.content);
  return { ...current, ...patch } as Json;
}

export function socialPostFormToPatch(
  post: SocialPost,
  values: SocialPostFormValues,
  intent: SocialPostSaveIntent,
): TablesUpdate<'social_posts'> {
  const plannedFor = localDateTimeToIso(values.plannedDate, values.plannedTime);
  const wasScheduled = post.status === 'scheduled' || post.publish_state === 'scheduled';

  return {
    status: intent === 'ready' ? 'ready' : 'draft',
    ...(wasScheduled
      ? {
          scheduled_at: null,
          approved_by: null,
          approved_at: null,
          selected_asset_id: null,
          schedule_timezone: null,
          approved_snapshot: {},
          publish_state: 'not_scheduled' as const,
          publish_attempt_id: null,
          publish_locked_at: null,
          publish_lock_token: null,
          publish_next_attempt_at: null,
          publish_last_error_code: null,
          publish_last_error_kind: null,
          last_error: null,
        }
      : {}),
    hook: values.hook.trim() || null,
    visual_text: values.visualText.trim() || null,
    caption: values.caption.trim() || null,
    cta: values.cta.trim() || null,
    content: mergeSocialPostContent(post, {
      planned_for: plannedFor,
      objective: values.objective.trim(),
      audience: values.audience.trim(),
    }),
  };
}

export function dateToInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function currentWeekStartsOn(reference = new Date()): string {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return dateToInputValue(date);
}

export function addDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateToInputValue(date);
}

export function localDateTimeToIso(dateValue: string, timeValue: string): string {
  return new Date(`${dateValue}T${timeValue}:00`).toISOString();
}

export function splitIsoDateTime(value: string | null | undefined, fallbackDate: string) {
  if (!value) return { date: fallbackDate, time: '18:30' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: fallbackDate, time: '18:30' };

  return {
    date: dateToInputValue(date),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

export function formatShortDate(dateValue: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' })
    .format(new Date(`${dateValue}T00:00:00`))
    .replace('.', '')
    .toUpperCase();
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return 'Heure a definir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Heure a definir';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
}

export function postPlannedFor(post: SocialPost): string | null {
  return post.scheduled_at ?? readSocialPostContent(post.content).planned_for ?? null;
}

export function postObjective(post: SocialPost, week?: SocialWeek): string {
  return readSocialPostContent(post.content).objective ?? week?.objective ?? 'Objectif a definir';
}

export function postAudience(post: SocialPost, week?: SocialWeek): string {
  return readSocialPostContent(post.content).audience ?? week?.audience ?? 'Audience a definir';
}

export function preferredSocialPostAsset(
  post: SocialPostWithAssets,
): SocialPostAssetWithPreview | null {
  return (
    post.assets.find((asset) => asset.kind === 'selected') ??
    post.assets.find((asset) => asset.kind === 'generated') ??
    post.assets[0] ??
    null
  );
}

export function selectedFinalSocialPostAsset(
  post: SocialPostWithAssets,
): SocialPostAssetWithPreview | null {
  return post.assets.find((asset) => asset.kind === 'selected') ?? null;
}

export function isFinalInstagramAsset(asset: SocialPostAssetWithPreview | null): boolean {
  return (
    asset !== null &&
    asset.kind === 'selected' &&
    asset.width === 1080 &&
    asset.height === 1350 &&
    ['image/png', 'image/jpeg', 'image/webp'].includes(asset.mime_type ?? '') &&
    (asset.size_bytes === null || asset.size_bytes > 0)
  );
}
