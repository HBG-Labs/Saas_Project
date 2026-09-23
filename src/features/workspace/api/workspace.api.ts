import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  TiptapDocument,
  VocabularySource,
  VocabularyType,
  WorkspaceRecordingStatus,
} from '@/types/database';

/**
 * Accès au Workspace : espaces, pages, tâches.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE LE CLIENT N'ENVOIE PAS
 *
 * `organization_id` d'une page ou d'une tâche : le trigger le pose depuis
 * l'espace, et refuse tout ce qui traverserait une organisation (page parente,
 * mission, personne assignée). Le client ne pourrait que se tromper.
 *
 * `completed_at` d'une tâche : il suit `status`. `updated_by` d'une page :
 * la session. `created_by` : la session aussi.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ENREGISTRER UNE PAGE
 *
 * Jamais par `update` direct : par `save_workspace_page`, qui refuse si la page
 * a changé depuis l'ouverture (`serialization_failure`). Le client recharge et
 * l'annonce ; il n'écrase pas en silence. C'est l'arbitrage C — pas de temps
 * réel en v1, mais pas de perte silencieuse non plus.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type WorkspaceSpace = Tables<'workspace_spaces'>;
export type WorkspacePage = Tables<'workspace_pages'>;
export type WorkspacePagePreference = Tables<'workspace_page_preferences'>;
export type WorkspacePageRevision = Tables<'workspace_page_revisions'>;
export type WorkspaceTask = Tables<'workspace_tasks'>;

export const EMPTY_DOCUMENT: TiptapDocument = { type: 'doc', content: [] };

export const TASK_STATUS_LABELS: Record<WorkspaceTask['status'], string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminée',
};

export const TASK_PRIORITY_LABELS: Record<WorkspaceTask['priority'], string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
};

// ─── Espaces ─────────────────────────────────────────────────────────────────

export async function listSpaces(
  organizationId: string,
  options: { includeArchived?: boolean } = {},
): Promise<WorkspaceSpace[]> {
  let query = supabase
    .from('workspace_spaces')
    .select('*')
    .eq('organization_id', organizationId)
    .order('position')
    .order('created_at');
  if (!options.includeArchived) query = query.is('archived_at', null);
  return unwrap(query);
}

export async function createSpace(
  input: TablesInsert<'workspace_spaces'>,
): Promise<WorkspaceSpace> {
  return unwrap(supabase.from('workspace_spaces').insert(input).select('*').single());
}

export async function updateSpace(
  spaceId: string,
  patch: TablesUpdate<'workspace_spaces'>,
): Promise<WorkspaceSpace> {
  return unwrap(
    supabase.from('workspace_spaces').update(patch).eq('id', spaceId).select('*').single(),
  );
}

/** Archiver, pas supprimer : rien ne se perd en v1. `null` pour restaurer. */
export async function archiveSpace(spaceId: string, archived: boolean): Promise<WorkspaceSpace> {
  return updateSpace(spaceId, { archived_at: archived ? new Date().toISOString() : null });
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export async function listPages(spaceId: string): Promise<WorkspacePage[]> {
  return unwrap(
    supabase
      .from('workspace_pages')
      .select('*')
      .eq('space_id', spaceId)
      .is('archived_at', null)
      .order('position')
      .order('created_at'),
  );
}

/** Pages placées dans la corbeille de l'organisation, de la plus récente à la plus ancienne. */
export async function listArchivedPages(organizationId: string): Promise<WorkspacePage[]> {
  return unwrap(
    supabase
      .from('workspace_pages')
      .select('*')
      .eq('organization_id', organizationId)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false }),
  );
}

export async function getPage(pageId: string): Promise<WorkspacePage | null> {
  return unwrapMaybe(supabase.from('workspace_pages').select('*').eq('id', pageId).maybeSingle());
}

export async function createPage(input: {
  spaceId: string;
  title?: string;
  parentPageId?: string | null;
  position?: number;
}): Promise<WorkspacePage> {
  return unwrap(
    supabase
      .from('workspace_pages')
      .insert({
        space_id: input.spaceId,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.parentPageId !== undefined ? { parent_page_id: input.parentPageId } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      })
      .select('*')
      .single(),
  );
}

