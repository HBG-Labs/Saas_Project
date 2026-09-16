import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';
import type { ProspectContact } from '@/types/domain';

const { addProspectContact, scrapeProspectContacts, canManage } = vi.hoisted(() => ({
  addProspectContact: vi.fn(),
  scrapeProspectContacts: vi.fn(),
  canManage: { current: true },
}));

vi.mock('../api/prospecting.api', async () => {
  const actual = await vi.importActual<typeof import('../api/prospecting.api')>('../api/prospecting.api');
  return { ...actual, addProspectContact, scrapeProspectContacts };
});

vi.mock('../hooks/usePlatformAdmin', () => ({
  usePlatformAdmin: () => ({
    isAdmin: true,
    isLoading: false,
    can: (permission: string) => permission === 'prospecting.manage' && canManage.current,
  }),
}));

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
  canManage.current = true;
  addProspectContact.mockResolvedValue(contact());
  scrapeProspectContacts.mockResolvedValue({ found: [] });
});

describe('ProspectContactsPanel', () => {
  it('explique que la saisie manuelle est possible, sans coordonnée existante', () => {
    renderWithProviders(<ProspectContactsPanel siren={SIREN} contacts={[]} />);

    expect(screen.getByText(/saisissez-en une/)).toBeInTheDocument();
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

  it('masque le formulaire de saisie pour un administrateur sans prospecting.manage', () => {
    canManage.current = false;
    renderWithProviders(<ProspectContactsPanel siren={SIREN} contacts={[contact()]} />);

    expect(screen.getByText('contact@plomberie-antilles.fr')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajouter' })).not.toBeInTheDocument();
    expect(screen.getByText(/lecture seule/i)).toBeInTheDocument();
  });

  it('ne propose pas la recherche sur le site officiel sans site renseigné', () => {
    renderWithProviders(<ProspectContactsPanel siren={SIREN} contacts={[contact()]} />);

    expect(screen.queryByRole('button', { name: 'Rechercher sur le site officiel' })).not.toBeInTheDocument();
  });

  it('lance la recherche sur le site officiel et affiche le résultat', async () => {
    scrapeProspectContacts.mockResolvedValue({
      found: [contact({ id: 'contact-2', contact_type: 'phone', value: '05 96 00 00 00', source: 'site_officiel' })],
    });
    renderWithProviders(
      <ProspectContactsPanel
        siren={SIREN}
        contacts={[contact({ id: 'contact-site', contact_type: 'website', value: 'https://plomberie-antilles.fr' })]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rechercher sur le site officiel' }));

    await waitFor(() => {
      expect(scrapeProspectContacts).toHaveBeenCalledWith(SIREN);
    });
    expect(await screen.findByText('1 coordonnée trouvée.')).toBeInTheDocument();
  });

  it('n’affiche pas la recherche sur le site officiel pour un administrateur sans prospecting.manage', () => {
    canManage.current = false;
    renderWithProviders(
      <ProspectContactsPanel
        siren={SIREN}
        contacts={[contact({ id: 'contact-site', contact_type: 'website', value: 'https://plomberie-antilles.fr' })]}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Rechercher sur le site officiel' })).not.toBeInTheDocument();
  });
});
