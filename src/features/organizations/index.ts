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
export { useVisibleNavGroups, useVisibleNavItems } from './hooks/useVisibleNavItems';

export {
  useCreateOrganization,
  useMyOrganizations,
  useOrganization,
  useUpdateOrganization,
} from './hooks/useOrganizations';
export {
  memberDisplayName,
  useCreateMemberAccount,
  sortMembersByRole,
  useMembers,
  useRemoveMember,
  useUpdateMemberDetails,
  useUpdateMemberRole,
} from './hooks/useMembers';
export {
  useAcceptInvitation,
  useInvitationPreview,
  useInvitations,
  useInviteMember,
  useResendInvitationEmail,
  useRevokeInvitation,
} from './hooks/useInvitations';

export { getInvitationPreview, type InvitationPreview } from './api/organizations.api';

export { InvitationLink } from './components/InvitationLink';
export { buildInvitationUrl } from './invitation-url';
export { InviteMemberDialog } from './components/InviteMemberDialog';
export { AddMemberDialog } from './components/AddMemberDialog';
export { MemberQuotaBar } from './components/MemberQuotaBar';
export { MemberRow } from './components/MemberRow';
export { OrganizationSwitcher } from './components/OrganizationSwitcher';
export { OwnershipCard } from './components/OwnershipCard';
export { RoleBadge } from './components/RoleBadge';
export { RoleSelect } from './components/RoleSelect';
