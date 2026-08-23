import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AcceptInvitationPage from './AcceptInvitationPage';

const mockPreview = vi.hoisted(() => ({
  data: null as any,
  isPending: false,
  isError: false,
}));

const mockAuthUser = vi.hoisted(() => ({
  current: null as any,
}));

const mockAcceptInvitation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

const mockAcceptSignup = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: mockAuthUser.current }),
}));

vi.mock('@/features/organizations', () => ({
  useInvitationPreview: () => mockPreview,
  useAcceptInvitation: () => mockAcceptInvitation,
  useAcceptInvitationWithSignup: () => mockAcceptSignup,
  ROLE_LABELS: {
    technician: 'Technicien',
    admin: 'Administrateur',
    manager: 'Responsable d’exploitation',
    team_leader: 'Chef d’équipe',
    employee: 'Collaborateur',
    owner: 'Propriétaire',
  },
  ROLE_DESCRIPTIONS: {
    technician: 'Accès aux missions et saisie des temps.',
    admin: 'Gestion complète.',
    manager: 'Gestion des tournées.',
    team_leader: 'Gestion de l’équipe.',
    employee: 'Accès de base.',
    owner: 'Contrôle absolu.',
  },
}));

describe('AcceptInvitationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.current = null;
    mockPreview.data = null;
    mockPreview.isPending = false;
    mockPreview.isError = false;
  });

  it('affiche un état de chargement pendant la vérification', () => {
    mockPreview.isPending = true;

    render(
      <MemoryRouter initialEntries={['/invitations/token-123']}>
        <Routes>
          <Route path="/invitations/:token" element={<AcceptInvitationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Vérification de l’invitation/i)).toBeInTheDocument();
  });

  it('affiche un message d’invitation expirée ou invalide', () => {
    mockPreview.data = null;
    mockPreview.isPending = false;

    render(
      <MemoryRouter initialEntries={['/invitations/token-123']}>
        <Routes>
          <Route path="/invitations/:token" element={<AcceptInvitationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Cette invitation n’est plus valable/i)).toBeInTheDocument();
  });

  it('affiche les détails de l’organisation et le formulaire de création si non connecté', () => {
    mockPreview.data = {
      organizationName: 'Fibre Optique Solutions',
      role: 'technician',
      invitedEmail: 'tech@fibre.fr',
      expiresAt: '2026-08-30T10:00:00Z',
    };
    mockAuthUser.current = null;

    render(
      <MemoryRouter initialEntries={['/invitations/token-123']}>
        <Routes>
          <Route path="/invitations/:token" element={<AcceptInvitationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /Rejoindre Fibre Optique Solutions/i })).toBeInTheDocument();
    expect(screen.getByText(/Technicien/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Choisissez un mot de passe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rejoindre Fibre Optique Solutions/i })).toBeInTheDocument();
  });

  it('propose d’accepter directement si l’utilisateur est déjà connecté', () => {
    mockPreview.data = {
      organizationName: 'Fibre Optique Solutions',
      role: 'technician',
      invitedEmail: 'tech@fibre.fr',
      expiresAt: '2026-08-30T10:00:00Z',
    };
    mockAuthUser.current = { id: 'user-1', email: 'tech@fibre.fr' };

    render(
      <MemoryRouter initialEntries={['/invitations/token-123']}>
        <Routes>
          <Route path="/invitations/:token" element={<AcceptInvitationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /Accepter l’invitation/i })).toBeInTheDocument();
  });
});
