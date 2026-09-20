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
  type SavePageInput,
  type TaskFilters,
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
