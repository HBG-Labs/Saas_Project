import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';

const { updateProspectStatus, suppressProspect, canManage } = vi.hoisted(() => ({
  updateProspectStatus: vi.fn().mockResolvedValue(undefined),
  suppressProspect: vi.fn().mockResolvedValue(undefined),
  canManage: { current: true },
}));

vi.mock('../api/prospecting.api', async () => {
  const actual = await vi.importActual<typeof import('../api/prospecting.api')>('../api/prospecting.api');
  return { ...actual, updateProspectStatus, suppressProspect };
});

// `usePlatformAdmin` appelle `useAuth()`, qui exige un `<AuthProvider>` réel —
// absent de `renderWithProviders`. Le mocker directement isole ce test de
// l'authentification, tout en gardant le contrôle sur `prospecting.manage`
// pour vérifier le masquage (Phase 13, audit permissions).
vi.mock('../hooks/usePlatformAdmin', () => ({
  usePlatformAdmin: () => ({
    isAdmin: true,
    isLoading: false,
    can: (permission: string) => permission === 'prospecting.manage' && canManage.current,
  }),
}));

import { ProspectStatusActions } from './ProspectStatusActions';

const SIREN = '123456789';

beforeEach(() => {
  vi.clearAllMocks();
  canManage.current = true;
});

describe('ProspectStatusActions', () => {
  it('propose chaque statut manuel sauf le statut courant, jamais essai ni converti', () => {
    renderWithProviders(<ProspectStatusActions siren={SIREN} status="nouveau" />);

    expect(screen.getByRole('button', { name: 'À qualifier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contacté' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ne plus contacter' })).toBeInTheDocument();

    // Réservés à la Phase 9 (§22 : reliés à une organisation/client réel).
    expect(screen.queryByRole('button', { name: 'Essai REZO360' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Converti' })).not.toBeInTheDocument();
  });

  it('n’affiche pas de bouton pour le statut déjà courant', () => {
    renderWithProviders(<ProspectStatusActions siren={SIREN} status="contacte" />);

    expect(screen.queryByRole('button', { name: 'Contacté' })).not.toBeInTheDocument();
  });

  it('change le statut au clic', async () => {
    renderWithProviders(<ProspectStatusActions siren={SIREN} status="nouveau" />);

    fireEvent.click(screen.getByRole('button', { name: 'À qualifier' }));

    await waitFor(() => {
      expect(updateProspectStatus).toHaveBeenCalledWith(SIREN, 'a_qualifier');
    });
  });

  it('« Ne plus contacter » exige une confirmation avant d’écrire quoi que ce soit', async () => {
    renderWithProviders(<ProspectStatusActions siren={SIREN} status="nouveau" />);

    fireEvent.click(screen.getByRole('button', { name: 'Ne plus contacter' }));
    expect(suppressProspect).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer l’opposition' }));

    await waitFor(() => {
      expect(suppressProspect).toHaveBeenCalledWith(SIREN, null);
    });
  });

  it('masque toutes les actions d’écriture pour un administrateur sans prospecting.manage', () => {
    canManage.current = false;
    renderWithProviders(<ProspectStatusActions siren={SIREN} status="nouveau" />);

    expect(screen.queryByRole('button', { name: 'À qualifier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ne plus contacter' })).not.toBeInTheDocument();
    expect(screen.getByText(/lecture seule/i)).toBeInTheDocument();
  });
});
