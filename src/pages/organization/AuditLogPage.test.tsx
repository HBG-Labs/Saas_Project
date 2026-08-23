import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuditLogPage from './AuditLogPage';

vi.mock('@/features/organizations', () => ({
  useCurrentOrganization: () => ({
    organization: { id: 'org-1', name: 'Tech Telecom SAS' },
  }),
  OrganizationNavTabs: () => null,
}));

vi.mock('@/features/audit', () => ({
  useAuditLogs: () => ({
    data: [
      {
        id: 'log-1',
        organization_id: 'org-1',
        user_id: 'user-1',
        actor_label: 'Alice Dupont',
        action: 'mission.created',
        entity_type: 'mission',
        entity_id: 'mis-1',
        metadata: { reference: 'MIS-2026-001', title: 'Raccordement D3' },
        created_at: '2026-08-23T10:00:00Z',
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
  describeAuditAction: vi.fn((action: string) => `Action ${action}`),
  AUDIT_ACTION_LABELS: {
    'mission.created': 'Création de mission',
    'mission.updated': 'Mise à jour de mission',
  },
}));

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rend le journal d’audit avec les filtres et les événements sans erreur', () => {
    render(
      <MemoryRouter>
        <AuditLogPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Journal d'audit")).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Rechercher une action, un auteur...')).toBeInTheDocument();
    expect(screen.getByText('Mission')).toBeInTheDocument();
  });
});
