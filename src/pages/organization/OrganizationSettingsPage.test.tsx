import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import OrganizationSettingsPage from './OrganizationSettingsPage';

const mockMutateAsync = vi.fn();

const mockOrg = vi.hoisted(() => ({
  id: 'org-123',
  name: 'HBZIndustrie',
  slug: 'hbz-industrie',
  industry: 'heating',
  legal_name: 'HBZ Industrie SAS',
  registration_number: '12345678900012',
  vat_number: 'FR12345678900',
  default_vat_rate: 20,
  email: 'contact@hbzindustrie.fr',
  phone: '0102030405',
  address_line1: '10 Rue de l’Industrie',
  address_line2: null,
  postal_code: '75001',
  city: 'Paris',
  country: 'FR',
}));

vi.mock('@/features/organizations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/organizations')>();
  return {
    ...actual,
    useCurrentOrganization: () => ({
      organization: mockOrg,
    }),
    useOrganization: () => ({
      data: mockOrg,
      isPending: false,
      isError: false,
    }),
    useUpdateOrganization: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
    usePermission: () => ({
      can: () => true,
    }),
    PERMISSIONS: {
      organization: {
        update: 'organization.update',
      },
    },
    OrganizationBillingCard: () => <div data-testid="billing-card">Billing Card</div>,
    OrganizationNavTabs: () => null,
  };
});

vi.mock('@/features/industries', () => ({
  useIndustries: () => ({
    data: [
      { code: 'fiber_telecom', label: 'Fibre & Télécom' },
      { code: 'heating', label: 'Chauffage' },
      { code: 'hvac', label: 'Froid & Climatisation' },
    ],
    isPending: false,
  }),
}));

describe('OrganizationSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('affiche le formulaire des paramètres avec les valeurs actuelles', async () => {
    render(
      <MemoryRouter>
        <OrganizationSettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Paramètres de l'entreprise")).toBeInTheDocument();
    expect(screen.getByDisplayValue('HBZIndustrie')).toBeInTheDocument();
  });

  it('soumet les modifications avec postal_code et industry correctement formatés', async () => {
    mockMutateAsync.mockResolvedValueOnce({ ...mockOrg, name: 'HBZIndustrie Updated' });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OrganizationSettingsPage />
      </MemoryRouter>,
    );

    const nameInput = screen.getByLabelText(/Nom de l’entreprise/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'HBZIndustrie New');

    const submitBtn = screen.getByRole('button', { name: /Enregistrer les modifications/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'HBZIndustrie New',
          industry: 'heating',
          postal_code: '75001',
          city: 'Paris',
        }),
      );
    });
  });

  it('propose les entreprises officielles et remplit le nom, la raison sociale et le SIRET', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                siren: '915303705',
                nom_complet: 'PRIAM',
                nom_raison_sociale: 'PRIAM SAS',
                siege: {
                  siret: '91530370500018',
                  nom_commercial: 'PRIAM',
                  code_postal: '44100',
                  libelle_commune: 'NANTES',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OrganizationSettingsPage />
      </MemoryRouter>,
    );

    const nameInput = screen.getByLabelText(/Nom de l’entreprise/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Priam');
    await user.click(await screen.findByRole('option', { name: /PRIAM.*SIRET 91530370500018/i }));

    expect(nameInput).toHaveValue('PRIAM');
    expect(screen.getByLabelText('Raison sociale')).toHaveValue('PRIAM SAS');
    expect(screen.getByLabelText('SIRET')).toHaveValue('91530370500018');
    expect(screen.getByText(/Informations officielles appliquées : PRIAM/i)).toBeInTheDocument();
  });

  it('retrouve également une entreprise à partir de son SIRET exact', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                siren: '915303705',
                nom_complet: 'PRIAM',
                nom_raison_sociale: 'PRIAM SAS',
                siege: { siret: '91530370500018' },
                matching_etablissements: [
                  {
                    siret: '91530370500026',
                    code_postal: '75001',
                    libelle_commune: 'PARIS',
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OrganizationSettingsPage />
      </MemoryRouter>,
    );

    const siretInput = screen.getByLabelText('SIRET');
    await user.clear(siretInput);
    await user.type(siretInput, '91530370500026');
    await user.click(await screen.findByRole('option', { name: /PRIAM.*91530370500026/i }));

    expect(screen.getByLabelText(/Nom de l’entreprise/i)).toHaveValue('PRIAM');
    expect(screen.getByLabelText('Raison sociale')).toHaveValue('PRIAM SAS');
    expect(siretInput).toHaveValue('91530370500026');
  });
});
