/**
 * API publique de la feature Workspace — espaces, pages, tâches.
 *
 * Modèle de données, RLS et triggers : supabase/migrations/20260929090000_workspace.sql.
 * Aucun écran ici : ils viendront avec la direction artistique retenue.
 */

export {
  EMPTY_DOCUMENT,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
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
  type WorkspacePage,
  type WorkspacePageRevision,
  type WorkspaceSpace,
  type WorkspaceTask,
} from './api/workspace.api';

export {
  useArchiveSpace,
  useCreatePage,
  useCreateSpace,
  useCreateTask,
  useDeletePage,
  useDeleteTask,
  useMissionTasks,
  useMovePage,
  usePage,
  usePageRevisions,
  usePages,
  useSavePage,
  useSpaces,
  useTasks,
  useUpdateSpace,
  useUpdateTask,
} from './hooks/useWorkspace';
