import { z } from 'zod';

import { isProduction } from '@/config/env';
import { messageDeLaFonction, supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/database';

import {
  SOCIAL_AUDIENCES,
  SOCIAL_OBJECTIVES,
  SOCIAL_WEEK_DAYS,
  addDays,
  browserTimeZone,
  currentWeekStartsOn,
  localDateTimeToIso,
  socialPostFormToPatch,
  type SocialPost,
  type SocialPostAsset,
  type SocialPostAssetWithPreview,
  type SocialPostFormValues,
  type SocialPostSaveIntent,
  type SocialPostWithAssets,
  type SocialStudioWeek,
  type SocialWeek,
} from '../weekly-planning';

const weekInput = z.object({
  organizationId: z.string().uuid(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const postImageInput = z.object({
  organizationId: z.string().uuid(),
  postId: z.string().uuid(),
});

const generateWeekResponse = z.object({
  status: z.enum(['generated', 'existing']),
  weekId: z.string().uuid(),
  postsCount: z.number().int().min(0).max(7),
  provider: z.string().optional(),
  model: z.string().optional(),
  usage: z
    .object({
      inputTokens: z.number().int().min(0),
      outputTokens: z.number().int().min(0),
      estimatedCost: z.number().nullable(),
      latencyMs: z.number().int().min(0),
    })
    .optional(),
});

const generateImagesResponse = z.object({
  status: z.enum(['generated', 'existing']),
  postId: z.string().uuid(),
  assetsCount: z.number().int().min(0).max(10),
  provider: z.string().optional(),
  model: z.string().optional(),
  usage: z
    .object({
      generationCount: z.number().int().min(0).max(10),
      promptChars: z.number().int().min(0),
      estimatedCost: z.number().nullable(),
      latencyMs: z.number().int().min(0),
    })
    .optional(),
});

const scheduleWeekResponse = z
  .array(
    z.object({
      week_id: z.string().uuid(),
      scheduled_count: z.number().int().min(0).max(7),
      schedule_status: z.enum(['scheduled', 'already_scheduled']),
      schedule_timezone: z.string().min(1),
    }),
  )
  .min(1);

const suspendWeekResponse = z
  .array(
    z.object({
      week_id: z.string().uuid(),
      suspended: z.boolean(),
      skipped_count: z.number().int().min(0).max(7),
    }),
  )
  .min(1);

const SOCIAL_MEDIA_BUCKET = 'social-media-assets';

const MOCK_POSTS = [
  {
    theme: 'Probleme administratif',
    hook: 'Vos papiers prennent plus de temps que vos chantiers ?',
    visualText: 'Moins de paperasse. Plus de terrain.',
    caption:
      'Quand les devis, interventions et documents restent au meme endroit, chaque equipe gagne du temps sans changer sa facon de travailler.',
    cta: 'Voir comment REZO360 simplifie la semaine',
    objective: SOCIAL_OBJECTIVES[1],
    audience: SOCIAL_AUDIENCES[0],
    time: '18:30',
  },
  {
    theme: 'Organisation des interventions',
    hook: '3 logiciels pour gerer une seule intervention ?',
    visualText: 'Une intervention. Un seul fil clair.',
    caption:
      'Le terrain a besoin de contexte, pas de captures ecran dispersees. REZO360 remet les infos utiles au meme endroit.',
    cta: 'Decouvrir le suivi d’intervention',
    objective: SOCIAL_OBJECTIVES[2],
    audience: SOCIAL_AUDIENCES[0],
    time: '18:30',
  },
  {
    theme: 'Fonctionnalite REZO360',
    hook: 'Le compte rendu ne devrait pas attendre le vendredi soir.',
    visualText: 'Rapports terrain sans rattrapage.',
    caption:
      'Un rapport clair au bon moment aide le bureau a facturer, rassure le client et evite les oublis de fin de semaine.',
    cta: 'Tester le flux terrain',
    objective: SOCIAL_OBJECTIVES[4],
    audience: SOCIAL_AUDIENCES[7],
    time: '12:15',
  },
  {
    theme: 'Question terrain',
    hook: 'Qui sait vraiment ou en est le chantier ?',
    visualText: 'Le bon statut, pour la bonne personne.',
    caption:
      'Une equipe avance mieux quand chacun voit ce qui est prevu, fait, bloque ou a relancer. C’est la base d’un pilotage simple.',
    cta: 'Reprendre le controle des suivis',
    objective: SOCIAL_OBJECTIVES[5],
    audience: SOCIAL_AUDIENCES[10],
    time: '18:45',
  },
  {
    theme: 'Situation terrain',
    hook: 'Le client rappelle. Personne n’a la derniere info.',
    visualText: 'Fin des infos perdues entre camion et bureau.',
    caption:
      'Les entreprises de terrain perdent rarement un client sur la technique. Elles le perdent sur le flou. REZO360 aide a garder le fil.',
    cta: 'Voir REZO360 en action',
    objective: SOCIAL_OBJECTIVES[6],
    audience: SOCIAL_AUDIENCES[9],
    time: '17:50',
  },
  {
    theme: 'Contenu leger',
    hook: 'Le meilleur outil ? Celui que l’equipe utilise vraiment.',
    visualText: 'Simple assez pour le terrain.',
    caption:
      'Un logiciel metier ne doit pas devenir un chantier de plus. L’objectif : moins de friction, plus de reflexes utiles.',
    cta: 'Parler organisation terrain',
    objective: SOCIAL_OBJECTIVES[5],
    audience: SOCIAL_AUDIENCES[0],
    time: '10:30',
  },
  {
    theme: 'Organisation de la semaine',
    hook: 'Votre lundi se prepare le dimanche en 10 minutes.',
    visualText: 'Une semaine lisible avant le premier appel.',
    caption:
      'Planning, priorites, documents, relances : une semaine claire commence avec un tableau de bord qui ne ment pas.',
    cta: 'Preparer la semaine avec REZO360',
    objective: SOCIAL_OBJECTIVES[3],
    audience: SOCIAL_AUDIENCES[10],
    time: '18:00',
  },
] as const;

function byPostId(assets: SocialPostAsset[]): Map<string, SocialPostAsset[]> {
  const grouped = new Map<string, SocialPostAsset[]>();
  for (const asset of assets) {
    const list = grouped.get(asset.post_id) ?? [];
    list.push(asset);
    grouped.set(asset.post_id, list);
  }
  return grouped;
}

async function listAssetsForPosts(
  organizationId: string,
  posts: SocialPost[],
): Promise<SocialPostAssetWithPreview[]> {
  const ids = posts.map((post) => post.id);
  if (ids.length === 0) return [];

  const assets = await unwrap(
    supabase
      .from('social_post_assets')
      .select('*')
      .eq('organization_id', organizationId)
      .in('post_id', ids)
      .order('position'),
  );
  return withSignedAssetUrls(assets);
}

async function withSignedAssetUrls(
  assets: SocialPostAsset[],
): Promise<SocialPostAssetWithPreview[]> {
  const paths = assets.map((asset) => asset.storage_path).filter(Boolean);
  if (paths.length === 0) return assets;

  const { data, error } = await supabase.storage
    .from(SOCIAL_MEDIA_BUCKET)
    .createSignedUrls(paths, 3600);
  if (error) return assets;

  const signedByPath = new Map<string, string>();
  for (const row of (data ?? []) as Array<{
    path?: string | null;
    signedUrl?: string | null;
    signedURL?: string | null;
  }>) {
    const signedUrl = row.signedUrl ?? row.signedURL ?? null;
    if (row.path && signedUrl) signedByPath.set(row.path, signedUrl);
  }

  return assets.map((asset) => {
    const signedUrl = signedByPath.get(asset.storage_path);
    return signedUrl ? { ...asset, signedUrl } : asset;
  });
}

export async function getSocialStudioWeek(
  organizationId: string,
  startsOn = currentWeekStartsOn(),
): Promise<SocialStudioWeek | null> {
  weekInput.parse({ organizationId, startsOn });

  const week = await unwrapMaybe(
    supabase
      .from('social_weeks')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('starts_on', startsOn)
      .maybeSingle(),
  );
  if (week === null) return null;

  const posts = await unwrap(
    supabase
      .from('social_posts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('week_id', week.id)
      .order('slot_index'),
  );
  const assets = await listAssetsForPosts(organizationId, posts);
  const assetsByPost = byPostId(assets);

  return {
    week,
    posts: posts.map((post) => ({ ...post, assets: assetsByPost.get(post.id) ?? [] })),
  };
}

async function ensureWeek(organizationId: string, startsOn: string): Promise<SocialWeek> {
  const existing = await getSocialStudioWeek(organizationId, startsOn);
  if (existing) return existing.week;

  return unwrap(
    supabase
      .from('social_weeks')
      .insert({
        organization_id: organizationId,
        starts_on: startsOn,
        status: 'draft',
        objective: 'Obtenir davantage de prospects artisans',
        audience: 'Artisans',
        zone: 'France + DOM',
        strategy: {
          source: 'phase_c_mock_week',
          note: 'Brouillons de developpement reserves aux tests locaux Social Studio.',
        },
      })
      .select('*')
      .single(),
  );
}

function mockPostInsert(
  organizationId: string,
  week: SocialWeek,
  slotIndex: number,
): TablesInsert<'social_posts'> {
  const mock = MOCK_POSTS[slotIndex - 1]!;
  const dayDate = addDays(week.starts_on, slotIndex - 1);

  return {
    organization_id: organizationId,
    week_id: week.id,
    account_id: week.account_id,
    slot_index: slotIndex,
    status: 'draft',
    format: 'image',
    hook: mock.hook,
    visual_text: mock.visualText,
    caption: mock.caption,
    cta: mock.cta,
    content: {
      planned_for: localDateTimeToIso(dayDate, mock.time),
      objective: mock.objective,
      audience: mock.audience,
      mock_theme: mock.theme,
      placeholder_variant: `slot-${slotIndex}`,
    },
    recommendation_reason:
      'Brouillon de test local pour verifier l’UX Social Studio sans appeler les providers.',
  };
}

async function ensureMockAssets(organizationId: string, posts: SocialPost[]) {
  const existingAssets = await listAssetsForPosts(organizationId, posts);
  const postsWithAssets = new Set(existingAssets.map((asset) => asset.post_id));
  const missing = posts.filter((post) => !postsWithAssets.has(post.id));
  if (missing.length === 0) return;

  const assets: TablesInsert<'social_post_assets'>[] = missing.map((post) => ({
    organization_id: organizationId,
    post_id: post.id,
    kind: 'source',
    position: 1,
    storage_path: `${organizationId}/social-studio/mock/${post.week_id ?? 'week'}/${post.slot_index}.webp`,
    original_filename: `phase-c-slot-${post.slot_index}.webp`,
    mime_type: 'image/webp',
    width: 1080,
    height: 1080,
    alt_text: `Placeholder Social Studio ${SOCIAL_WEEK_DAYS[post.slot_index - 1]}`,
    provider: 'phase-c-mock',
  }));

  await unwrap(supabase.from('social_post_assets').insert(assets).select('id'));
}

async function authenticatedFunctionHeaders(): Promise<{ Authorization: string }> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Votre session a expiré. Reconnectez-vous.');

  const expiresAt = data.session.expires_at ?? 0;
  let session = data.session;
  if (expiresAt <= Math.floor(Date.now() / 1000) + 120) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) {
      throw new Error('Votre session a expiré. Reconnectez-vous.');
    }
    session = refreshed.data.session;
  }

  return { Authorization: `Bearer ${session.access_token}` };
}

export async function generateSocialStudioWeek(
  organizationId: string,
  startsOn = currentWeekStartsOn(),
): Promise<SocialStudioWeek> {
  weekInput.parse({ organizationId, startsOn });

  const response = await supabase.functions.invoke<unknown>('social-content-generate', {
    headers: await authenticatedFunctionHeaders(),
    body: {
      organizationId,
      startsOn,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    },
  });
  if (response.error) {
    throw new Error(
      await messageDeLaFonction(response.error, 'Social Studio AI n’a pas pu préparer la semaine.'),
    );
  }

  const parsed = generateWeekResponse.safeParse(response.data);
  if (!parsed.success) throw new Error('La réponse Social Studio AI est incomplète.');

  const week = await getSocialStudioWeek(organizationId, startsOn);
  if (week === null) {
    throw new Error('La semaine générée n’a pas pu être rechargée.');
  }
  return week;
}

export async function generateSocialPostImages(
  organizationId: string,
  postId: string,
  force = false,
): Promise<z.infer<typeof generateImagesResponse>> {
  postImageInput.parse({ organizationId, postId });

  const response = await supabase.functions.invoke<unknown>('social-image-generate', {
    headers: await authenticatedFunctionHeaders(),
    body: {
      organizationId,
      postId,
      force,
    },
  });
  if (response.error) {
    throw new Error(
      await messageDeLaFonction(
        response.error,
        'Le moteur visuel Social Studio n’a pas pu générer les visuels.',
      ),
    );
  }

  const parsed = generateImagesResponse.safeParse(response.data);
  if (!parsed.success) throw new Error('La réponse du moteur visuel Social Studio est incomplète.');
  return parsed.data;
}

export async function selectSocialPostAsset(
  organizationId: string,
  postId: string,
  assetId: string,
): Promise<void> {
  postImageInput.extend({ assetId: z.string().uuid() }).parse({ organizationId, postId, assetId });

  await unwrap(
    supabase
      .from('social_post_assets')
      .update({ kind: 'generated' })
      .eq('organization_id', organizationId)
      .eq('post_id', postId)
      .eq('kind', 'selected')
      .select('id'),
  );

  await unwrap(
    supabase
      .from('social_post_assets')
      .update({ kind: 'selected' })
      .eq('organization_id', organizationId)
      .eq('post_id', postId)
      .eq('id', assetId)
      .select('id')
      .single(),
  );
}

export async function validateAndScheduleSocialWeek(
  organizationId: string,
  weekId: string,
  timezone = browserTimeZone(),
): Promise<z.infer<typeof scheduleWeekResponse>[number]> {
  z.object({
    organizationId: z.string().uuid(),
    weekId: z.string().uuid(),
    timezone: z.string().min(1).max(80),
  }).parse({ organizationId, weekId, timezone });

  const data = await unwrap(
    supabase.rpc('validate_and_schedule_social_week', {
      p_organization_id: organizationId,
      p_week_id: weekId,
      p_timezone: timezone,
    }),
  );
  const parsed = scheduleWeekResponse.safeParse(data);
  if (!parsed.success) throw new Error('La réponse de validation Social Studio est incomplète.');
  return parsed.data[0]!;
}

export async function setSocialWeekPublishingSuspended(
  organizationId: string,
  weekId: string,
  suspended: boolean,
): Promise<z.infer<typeof suspendWeekResponse>[number]> {
  z.object({
    organizationId: z.string().uuid(),
    weekId: z.string().uuid(),
    suspended: z.boolean(),
  }).parse({ organizationId, weekId, suspended });

  const data = await unwrap(
    supabase.rpc('set_social_week_publishing_suspended', {
      p_organization_id: organizationId,
      p_week_id: weekId,
      p_suspended: suspended,
    }),
  );
  const parsed = suspendWeekResponse.safeParse(data);
  if (!parsed.success) throw new Error('La réponse de suspension Social Studio est incomplète.');
  return parsed.data[0]!;
}

export async function cancelSocialPost(
  organizationId: string,
  postId: string,
): Promise<SocialPostWithAssets> {
  postImageInput.parse({ organizationId, postId });

  const updated = await unwrap(
    supabase.rpc('cancel_social_post', {
      p_organization_id: organizationId,
      p_post_id: postId,
    }),
  );
  const assets = await listAssetsForPosts(updated.organization_id, [updated]);
  return { ...updated, assets };
}

export async function createDevelopmentSocialWeek(
  organizationId: string,
  startsOn = currentWeekStartsOn(),
): Promise<SocialStudioWeek> {
  weekInput.parse({ organizationId, startsOn });
  if (isProduction) {
    throw new Error('Les brouillons de developpement Social Studio sont desactives en production.');
  }

  const week = await ensureWeek(organizationId, startsOn);
  const existingPosts = await unwrap(
    supabase
      .from('social_posts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('week_id', week.id)
      .order('slot_index'),
  );
  const existingSlots = new Set(existingPosts.map((post) => post.slot_index));
  const missingPosts = Array.from({ length: 7 }, (_, index) => index + 1)
    .filter((slotIndex) => !existingSlots.has(slotIndex))
    .map((slotIndex) => mockPostInsert(organizationId, week, slotIndex));

  if (missingPosts.length > 0) {
    await unwrap(supabase.from('social_posts').insert(missingPosts).select('id'));
  }

  const refreshed = await unwrap(
    supabase
      .from('social_posts')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('week_id', week.id)
      .order('slot_index'),
  );
  await ensureMockAssets(organizationId, refreshed);

  const result = await getSocialStudioWeek(organizationId, startsOn);
  if (result === null) throw new Error('La semaine Social Studio n’a pas pu etre initialisee.');
  return result;
}

export async function updateSocialPostDraft(
  post: SocialPost,
  values: SocialPostFormValues,
  intent: SocialPostSaveIntent,
): Promise<SocialPostWithAssets> {
  const patch: TablesUpdate<'social_posts'> = socialPostFormToPatch(post, values, intent);
  const updated = await unwrap(
    supabase.from('social_posts').update(patch).eq('id', post.id).select('*').single(),
  );
  const assets = await listAssetsForPosts(updated.organization_id, [updated]);
  return { ...updated, assets };
}
