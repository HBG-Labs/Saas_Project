import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Organization } from '@/types/domain';

import { DeleteOrganizationCard } from './DeleteOrganizationCard';

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock('../hooks/usePermission', () => ({
  usePermission: () => ({ can: mocks.can }),
}));

vi.mock('../hooks/useOrganizations', () => ({
  useDeleteOrganization: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  }),
}));

const organization = {
  id: 'org-123',
  name: 'Test 972',
} as Organization;

function renderCard() {
  const router = createMemoryRouter(
    [
      { path: '/organisation', element: <DeleteOrganizationCard organization={organization} /> },
      { path: '/dashboard', element: <p>Tableau de bord</p> },
    ],
    { initialEntries: ['/organisation'] },
  );

  return render(<RouterProvider router={router} />);
}

describe('DeleteOrganizationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockReturnValue(true);
    mocks.mutateAsync.mockResolvedValue(undefined);
  });

  it('reste invisible sans la permission réservée au propriétaire', () => {
    mocks.can.mockReturnValue(false);

    renderCard();

    expect(
      screen.queryByRole('button', { name: 'Supprimer l’entreprise' }),
    ).not.toBeInTheDocument();
  });

  it('exige le nom exact avant de supprimer puis revient au tableau de bord', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Supprimer l’entreprise' }));

    const confirmButton = screen.getByRole('button', { name: 'Supprimer définitivement' });
    expect(confirmButton).toBeDisabled();

    const confirmation = screen.getByLabelText(/Saisissez « Test 972 » pour confirmer/);
    await user.type(confirmation, 'Test972');
    expect(confirmButton).toBeDisabled();

    await user.clear(confirmation);
    await user.type(confirmation, 'Test 972');
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(mocks.mutateAsync).toHaveBeenCalledWith('org-123');
    expect(await screen.findByText('Tableau de bord')).toBeInTheDocument();
  });
});
