import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';

const { searchOrganizationsForConversion, convertProspectToClient, updateProspectStatus, canManage } = vi.hoisted(() => ({
  searchOrganizationsForConversion: vi.fn(),
  convertProspectToClient: vi.fn().mockResolvedValue(undefined),
  updateProspectStatus: vi.fn().mockResolvedValue(undefined),
  canManage: { current: true },
}));

vi.mock('../api/prospecting.api', async () => {
  const actual = await vi.importActual<typeof import('../api/prospecting.api')>('../api/prospecting.api');
  return { ...actual, searchOrganizationsForConversion, convertProspectToClient, updateProspectStatus };
});

vi.mock('../hooks/usePlatformAdmin', () => ({
  usePlatformAdmin: () => ({
    isAdmin: true,
    isLoading: false,
    can: (permission: string) => permission === 'prospecting.manage' && canManage.current,
  }),
}));

import { ProspectConversionActions } from './ProspectConversionActions';

const SIREN = '123456789';
const ORG = { id: 'org-1', name: 'HBG Labs', legal_name: null, registration_number: '10919844000017' };

beforeEach(() => {
  vi.clearAllMocks();
  canManage.current = true;
  searchOrganizationsForConversion.mockResolvedValue([ORG]);
});

describe('ProspectConversionActions', () => {
  it('ne propose plus aucune action une fois le prospect converti', () => {
    renderWithProviders(<ProspectConversionActions siren={SIREN} status="converti" />);

    expect(screen.queryByRole('button', { name: 'Convertir en client' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Passer en essai' })).not.toBeInTheDocument();
  });

  it('« Passer en essai » ne propose plus le bouton une fois en essai', () => {
    renderWithProviders(<ProspectConversionActions siren={SIREN} status="essai" />);

    expect(screen.queryByRole('button', { name: 'Passer en essai' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convertir en client' })).toBeInTheDocument();
  });

  it('passe en essai au clic', async () => {
    renderWithProviders(<ProspectConversionActions siren={SIREN} status="interesse" />);

    fireEvent.click(screen.getByRole('button', { name: 'Passer en essai' }));

    await waitFor(() => {
      expect(updateProspectStatus).toHaveBeenCalledWith(SIREN, 'essai');
    });
  });

  it('la conversion exige de sélectionner une organisation avant de pouvoir confirmer', async () => {
    renderWithProviders(<ProspectConversionActions siren={SIREN} status="essai" />);

    fireEvent.click(screen.getByRole('button', { name: 'Convertir en client' }));

    const confirmer = await screen.findByRole('button', { name: 'Confirmer la conversion' });
    expect(confirmer).toBeDisabled();

    fireEvent.click(await screen.findByRole('button', { name: /HBG Labs/ }));
    expect(confirmer).not.toBeDisabled();

    fireEvent.click(confirmer);

    await waitFor(() => {
      expect(convertProspectToClient).toHaveBeenCalledWith(SIREN, 'org-1');
    });
  });

  it('ne propose rien à un administrateur sans prospecting.manage, sans appeler la recherche', () => {
    canManage.current = false;
    renderWithProviders(<ProspectConversionActions siren={SIREN} status="essai" />);

    expect(screen.queryByRole('button', { name: 'Convertir en client' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Passer en essai' })).not.toBeInTheDocument();
    expect(searchOrganizationsForConversion).not.toHaveBeenCalled();
  });
});
