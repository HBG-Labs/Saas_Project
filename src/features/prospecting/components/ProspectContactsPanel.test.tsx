import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';
import type { ProspectContact } from '@/types/domain';

const { addProspectContact } = vi.hoisted(() => ({
  addProspectContact: vi.fn(),
}));

vi.mock('../api/prospecting.api', async () => {
  const actual = await vi.importActual<typeof import('../api/prospecting.api')>('../api/prospecting.api');
  return { ...actual, addProspectContact };
});

import { ProspectContactsPanel } from './ProspectContactsPanel';

const SIREN = '123456789';

function contact(overrides: Partial<ProspectContact> = {}): ProspectContact {
  return {
    id: 'contact-1',
    siren: SIREN,
    contact_type: 'email',
    value: 'contact@plomberie-antilles.fr',
    source: 'saisie_manuelle',
    collected_at: '2026-09-24T00:00:00Z',
    verified_at: null,
    confidence: null,
    created_at: '2026-09-24T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  addProspectContact.mockResolvedValue(contact());
});

describe('ProspectContactsPanel', () => {
  it('explique que l’enrichissement automatisé n’est pas branché, mais que la saisie manuelle reste possible', () => {
    renderWithProviders(<ProspectContactsPanel siren={SIREN} contacts={[]} />);

    expect(screen.getByText(/saisir une manuellement/)).toBeInTheDocument();
  });

  it('affiche les coordonnées existantes avec leur origine', () => {
    renderWithProviders(<ProspectContactsPanel siren={SIREN} contacts={[contact()]} />);

    expect(screen.getByText('contact@plomberie-antilles.fr')).toBeInTheDocument();
    expect(screen.getByText(/saisie manuelle/)).toBeInTheDocument();
  });

  it('ajoute une coordonnée saisie manuellement', async () => {
    renderWithProviders(<ProspectContactsPanel siren={SIREN} contacts={[]} />);

    fireEvent.change(screen.getByLabelText('Valeur'), { target: { value: 'contact@entreprise.fr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => {
      expect(addProspectContact).toHaveBeenCalledWith({
        siren: SIREN,
        contactType: 'email',
        value: 'contact@entreprise.fr',
      });
    });
  });

  it('ne permet pas d’ajouter une valeur vide', () => {
    renderWithProviders(<ProspectContactsPanel siren={SIREN} contacts={[]} />);

    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled();
  });
});
