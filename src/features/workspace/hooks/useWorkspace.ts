import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { TablesInsert, TablesUpdate } from '@/types/database';

import {
  archiveSpace,
  createPage,
  createSpace,
  createTask,
  deletePage,
  deleteTask,
  getPage,
  listPageRevisions,
  listPages,
  listSpaces,
  listTasks,
  listTasksForMission,
  movePage,
  savePage,
  updateSpace,
  updateTask,
  addFavorite,
  createPageFromTemplate,
  deleteTemplate,
  ensurePersonalSpace,
  getCoverUrl,
  listFavorites,
  listRecentPages,
  listTemplates,
  removeFavorite,
  removePageCover,
  saveAsTemplate,
  searchPages,
  setPageIcon,
  touchPage,
  updateTemplate,
  uploadPageCover,
  createRecording,
  deleteRecording,
  getRecordingAudioUrl,
  getTranscriptionQuota,
  listRecordings,
  renameRecording,
  type CreateRecordingInput,
  type SavePageInput,
  type TaskFilters,
  type WorkspaceRecording,
} from '../api/workspace.api';

/**
 * Hooks du Workspace.
 *
 * Invalidation par espace : une page ou une tâche vit dans un espace, et c'est
 * la liste de cet espace qui doit se rafraîchir. `qk.workspace.all` pour ce
 * qui touche à la liste des espaces eux-mêmes.
 */

// ─── Espaces ─────────────────────────────────────────────────────────────────

export function useSpaces(organizationId: string | null, includeArchived = false) {
  return useQuery({
    queryKey: [...qk.workspace.spaces(organizationId ?? 'none'), includeArchived],
    queryFn: () => listSpaces(organizationId ?? '', { includeArchived }),
    enabled: organizationId !== null,
  });
}

export function useCreateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TablesInsert<'workspace_spaces'>) => createSpace(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.all });
    },
  });
}

export function useUpdateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      spaceId,
      patch,
    }: {
      spaceId: string;
      patch: TablesUpdate<'workspace_spaces'>;
    }) => updateSpace(spaceId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.all });
    },
  });
}

export function useArchiveSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ spaceId, archived }: { spaceId: string; archived: boolean }) =>
      archiveSpace(spaceId, archived),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.all });
    },
  });
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export function usePages(spaceId: string | undefined) {
  return useQuery({
    queryKey: qk.workspace.pages(spaceId ?? 'none'),
    queryFn: () => listPages(spaceId ?? ''),
    enabled: spaceId !== undefined,
  });
}

export function usePage(pageId: string | undefined) {
  return useQuery({
    queryKey: qk.workspace.page(pageId ?? 'none'),
    queryFn: () => getPage(pageId ?? ''),
    enabled: pageId !== undefined,
  });
}

export function usePageRevisions(pageId: string | undefined) {
  return useQuery({
    queryKey: qk.workspace.revisions(pageId ?? 'none'),
    queryFn: () => listPageRevisions(pageId ?? ''),
    enabled: pageId !== undefined,
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createPage>[0]) => createPage(input),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.pages(page.space_id) });
    },
  });
}

/**
 * Enregistrer une page.
 *
 * En cas de conflit (`serialization_failure`), l'erreur remonte telle quelle :
 * c'est l'écran qui choisit comment l'annoncer et proposer de recharger. Le
 * hook ne réessaie pas — réessayer avec le même `expectedUpdatedAt` échouerait
 * pareil, et avec un nouveau, ce serait écraser en silence.
 */
export function useSavePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SavePageInput) => savePage(input),
    onSuccess: async (page) => {
      queryClient.setQueryData(qk.workspace.page(page.id), page);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.workspace.pages(page.space_id) }),
        queryClient.invalidateQueries({ queryKey: qk.workspace.revisions(page.id) }),
      ]);
    },
  });
}

export function useMovePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, patch }: { pageId: string; patch: Parameters<typeof movePage>[1] }) =>
      movePage(pageId, patch),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.pages(page.space_id) });
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId }: { pageId: string; spaceId: string }) => deletePage(pageId),
    onSuccess: async (_result, { spaceId }) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.pages(spaceId) });
    },
  });
}

// ─── Tâches ──────────────────────────────────────────────────────────────────

