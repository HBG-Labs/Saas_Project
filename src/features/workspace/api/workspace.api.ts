import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { Tables, TablesInsert, TablesUpdate, TiptapDocument } from '@/types/database';

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
