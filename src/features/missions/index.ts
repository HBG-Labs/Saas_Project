/** API publique de la feature « missions ». */
export {
  getAvailableTransitions,
  getPermittedTransitions,
  isTransitionAllowed,
  MISSION_STATUS_LABELS,
  MISSION_TRANSITIONS,
  TERMINAL_STATUSES,
  type TransitionRule,
} from './workflow';

export {
  assignMission,
  changeMissionStatus,
  createMission,
  deleteMission,
  getMission,
  listMissionAssignments,
  listMissionHistory,
  listMissions,
  listStatusTransitions,
  updateMission,
  type MissionFilters,
} from './api/missions.api';

export {
  useAssignMission,
  useChangeMissionStatus,
  useCreateMission,
  useDeleteMission,
  useMission,
  useMissionAssignments,
  useMissionHistory,
  useMissionStatusCounts,
  useMissions,
  useUpdateMission,
} from './hooks/useMissions';

export {
  ACTIVE_STATUSES,
  countActiveFilters,
  EMPTY_MISSION_FILTERS,
  toMissionQuery,
  type MissionListFilters,
} from './mission-filters';

export { AssignMissionDialog } from './components/AssignMissionDialog';
export { MissionEditDialog } from './components/MissionEditDialog';
export { MissionFiltersBar } from './components/MissionFiltersBar';
export { MissionFormFields } from './components/MissionFormFields';
export { MissionPriorityBadge, MissionStatusBadge } from './components/MissionBadges';
export { MISSION_PRIORITY_LABELS } from './priority-labels';
export { MissionTransitions } from './components/MissionTransitions';

export {
  missionSchema,
  toDateTimeLocal,
  toIsoOrUndefined,
  type MissionValues,
} from './schemas/mission.schema';

export { exportMissionsToCsv } from './utils/exportCsv';