export function useTasks(spaceId: string | undefined, filters: TaskFilters = {}) {
  return useQuery({
    queryKey: [...qk.workspace.tasks(spaceId ?? 'none'), filters],
    queryFn: () => listTasks(spaceId ?? '', filters),
    enabled: spaceId !== undefined,
  });
}

/** Les tâches d'une mission — affichables depuis Gestion sans changer d'univers. */
export function useMissionTasks(missionId: string | undefined) {
  return useQuery({
    queryKey: [...qk.workspace.all, 'mission', missionId ?? 'none', 'tasks'],
    queryFn: () => listTasksForMission(missionId ?? ''),
    enabled: missionId !== undefined,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TablesInsert<'workspace_tasks'>) => createTask(input),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.tasks(task.space_id) });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: TablesUpdate<'workspace_tasks'> }) =>
      updateTask(taskId, patch),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.tasks(task.space_id) });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; spaceId: string }) => deleteTask(taskId),
    onSuccess: async (_result, { spaceId }) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.tasks(spaceId) });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace v2
//
// Les récentes et les favoris sont PAR PERSONNE : ils s'invalident seuls, pas
// avec les listes de pages. Une page créée depuis un modèle invalide son
// espace, comme une page ordinaire.
// ─────────────────────────────────────────────────────────────────────────────

export function usePersonalSpace(organizationId: string | null) {
  return useQuery({
    queryKey: qk.workspace.personalSpace(organizationId ?? 'none'),
    queryFn: () => ensurePersonalSpace(organizationId ?? ''),
    enabled: organizationId !== null,
    // Créé une fois pour toutes : inutile de le redemander à chaque écran.
    staleTime: 5 * 60_000,
  });
}

export function useRecentPages(organizationId: string | null, limit = 12) {
  return useQuery({
    queryKey: [...qk.workspace.recents(organizationId ?? 'none'), limit],
    queryFn: () => listRecentPages(organizationId ?? '', limit),
    enabled: organizationId !== null,
  });
}

/** À l'ouverture d'une page : la marque récente, puis rafraîchit la liste. */
export function useTouchPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId }: { pageId: string; organizationId: string }) => touchPage(pageId),
    onSuccess: async (_result, { organizationId }) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.recents(organizationId) });
    },
  });
}

export function useFavorites(organizationId: string | null) {
  return useQuery({
    queryKey: qk.workspace.favorites(organizationId ?? 'none'),
    queryFn: () => listFavorites(organizationId ?? ''),
    enabled: organizationId !== null,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pageId,
      favorite,
    }: {
      pageId: string;
      favorite: boolean;
      organizationId: string;
    }) => (favorite ? addFavorite(pageId).then(() => undefined) : removeFavorite(pageId)),
    onSuccess: async (_result, { organizationId }) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.favorites(organizationId) });
    },
  });
}

export function useSetPageIcon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, icon }: { pageId: string; icon: string | null }) =>
      setPageIcon(pageId, icon),
    onSuccess: async (page) => {
      queryClient.setQueryData(qk.workspace.page(page.id), page);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.workspace.pages(page.space_id) }),
        queryClient.invalidateQueries({ queryKey: qk.workspace.recents(page.organization_id) }),
      ]);
    },
  });
}

export function useUploadPageCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ page, file }: { page: Parameters<typeof uploadPageCover>[0]; file: File }) =>
      uploadPageCover(page, file),
    onSuccess: async (page) => {
      queryClient.setQueryData(qk.workspace.page(page.id), page);
      await queryClient.invalidateQueries({ queryKey: qk.workspace.recents(page.organization_id) });
    },
  });
}

export function useRemovePageCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (page: Parameters<typeof removePageCover>[0]) => removePageCover(page),
    onSuccess: async (page) => {
      queryClient.setQueryData(qk.workspace.page(page.id), page);
      await queryClient.invalidateQueries({ queryKey: qk.workspace.recents(page.organization_id) });
    },
  });
}

/** URL signée d'une couverture, gardée le temps de sa validité. */
export function useCoverUrl(coverPath: string | null | undefined) {
  return useQuery({
    queryKey: [...qk.workspace.all, 'cover', coverPath ?? 'none'],
    queryFn: () => getCoverUrl(coverPath ?? ''),
    enabled: typeof coverPath === 'string' && coverPath.length > 0,
    staleTime: 50 * 60_000,
  });
}

