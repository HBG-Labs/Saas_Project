import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/config/routes';

import { RequireOrganization } from './RequireOrganization';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useCurrentOrganization: vi.fn(),
}));

vi.mock('@/features/auth', () => ({ useAuth: mocks.useAuth }));
vi.mock('@/features/organizations', () => ({
  useCurrentOrganization: mocks.useCurrentOrganization,
}));
vi.mock('@/features/portal/portal-user', () => ({ estUtilisateurPortail: () => false }));

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/tableau-de-bord']}>
      <Routes>
        <Route element={<RequireOrganization />}>
          <Route path="/tableau-de-bord" element={<p>Tableau de bord</p>} />
        </Route>
        <Route path={ROUTES.organizationNew} element={<p>Créer votre entreprise</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: { id: 'user-1' } });
  });

  it('redirige vers la création d’entreprise lorsqu’aucune organisation ne reste', async () => {
    mocks.useCurrentOrganization.mockReturnValue({ status: 'none' });

    renderGuard();

    expect(await screen.findByText('Créer votre entreprise')).toBeInTheDocument();
    expect(screen.queryByText('Tableau de bord')).not.toBeInTheDocument();
  });

  it('laisse accéder à la route lorsqu’une organisation est active', () => {
    mocks.useCurrentOrganization.mockReturnValue({ status: 'ready' });

    renderGuard();

    expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
  });
});
