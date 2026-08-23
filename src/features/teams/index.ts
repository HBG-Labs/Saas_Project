/**
 * API publique de la feature « teams ».
 *
 * Les autres features et les pages importent depuis ce point d'entrée, jamais
 * depuis un fichier interne : la règle ESLint `no-restricted-imports` l'impose.
 */
export {
  addTeamMember,
  archiveTeam,
  createTeam,
  deleteTeam,
  getTeamWithMembers,
  listOrganizationTeamMemberships,
  listTeams,
  listTeamsOfMember,
  removeTeamMember,
  updateTeam,
  updateTeamMemberRole,
} from './api/teams.api';

export {
  useArchiveTeam,
  useCreateTeam,
  useDeleteTeam,
  useTeam,
  useTeamMembershipsByMember,
  useTeams,
  useUpdateTeam,
} from './hooks/useTeams';
export {
  selectableMembers,
  useAddTeamMember,
  useRemoveTeamMember,
  useSetTeamMemberRole,
} from './hooks/useTeamMembers';

export { TeamFormDialog } from './components/TeamFormDialog';
export { TeamMembersPanel } from './components/TeamMembersPanel';
export { TeamsNavTabs } from './components/TeamsNavTabs';
export { TeamManagerBadge, TeamRoleBadge } from './components/TeamRoleBadge';

export { slugifyTeamName, teamSchema, type TeamValues } from './schemas/team.schema';