export function useTemplates(organizationId: string | null) {
  return useQuery({
    queryKey: qk.workspace.templates(organizationId ?? 'none'),
    queryFn: () => listTemplates(organizationId ?? ''),
    enabled: organizationId !== null,
  });
}

export function useCreatePageFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createPageFromTemplate>[0]) =>
      createPageFromTemplate(input),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.pages(page.space_id) });
    },
  });
}

export function useSaveAsTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof saveAsTemplate>[0]) => saveAsTemplate(input),
    onSuccess: async (template) => {
      if (template.organization_id) {
        await queryClient.invalidateQueries({
          queryKey: qk.workspace.templates(template.organization_id),
        });
      }
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      patch,
    }: {
      templateId: string;
      patch: TablesUpdate<'workspace_templates'>;
    }) => updateTemplate(templateId, patch),
    onSuccess: async (template) => {
      if (template.organization_id) {
        await queryClient.invalidateQueries({
          queryKey: qk.workspace.templates(template.organization_id),
        });
      }
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId }: { templateId: string; organizationId: string }) =>
      deleteTemplate(templateId),
    onSuccess: async (_result, { organizationId }) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.templates(organizationId) });
    },
  });
}

/** Recherche à la frappe : vide sans texte, et rien n'est gardé longtemps. */
export function useSearchPages(organizationId: string | null, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: qk.workspace.search(organizationId ?? 'none', trimmed),
    queryFn: () => searchPages(organizationId ?? '', trimmed),
    enabled: organizationId !== null && trimmed.length >= 2,
    staleTime: 30_000,
  });
}

// ─── Enregistrements vocaux ──────────────────────────────────────────────────
//
// Tant qu'un enregistrement est en attente ou en cours, la liste se relit
// toutes les cinq secondes ; quand l'un passe à `done`, la PAGE est relue :
// c'est la base qui y a écrit la transcription et le résumé.

export function useRecordings(pageId: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.workspace.recordings(pageId ?? 'none'),
    queryFn: async () => {
      const rows = await listRecordings(pageId ?? '');
      const cached = queryClient.getQueryData<WorkspaceRecording[]>(
        qk.workspace.recordings(pageId ?? 'none'),
      );
      const nouveauxTermines = rows.some(
        (r) => r.status === 'done' && cached?.find((c) => c.id === r.id)?.status !== 'done',
      );
      if (nouveauxTermines && pageId) {
        await queryClient.invalidateQueries({ queryKey: qk.workspace.page(pageId) });
      }
      return rows;
    },
    enabled: pageId !== undefined,
    refetchInterval: (query) =>
      query.state.data?.some((r) => r.status === 'pending' || r.status === 'processing')
        ? 5_000
        : false,
  });
}

export function useTranscriptionQuota(organizationId: string | null) {
  return useQuery({
    queryKey: [...qk.workspace.all, organizationId ?? 'none', 'transcription-quota'],
    queryFn: () => getTranscriptionQuota(organizationId ?? ''),
    enabled: organizationId !== null,
    staleTime: 60_000,
  });
}

export function useCreateRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRecordingInput) => createRecording(input),
    onSuccess: async (recording) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.workspace.recordings(recording.page_id) }),
        queryClient.invalidateQueries({
          queryKey: [...qk.workspace.all, recording.organization_id, 'transcription-quota'],
        }),
      ]);
    },
  });
}

export function useRenameRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordingId, title }: { recordingId: string; title: string }) =>
      renameRecording(recordingId, title),
    onSuccess: async (recording) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.recordings(recording.page_id) });
    },
  });
}

export function useDeleteRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recording: WorkspaceRecording) => deleteRecording(recording),
    onSuccess: async (_result, recording) => {
      await queryClient.invalidateQueries({ queryKey: qk.workspace.recordings(recording.page_id) });
    },
  });
}

export function useRecordingAudioUrl(recording: WorkspaceRecording | null) {
  return useQuery({
    queryKey: [...qk.workspace.all, 'recording', recording?.id ?? 'none', 'audio'],
    queryFn: () => (recording ? getRecordingAudioUrl(recording) : Promise.resolve(null)),
    enabled: recording !== null && recording.audio_deleted_at === null,
    staleTime: 50 * 60_000,
  });
}
