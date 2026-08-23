import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MembersPage from './MembersPage';

const mockMembers = vi.hoisted(() => ({
  current: [
    {
      id: 'member-1',
      organization_id: 'org-1',
      user_id: 'user-1',
      role: 'owner' as const,
      status: 'active' as const,
      job_title: 'Directeur Général',
      created_at: '2026-08-01T10:00:00Z',
      updated_at: '2026-08-01T10:00:00Z',
      profile: {
        id: 'user-1',
        display_name: 'Alice Boss',
        avatar_url: null,
      },
    },
    {
      id: 'member-2',
      organization_id: 'org-1',
      user_id: 'user-2',
      role: 'technician' as const,
      status: 'active' as const,
      job_title: 'Technicien Fibre D3',
      created_at: '2026-08-05T10:00:00Z',
      updated_at: '2026-08-05T10:00:00Z',
      profile: {
        id: 'user-2',
        display_name: 'Bob Tech',
        avatar_url: null,
      },
    },
  ],
}));

const mockInvitations = vi.hoisted(() => ({
  current: [
    {
      id: 'inv-1',
      organization_id: 'org-1',
      email: 'claire@rezo360.com',
      role: 'technician' as const,
      token: 'token-uuid-1234',
      status: 'pending' as const,
      expires_at: '2026-08-30T10:00:00Z',
      created_at: '2026-08-20T10:00:00Z',
    },
  ],
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'alice@rezo360.com' } }),
}));

vi.mock('@/features/organizations', () => ({
  useCurrentOrganization: () => ({
    organization: { id: 'org-1', name: 'Rezo Optique SARL' },
  }),
  useMembers: () => ({ data: mockMembers.current, isPending: false }),
  useInvitations: () => ({ data: mockInvitations.current, isPending: false }),
  usePermission: () => ({
    role: 'owner',
    can: () => true,
  }),
  useUpdateMemberRole: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useUpdateMemberDetails: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useRemoveMember: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useRevokeInvitation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useResendInvitationEmail: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useOrganizationEntitlements: () => ({ planCode: 'pro' }),
  sortMembersByRole: (m: any[]) => m,
  PERMISSIONS: {
    memberUpdateRole: 'member.update_role',
    memberRemove: 'member.remove',
    memberInvite: 'member.invite',
    teamView: 'team.view',
  },
  RoleBadge: ({ role }: { role: string }) => <span data-testid="role-badge">{role}</span>,
  MemberQuotaBar: () => <div data-testid="member-quota-bar">Quota: 2/5 sièges</div>,
  MemberRow: ({ member }: { member: any }) => (
    <div data-testid={`member-row-${member.id}`}>
      <span>{member.profile?.display_name ?? member.job_title}</span>
      <span>{member.job_title}</span>
    </div>
  ),
  InvitationLink: ({ token }: { token: string }) => <div>Lien: {token}</div>,
  AddMemberDialog: () => <button type="button">Créer un compte</button>,
  InviteMemberDialog: () => <button type="button">Inviter par e-mail</button>,
}));

vi.mock('@/features/teams', () => ({
  useTeamMembershipsByMember: () => ({ data: new Map() }),
}));

vi.mock('@/features/industries', () => ({
  useLabel: () => 'Techniciens',
}));

vi.mock('@/features/billing', () => ({
  useOrganizationEntitlements: () => ({ planCode: 'pro' }),
  useSeatBilling: () => ({
    quotaBlocked: false,
    isExtraSeat: false,
    activeSeats: 2,
    includedSeats: 5,
    isBilled: true,
  }),
}));

describe('MembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche la liste des membres actifs et leur rôle', () => {
    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Alice Boss')).toBeInTheDocument();
    expect(screen.getByText('Bob Tech')).toBeInTheDocument();
    expect(screen.getByTestId('member-quota-bar')).toBeInTheDocument();
  });

  it('affiche les invitations en attente avec leur e-mail', () => {
    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('claire@rezo360.com')).toBeInTheDocument();
    expect(screen.getByText('Invitations en attente')).toBeInTheDocument();
  });

  it('propose les boutons d’ajout direct et d’invitation', () => {
    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Créer un compte')).toBeInTheDocument();
    expect(screen.getByText('Inviter par e-mail')).toBeInTheDocument();
  });
});
