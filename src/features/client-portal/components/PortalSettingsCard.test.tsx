import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PortalSettingsCard } from './PortalSettingsCard';

const state = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

vi.mock('../hooks/useClientPortal', () => ({
  useClientPortalAccess: () => ({
    organizationId: 'org-1',
    isLoading: false,
    canManage: true,
    settings: {
      data: {
        enabled: true,
        allow_client_initiated: true,
        display_name: 'Atelier Démonstration',
      },
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
  }),
  useUpdatePortalSettings: () => ({
    mutate: state.mutate,
    isPending: false,
  }),
}));

describe('PortalSettingsCard', () => {
  beforeEach(() => {
    state.mutate.mockClear();
  });

  it('présente un état lisible et un seul contrôle par préférence', () => {
    render(<PortalSettingsCard />);

    expect(screen.getByText('Configuration du portail')).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Activer le portail client')).toHaveLength(1);
    expect(
      screen.getAllByLabelText('Autoriser les clients à ouvrir une conversation'),
    ).toHaveLength(1);
  });

  it('conserve les mutations existantes des réglages', async () => {
    const user = userEvent.setup();
    render(<PortalSettingsCard />);

    await user.click(screen.getByLabelText('Activer le portail client'));
    expect(state.mutate).toHaveBeenCalledWith(
      { enabled: false },
      expect.objectContaining({ onError: expect.any(Function) }),
    );

    const name = screen.getByLabelText('Nom affiché sur le portail et dans les e-mails');
    await user.clear(name);
    await user.type(name, 'REZO Terrain');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(state.mutate).toHaveBeenLastCalledWith(
      { display_name: 'REZO Terrain' },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });
});