export interface SavePageInput {
  pageId: string;
  /** L'`updated_at` lu à l'ouverture. La base refuse si la page a bougé depuis. */
  expectedUpdatedAt: string;
  title: string;
  content: TiptapDocument;
}

export async function savePage(input: SavePageInput): Promise<WorkspacePage> {
  return unwrap(
    supabase.rpc('save_workspace_page', {
      p_page_id: input.pageId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_title: input.title,
      p_content: input.content,
    }),
  );
}

/** Déplacer ou archiver : ce qui ne fait pas une révision. */
export async function movePage(
  pageId: string,
  patch: Pick<TablesUpdate<'workspace_pages'>, 'parent_page_id' | 'position' | 'archived_at'>,
): Promise<WorkspacePage> {
  return unwrap(
    supabase.from('workspace_pages').update(patch).eq('id', pageId).select('*').single(),
  );
}

export async function updatePagePresentation(
  pageId: string,
  patch: Pick<
    TablesUpdate<'workspace_pages'>,
    'font_family' | 'small_text' | 'full_width' | 'locked' | 'accent_color' | 'wiki_mode'
  >,
): Promise<WorkspacePage> {
  return unwrap(
    supabase.from('workspace_pages').update(patch).eq('id', pageId).select('*').single(),
  );
}

export async function getPagePreference(pageId: string): Promise<WorkspacePagePreference | null> {
  return unwrapMaybe(
    supabase.from('workspace_page_preferences').select('*').eq('page_id', pageId).maybeSingle(),
  );
}

export async function setPageNotificationLevel(
  pageId: string,
  notificationLevel: WorkspacePagePreference['notification_level'],
): Promise<WorkspacePagePreference> {
  return unwrap(
    supabase
      .from('workspace_page_preferences')
      .upsert(
        { page_id: pageId, notification_level: notificationLevel },
        { onConflict: 'page_id,user_id' },
      )
      .select('*')
      .single(),
  );
}

export async function deletePage(pageId: string): Promise<void> {
  await unwrap(supabase.from('workspace_pages').delete().eq('id', pageId).select('id'));
}

export async function listPageRevisions(pageId: string): Promise<WorkspacePageRevision[]> {
  return unwrap(
    supabase
      .from('workspace_page_revisions')
      .select('*')
      .eq('page_id', pageId)
      .order('replaced_at', { ascending: false }),
  );
}

// ─── Tâches ──────────────────────────────────────────────────────────────────

export interface TaskFilters {
  status?: WorkspaceTask['status'];
  assigneeMemberId?: string;
  pageId?: string;
  missionId?: string;
}

export async function listTasks(
  spaceId: string,
  filters: TaskFilters = {},
): Promise<WorkspaceTask[]> {
  let query = supabase
    .from('workspace_tasks')
    .select('*')
    .eq('space_id', spaceId)
    .order('position')
    .order('created_at');
  if (filters.status !== undefined) query = query.eq('status', filters.status);
  if (filters.assigneeMemberId !== undefined)
    query = query.eq('assignee_member_id', filters.assigneeMemberId);
  if (filters.pageId !== undefined) query = query.eq('page_id', filters.pageId);
  if (filters.missionId !== undefined) query = query.eq('mission_id', filters.missionId);
  return unwrap(query);
}

/** Les tâches d'une mission, tous espaces confondus : le pont vers Gestion. */
export async function listTasksForMission(missionId: string): Promise<WorkspaceTask[]> {
  return unwrap(
    supabase
      .from('workspace_tasks')
      .select('*')
      .eq('mission_id', missionId)
      .order('status')
      .order('due_date', { ascending: true, nullsFirst: false }),
  );
}

export async function createTask(input: TablesInsert<'workspace_tasks'>): Promise<WorkspaceTask> {
  return unwrap(supabase.from('workspace_tasks').insert(input).select('*').single());
}

