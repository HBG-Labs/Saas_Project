import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/features/organizations', () => ({
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
}));

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
});
