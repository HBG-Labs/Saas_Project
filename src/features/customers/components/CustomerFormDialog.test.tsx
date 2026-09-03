import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';
import type { Customer } from '@/types/domain';

import { CustomerFormDialog } from './CustomerFormDialog';

/**
 * Trois régressions, invisibles au typecheck comme au lint.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CES TESTS SURVEILLENT, ET POURQUOI ILS EXISTENT
 *
 * Les trois défauts corrigés le 03/09/2026 avaient tenu des semaines sans être
 * vus, parce qu'aucun outil statique ne peut les voir :
 *
 *   1. `registrationNumber` figurait dans le schéma zod, dans les valeurs par
 *      défaut, dans la fiche en lecture et dans l'export CSV — mais AUCUN champ
 *      ne l'exposait. TypeScript ne remarque pas un champ absent d'un JSX.
 *   2. `createCustomer` n'acceptait ni le SIRET ni le N° TVA : la valeur saisie
 *      dans le champ « N° TVA », lui bien présent, était perdue en silence. Un
 *      objet auquel il manque une clé optionnelle reste parfaitement typé.
 *   3. Le patch d'édition envoyait `latitude` et `longitude` à `customers`, où
 *      ces colonnes n'existent pas — PostgREST refusait. Les types de la base
 *      étant écrits à la main, rien ne l'a signalé.
 *
 * D'où des assertions portant sur ce qui PART vers l'API, et non sur l'état
 * interne du formulaire : c'est la frontière où les trois bugs se manifestaient.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockSyncSite = vi.fn();

vi.mock('../hooks/useCustomers', () => ({
  useCreateCustomer: () => ({ mutateAsync: mockCreate }),
  useUpdateCustomer: () => ({ mutateAsync: mockUpdate }),
}));

vi.mock('../hooks/useCustomerChildren', () => ({
  useSyncPrimarySiteLocation: () => ({ mutateAsync: mockSyncSite }),
}));

// Le géocodage part sur le réseau : on le neutralise, et l'on vérifie au passage
// qu'il n'est plus appelé du tout en édition.
const mockGeocode = vi.fn(() => Promise.resolve([]));

// Le sélecteur de carte est remplacé par un bouton qui rend la position
// exactement comme le vrai composant : c'est le seul moyen de reproduire le
// geste « j'ai pointé sur la carte », dont dépend toute la branche de
// synchronisation du site.
vi.mock('@/features/geo', () => ({
  forwardGeocode: (...args: unknown[]) => mockGeocode(...(args as [])),
  MapLocationPickerDialog: ({
    onSelectLocation,
  }: {
    onSelectLocation: (lieu: { latitude: number; longitude: number }) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onSelectLocation({ latitude: 14.6089, longitude: -61.0733 });
      }}
    >
      pointer sur la carte
    </button>
  ),
}));

const CLIENT: Customer = {
  id: 'cus-1',
  organization_id: 'org-1',
  reference: 'CLI-0001',
  name: 'Mairie de Saint-Pierre',
  legal_name: null,
  registration_number: null,
  vat_number: null,
  email: null,
  phone: null,
  address_line1: '12 rue des Écoles',
  address_line2: null,
  postal_code: '97250',
  city: 'Saint-Pierre',
  country: 'FR',
  notes: null,
  status: 'active',
  created_by: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

async function ouvrir(ui: React.ReactElement) {
  const user = userEvent.setup();
  renderWithProviders(ui);
  await user.click(screen.getByRole('button', { name: 'ouvrir' }));
  return user;
}

describe('CustomerFormDialog', () => {
  beforeEach(() => {
    mockCreate.mockReset().mockResolvedValue(CLIENT);
    mockUpdate.mockReset().mockResolvedValue(CLIENT);
    mockSyncSite.mockReset().mockResolvedValue(null);
    mockGeocode.mockReset().mockResolvedValue([]);
  });

  it('expose un champ SIRET, sans quoi la donnée ne peut pas entrer', async () => {
    await ouvrir(<CustomerFormDialog organizationId="org-1" trigger={<button>ouvrir</button>} />);

    expect(screen.getByLabelText(/SIRET/i)).toBeInTheDocument();
  });

  it('transmet le SIRET et le N° TVA à la création', async () => {
    const user = await ouvrir(
      <CustomerFormDialog organizationId="org-1" trigger={<button>ouvrir</button>} />,
    );

    await user.type(screen.getByLabelText(/nom du client/i), 'Garage Bellevue');
    await user.type(screen.getByLabelText(/SIRET/i), '12345678900012');
    await user.type(screen.getByLabelText(/TVA/i), 'FR12345678901');
    await user.click(screen.getByRole('button', { name: /créer le client/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    expect(mockCreate.mock.calls[0]?.[0]).toMatchObject({
      name: 'Garage Bellevue',
      registrationNumber: '12345678900012',
      vatNumber: 'FR12345678901',
    });
  });

  it('n’envoie jamais latitude ni longitude en édition — ces colonnes n’existent pas', async () => {
    const user = await ouvrir(
      <CustomerFormDialog
        organizationId="org-1"
        customer={CLIENT}
        trigger={<button>ouvrir</button>}
      />,
    );

    await user.clear(screen.getByLabelText(/nom du client/i));
    await user.type(screen.getByLabelText(/nom du client/i), 'Mairie du Marin');
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    const patch = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('latitude');
    expect(patch).not.toHaveProperty('longitude');
    expect(patch).toMatchObject({ name: 'Mairie du Marin' });

    // Le géocodage n'avait de sens que pour poser le site principal à la
    // création. En édition il ne servait qu'à alimenter un patch invalide.
    expect(mockGeocode).not.toHaveBeenCalled();

    // Et sans geste explicite sur la carte, le site principal ne bouge pas.
    expect(mockSyncSite).not.toHaveBeenCalled();
  });

  it('reporte la position sur le site principal quand elle est pointée sur la carte', async () => {
    const user = await ouvrir(
      <CustomerFormDialog
        organizationId="org-1"
        customer={CLIENT}
        trigger={<button>ouvrir</button>}
      />,
    );

    await user.click(screen.getByRole('button', { name: /pointer sur la carte/i }));
    await user.click(screen.getByRole('button', { name: /^enregistrer$/i }));

    await waitFor(() => {
      expect(mockSyncSite).toHaveBeenCalledTimes(1);
    });

    expect(mockSyncSite.mock.calls[0]?.[0]).toMatchObject({
      customerId: CLIENT.id,
      organizationId: 'org-1',
      latitude: 14.6089,
      longitude: -61.0733,
    });

    // La fiche reste mise à jour, et toujours sans les colonnes fantômes.
    const patch = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('latitude');
  });
});