export async function updateTask(
  taskId: string,
  patch: TablesUpdate<'workspace_tasks'>,
): Promise<WorkspaceTask> {
  return unwrap(
    supabase.from('workspace_tasks').update(patch).eq('id', taskId).select('*').single(),
  );
}

export async function deleteTask(taskId: string): Promise<void> {
  await unwrap(supabase.from('workspace_tasks').delete().eq('id', taskId).select('id'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace v2 — 20261003090000_workspace_v2.sql
//
// Espace personnel, récentes, favoris, couverture, modèles, recherche. Tout ce
// qui touche à la visibilité (une page privée ne se voit que de son
// propriétaire) est décidé par la base ; le client demande, la base filtre.
// ─────────────────────────────────────────────────────────────────────────────

export type WorkspaceTemplate = Tables<'workspace_templates'>;
export type WorkspaceFavorite = Tables<'workspace_favorites'>;
export type WorkspaceSearchHit =
  Database['public']['Functions']['search_workspace_pages']['Returns'][number];

/** Une page récente, telle que l'écran la liste : la visite et la page. */
export interface WorkspaceRecentPage {
  visited_at: string;
  page: Pick<WorkspacePage, 'id' | 'space_id' | 'title' | 'icon' | 'cover_path' | 'updated_at'>;
}

export const COVERS_BUCKET = 'workspace-covers';
/** Miroir de la limite du bucket, pour l'expérience — la base décide. */
export const COVER_MAX_BYTES = 5 * 1024 * 1024;
export const COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// ─── L'espace personnel ──────────────────────────────────────────────────────

/** Mon espace personnel dans cette organisation — créé s'il n'existe pas. */
export async function ensurePersonalSpace(organizationId: string): Promise<WorkspaceSpace> {
  return unwrap(
    supabase.rpc('ensure_personal_workspace_space', { p_organization_id: organizationId }),
  );
}

/** Un espace est personnel s'il porte un propriétaire. */
export function isPersonalSpace(space: Pick<WorkspaceSpace, 'owner_member_id'>): boolean {
  return space.owner_member_id !== null;
}

// ─── Récentes et favoris ─────────────────────────────────────────────────────

/** J'ai ouvert cette page. À appeler à l'ouverture, pas à chaque rendu. */
export async function touchPage(pageId: string): Promise<void> {
  await unwrap(supabase.rpc('touch_workspace_page', { p_page_id: pageId }));
}

export async function listRecentPages(
  organizationId: string,
  limit = 12,
): Promise<WorkspaceRecentPage[]> {
  const rows = await unwrap(
    supabase
      .from('workspace_page_visits')
      .select(
        'visited_at, page:workspace_pages!inner(id, space_id, title, icon, cover_path, updated_at, archived_at)',
      )
      .eq('organization_id', organizationId)
      .is('page.archived_at', null)
      .order('visited_at', { ascending: false })
      .limit(limit),
  );
  return rows.map((row) => {
    const { archived_at: _archived, ...page } = row.page;
    return { visited_at: row.visited_at, page };
  });
}

export async function listFavorites(organizationId: string): Promise<WorkspaceFavorite[]> {
  return unwrap(
    supabase
      .from('workspace_favorites')
      .select('*')
      .eq('organization_id', organizationId)
      .order('position')
      .order('created_at'),
  );
}

export async function addFavorite(pageId: string, position = 0): Promise<WorkspaceFavorite> {
  return unwrap(
    supabase.from('workspace_favorites').insert({ page_id: pageId, position }).select('*').single(),
  );
}

export async function removeFavorite(pageId: string): Promise<void> {
  await unwrap(
    supabase.from('workspace_favorites').delete().eq('page_id', pageId).select('page_id'),
  );
}

// ─── Icône et couverture ─────────────────────────────────────────────────────

export async function setPageIcon(pageId: string, icon: string | null): Promise<WorkspacePage> {
  return unwrap(
    supabase.from('workspace_pages').update({ icon }).eq('id', pageId).select('*').single(),
  );
}

/**
 * Téléverse une couverture et l'attache à la page. Le chemin porte
 * l'organisation puis la page : c'est ce que les règles du bucket lisent.
 * L'ancienne couverture, s'il y en avait une, est retirée.
 */
export async function uploadPageCover(
  page: Pick<WorkspacePage, 'id' | 'organization_id' | 'cover_path'>,
  file: File,
): Promise<WorkspacePage> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${page.organization_id}/${page.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(COVERS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const updated = await unwrap(
    supabase
      .from('workspace_pages')
      .update({ cover_path: path })
      .eq('id', page.id)
      .select('*')
      .single(),
  );
  if (page.cover_path) {
    // L'ancienne image ne bloque rien si sa suppression échoue : on ne fait
    // pas échouer un changement de couverture réussi pour un fichier orphelin.
    await supabase.storage.from(COVERS_BUCKET).remove([page.cover_path]);
  }
  return updated;
}

export async function removePageCover(
  page: Pick<WorkspacePage, 'id' | 'cover_path'>,
): Promise<WorkspacePage> {
  const updated = await unwrap(
    supabase
      .from('workspace_pages')
      .update({ cover_path: null })
      .eq('id', page.id)
      .select('*')
      .single(),
  );
  if (page.cover_path) await supabase.storage.from(COVERS_BUCKET).remove([page.cover_path]);
  return updated;
}

/** URL signée d'une couverture — le bucket est privé. */
export async function getCoverUrl(coverPath: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(COVERS_BUCKET)
    .createSignedUrl(coverPath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

// ─── Les modèles ─────────────────────────────────────────────────────────────

/** Les modèles système (organisation nulle) et ceux de l'organisation. */
export async function listTemplates(organizationId: string): Promise<WorkspaceTemplate[]> {
  return unwrap(
    supabase
      .from('workspace_templates')
      .select('*')
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .order('category')
      .order('position')
      .order('name'),
  );
}

export async function createPageFromTemplate(input: {
  templateId: string;
  spaceId: string;
  parentPageId?: string | null;
  title?: string;
}): Promise<WorkspacePage> {
  return unwrap(
    supabase.rpc('create_page_from_template', {
      p_template_id: input.templateId,
      p_space_id: input.spaceId,
      ...(input.parentPageId !== undefined ? { p_parent_page_id: input.parentPageId } : {}),
      ...(input.title !== undefined ? { p_title: input.title } : {}),
    }),
  );
}

/** « Enregistrer cette page comme modèle » — `workspace.manage`. */
export async function saveAsTemplate(input: {
  organizationId: string;
  page: Pick<WorkspacePage, 'title' | 'content' | 'icon'>;
  name?: string;
  description?: string;
  category?: string;
}): Promise<WorkspaceTemplate> {
  return unwrap(
    supabase
      .from('workspace_templates')
      .insert({
        organization_id: input.organizationId,
        name: input.name ?? input.page.title,
        content: input.page.content,
        icon: input.page.icon,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
      })
      .select('*')
      .single(),
  );
}

export async function updateTemplate(
  templateId: string,
  patch: TablesUpdate<'workspace_templates'>,
): Promise<WorkspaceTemplate> {
  return unwrap(
    supabase.from('workspace_templates').update(patch).eq('id', templateId).select('*').single(),
  );
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await unwrap(supabase.from('workspace_templates').delete().eq('id', templateId).select('id'));
}

// ─── La recherche ────────────────────────────────────────────────────────────

/** Plein texte en français, syntaxe « web » (mots, "expression", -exclu). */
export async function searchPages(
  organizationId: string,
  query: string,
  limit = 20,
): Promise<WorkspaceSearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  return unwrap(
    supabase.rpc('search_workspace_pages', {
      p_organization_id: organizationId,
      p_query: trimmed,
      p_limit: limit,
    }),
  );
}

// ─── Depuis la discussion IA ─────────────────────────────────────────────────

/**
 * Un texte de l'assistant (Markdown simple) en document TipTap minimal :
 * titres `#`, listes `-`/`1.`, paragraphes. Assez pour « rédiger dans cette
 * page » et « créer une page depuis la discussion » sans dépendre de
 * l'éditeur ; l'éditeur reprend ensuite la main sur ce qu'il affiche.
 */
export function textToTiptapDocument(markdown: string): TiptapDocument {
  const content: NonNullable<TiptapDocument['content']> = [];
  let list: { type: 'bulletList' | 'orderedList'; items: string[] } | null = null;
  const flushList = () => {
    if (!list) return;
    content.push({
      type: list.type,
      content: list.items.map((item) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
      })),
    });
    list = null;
  };

  for (const rawLine of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) {
      flushList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      content.push({
        type: 'heading',
        attrs: { level: heading[1]?.length ?? 1 },
        content: [{ type: 'text', text: heading[2] ?? '' }],
      });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const type = bullet ? 'bulletList' : 'orderedList';
      const text = (bullet ?? numbered)?.[1] ?? '';
      if (list && list.type !== type) flushList();
      list ??= { type, items: [] };
      list.items.push(text);
      continue;
    }
    flushList();
    content.push({ type: 'paragraph', content: [{ type: 'text', text: line }] });
  }
  flushList();
  return { type: 'doc', content };
}

// ─── Enregistrements vocaux ──────────────────────────────────────────────────
//
// 20261005090000_enregistrements_vocaux.sql. Trois temps, dans cet ordre : la
// LIGNE d'abord (la base vérifie le quota, le consentement, la page), le
// FICHIER ensuite (la règle du bucket exige la ligne), `submit` enfin. La
// transcription et le résumé arrivent en tâche de fond, ÉCRITS DANS LA PAGE
// par la base : le client rafraîchit la page quand le statut passe à `done`.

export type WorkspaceRecording = Tables<'workspace_recordings'>;
export type TranscriptionQuota =
  Database['public']['Functions']['transcription_quota_status']['Returns'][number];

export const AUDIO_BUCKET = 'workspace-audio';
/** Miroir de la limite du bucket et de l'API de transcription (25 Mo). */
export const AUDIO_MAX_BYTES = 25 * 1024 * 1024;
export const AUDIO_MAX_SECONDS = 3600;

export const RECORDING_STATUS_LABELS: Record<WorkspaceRecordingStatus, string> = {
  uploading: "Envoi de l'audio",
  pending: 'En attente de transcription',
  processing: 'Transcription en cours',
  done: 'Transcrit',
  failed: 'Échec',
};

export async function listRecordings(pageId: string): Promise<WorkspaceRecording[]> {
  return unwrap(
    supabase
      .from('workspace_recordings')
      .select('*')
      .eq('page_id', pageId)
      .order('created_at', { ascending: false }),
  );
}

export async function getTranscriptionQuota(
  organizationId: string,
): Promise<TranscriptionQuota | null> {
  const rows = await unwrap(
    supabase.rpc('transcription_quota_status', { p_organization_id: organizationId }),
  );
  return rows[0] ?? null;
}

export interface CreateRecordingInput {
  page: Pick<WorkspacePage, 'id' | 'organization_id'>;
  audio: Blob;
  durationSeconds: number;
  title?: string;
  language?: string;
  /** La personne confirme que les participants sont informés (RGPD). */
  consentConfirmed: boolean;
}

function extensionFor(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

/**
 * Déclare, dépose, soumet. Si le dépôt échoue, la ligne est retirée : une
 * ligne `uploading` sans fichier n'attendrait rien.
 */
export async function createRecording(input: CreateRecordingInput): Promise<WorkspaceRecording> {
  if (!input.consentConfirmed) {
    throw new Error('Confirmez que les personnes enregistrées sont informées.');
  }
  if (input.audio.size > AUDIO_MAX_BYTES) {
    throw new Error('Enregistrement trop lourd (25 Mo au plus).');
  }
  const mime = input.audio.type.split(';')[0] || 'audio/webm';
  const id = crypto.randomUUID();
  const path = `${input.page.organization_id}/${input.page.id}/${id}.${extensionFor(mime)}`;

  const row = await unwrap(
    supabase
      .from('workspace_recordings')
      .insert({
        page_id: input.page.id,
        audio_path: path,
        mime_type: mime,
        size_bytes: input.audio.size,
        duration_seconds: Math.max(
          1,
          Math.min(AUDIO_MAX_SECONDS, Math.round(input.durationSeconds)),
        ),
        consent_confirmed_at: new Date().toISOString(),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
      })
      .select('*')
      .single(),
  );

  const { error: uploadError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, input.audio, { contentType: mime, upsert: false });
  if (uploadError) {
    await supabase.from('workspace_recordings').delete().eq('id', row.id);
    throw uploadError;
  }

  return unwrap(
    supabase.rpc('submit_workspace_recording', {
      p_recording_id: row.id,
      p_size_bytes: input.audio.size,
    }),
  );
}

/**
 * Le pas 1 de l'envoi reprenable (`useAudioRecorder`) : la ligne serveur
 * seule, avant le fichier. La règle du bucket exige que la ligne existe et
 * soit à la session pour accepter le dépôt. `createRecording` ci-dessus
 * reste pour les appels d'un seul tenant (envoi simple) ; les deux passent par
 * les mêmes gardes en base.
 */
export async function createRecordingRow(input: {
  page: Pick<WorkspacePage, 'id' | 'organization_id'>;
  audioPath: string;
  mimeType: string;
  durationSeconds: number;
  sizeBytes: number;
  consentConfirmedAt: string;
  title: string;
  language?: string;
  /** Les notes tapées pendant la capture ; jamais transmises au fournisseur. */
  notes?: string;
  /** Le brouillon du direct et son marqueur (phase 14). */
  transcriptLive?: string;
  liveUsed?: boolean;
}): Promise<WorkspaceRecording> {
  return unwrap(
    supabase
      .from('workspace_recordings')
      .insert({
        page_id: input.page.id,
        audio_path: input.audioPath,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        duration_seconds: Math.max(
          1,
          Math.min(AUDIO_MAX_SECONDS, Math.round(input.durationSeconds)),
        ),
        consent_confirmed_at: input.consentConfirmedAt,
        title: input.title,
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.notes !== undefined && input.notes.trim().length > 0
          ? { notes: input.notes }
          : {}),
        ...(input.transcriptLive !== undefined && input.transcriptLive.length > 0
          ? { transcript_live: input.transcriptLive }
          : {}),
        ...(input.liveUsed ? { live_used: true } : {}),
      })
      .select('*')
      .single(),
  );
}

/** Le pas 3 : le fichier est là, la transcription peut partir. Idempotent. */
export async function submitRecording(
  recordingId: string,
  sizeBytes?: number,
): Promise<WorkspaceRecording> {
  return unwrap(
    supabase.rpc('submit_workspace_recording', {
      p_recording_id: recordingId,
      ...(sizeBytes !== undefined ? { p_size_bytes: sizeBytes } : {}),
    }),
  );
}

export async function renameRecording(
  recordingId: string,
  title: string,
): Promise<WorkspaceRecording> {
  return unwrap(
    supabase
      .from('workspace_recordings')
      .update({ title })
      .eq('id', recordingId)
      .select('*')
      .single(),
  );
}

/**
 * Le jeton éphémère du direct (phase 14) : demandé à la fonction Edge, qui
 * vérifie la porte (`live_transcription_access`) et garde la clé OpenAI.
 * Refusé → l'erreur porte le motif ; le hook continue sans direct.
 */
export async function fetchLiveToken(
  organizationId: string,
  pageId: string,
): Promise<{ token: string; expiresAt: number; model: string }> {
  const response: {
    data: { token: string; expiresAt: number; model: string } | null;
    error: unknown;
  } = await supabase.functions.invoke<{ token: string; expiresAt: number; model: string }>(
    'transcription-live-token',
    { body: { organizationId, pageId } },
  );
  const { data, error } = response;
  if (error || !data?.token) {
    let motif = 'Direct indisponible.';
    const context: unknown = (error as { context?: unknown } | null)?.context;
    if (context instanceof Response) {
      try {
        const corps = (await context.clone().json()) as { error?: string; code?: string };
        if (corps.error) motif = corps.error;
        // Le code d'OpenAI, utile pour diagnostiquer sans lire les journaux.
        if (corps.code) motif = `${motif} [${corps.code}]`;
      } catch {
        // le corps n'est pas du JSON : le motif générique suffit
      }
    }
    throw new Error(motif);
  }
  return data;
}

/**
 * Les notes de la personne sur un enregistrement (≤ 20 000 caractères) —
 * l'auteur ou `workspace.manage`. Vide = effacées. Le worker ne les lit pas.
 */
export async function updateRecordingNotes(
  recordingId: string,
  notes: string,
): Promise<WorkspaceRecording> {
  const propre = notes.trim();
  return unwrap(
    supabase
      .from('workspace_recordings')
      .update({ notes: propre.length > 0 ? propre : null })
      .eq('id', recordingId)
      .select('*')
      .single(),
  );
}

/** Supprime la ligne et le fichier. La transcription déjà écrite dans la page y reste. */
export async function deleteRecording(
  recording: Pick<WorkspaceRecording, 'id' | 'audio_path' | 'audio_deleted_at'>,
): Promise<void> {
  if (!recording.audio_deleted_at) {
    await supabase.storage.from(AUDIO_BUCKET).remove([recording.audio_path]);
  }
  await unwrap(supabase.from('workspace_recordings').delete().eq('id', recording.id).select('id'));
}

/** URL signée de l'audio — `null` s'il a été effacé (30 jours). */
export async function getRecordingAudioUrl(
  recording: Pick<WorkspaceRecording, 'audio_path' | 'audio_deleted_at'>,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (recording.audio_deleted_at) return null;
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(recording.audio_path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

// ─── Le dictionnaire de transcription ────────────────────────────────────────
//
// 20261007093000_organization_vocabulary.sql. Les termes que le moteur doit
// connaître pour cette entreprise, transmis en tête du contexte (v2). Tout
// membre lit ; `workspace.manage` écrit. La suggestion ne fait que proposer.

export type VocabularyEntry = Tables<'organization_vocabulary'>;
export type VocabularySuggestion =
  Database['public']['Functions']['suggest_organization_vocabulary']['Returns'][number];

export const VOCABULARY_TYPE_LABELS: Record<VocabularyType, string> = {
  client: 'Client',
  site: 'Site',
  materiel: 'Matériel',
  technique: 'Terme technique',
  personne: 'Personne',
  lieu: 'Lieu',
  autre: 'Autre',
};

export async function listVocabulary(organizationId: string): Promise<VocabularyEntry[]> {
  return unwrap(
    supabase
      .from('organization_vocabulary')
      .select('*')
      .eq('organization_id', organizationId)
      .order('type')
      .order('term'),
  );
}

export async function addVocabularyTerms(
  organizationId: string,
  terms: ReadonlyArray<{ term: string; type?: VocabularyType; source?: VocabularySource }>,
): Promise<VocabularyEntry[]> {
  const propres = terms
    .map((t) => ({ ...t, term: t.term.trim() }))
    .filter((t) => t.term.length >= 2);
  if (propres.length === 0) return [];
  return unwrap(
    supabase
      .from('organization_vocabulary')
      .insert(
        propres.map((t) => ({
          organization_id: organizationId,
          term: t.term,
          ...(t.type !== undefined ? { type: t.type } : {}),
          ...(t.source !== undefined ? { source: t.source } : {}),
        })),
      )
      .select('*'),
  );
}

export async function updateVocabularyTerm(
  id: string,
  patch: TablesUpdate<'organization_vocabulary'>,
): Promise<VocabularyEntry> {
  return unwrap(
    supabase.from('organization_vocabulary').update(patch).eq('id', id).select('*').single(),
  );
}

export async function removeVocabularyTerm(id: string): Promise<void> {
  await unwrap(supabase.from('organization_vocabulary').delete().eq('id', id).select('id'));
}

/** Des noms déjà dans les données de l'organisation ; rien n'est écrit. */
export async function suggestVocabulary(organizationId: string): Promise<VocabularySuggestion[]> {
  return unwrap(
    supabase.rpc('suggest_organization_vocabulary', { p_organization_id: organizationId }),
  );
}
