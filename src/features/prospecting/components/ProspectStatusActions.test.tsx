import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';

const { updateProspectStatus, suppressProspect } = vi.hoisted(() => ({
  updateProspectStatus: vi.fn().mockResolvedValue(undefined),
  suppressProspect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../api/prospecting.api', async () => {
  const actual = await vi.importActual<typeof import('../api/prospecting.api')>('../api/prospecting.api');
  return { ...actual, updateProspectStatus, suppressProspect };
});

import { ProspectStatusActions } from './ProspectStatusActions';

const SIREN = '123456789';

beforeEach(() => {
  vi.clearAllMocks();
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
});
