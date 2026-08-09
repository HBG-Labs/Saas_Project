/**
 * API publique de la feature « organizations ».
 *
 * Les autres features et les pages importent depuis ce point d'entrée, jamais
 * depuis un fichier interne : la règle ESLint `no-restricted-imports` l'impose.
 */
export {
  canReviewReport,
  ORG_ROLES,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  roleHasAnyPermission,
  roleHasPermission,
  type Permission,
} from './rbac';

export {
  acceptInvitation,
  createOrganization,
  getMyMembership,
  getOrganization,
  getOrganizationBySlug,
  inviteMember,
  listInvitations,
  listMembers,
  listMyOrganizations,
  removeMember,
  revokeInvitation,
  suggestOrganizationSlug,
  updateMemberRole,
  updateOrganization,
} from './api/organizations.api';

export { OrganizationProvider } from './context/OrganizationProvider';
export type {
  OrganizationContextValue,
  OrganizationStatus,
} from './context/organization-context';
export { useCurrentOrganization } from './hooks/useCurrentOrganization';
export { usePermission, type PermissionChecks } from './hooks/usePermission';
export { useVisibleNavItems } from './hooks/useVisibleNavItems';
