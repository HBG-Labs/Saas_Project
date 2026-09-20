import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';

import { EMPTY_MISSION_FILTERS } from '../mission-filters';

import { MissionFiltersBar } from './MissionFiltersBar';

vi.mock('@/features/customers', () => ({
  useCustomers: () => ({ data: [], isPending: false }),
}));

vi.mock('@/features/organizations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/organizations')>();

  return {
    ...actual,
    memberDisplayName: () => 'Membre',
    useMembers: () => ({ data: [], isPending: false }),
  };
});

vi.mock('@/features/teams', () => ({
  useTeams: () => ({ data: [], isPending: false }),
}));

describe('MissionFiltersBar', () => {
  it('rend les filtres actifs visibles et permet de les retirer séparément', async () => {
    const onChange = vi.fn();
    const value = {
      ...EMPTY_MISSION_FILTERS,
      search: 'Dupont',
      status: 'draft',
    };

    renderWithProviders(
      <MissionFiltersBar organizationId="org-1" value={value} onChange={onChange} showAdvanced />,
    );

    expect(screen.getByText('Recherche : Dupont')).toBeInTheDocument();
    expect(screen.getByText('Statut : Brouillon')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Retirer le filtre « Recherche : Dupont »' }),
    );

    expect(onChange).toHaveBeenCalledWith({ ...value, search: '' });
  });
});
