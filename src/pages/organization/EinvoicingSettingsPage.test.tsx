import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EinvoicingSettingsPage from './EinvoicingSettingsPage';

const state = vi.hoisted(() => ({
  canUpdate: true,
  save: vi.fn(),
  org: {
    id: 'org-1',
    name: 'Atelier Test',
    legal_name: 'Atelier Test SAS',
    registration_number: '12345678900012',
    vat_number: 'FR12345678901',
    address_line1: '1 rue du Test',
    address_line2: null,
    postal_code: '97200',
    city: 'Fort-de-France',
    country: 'FR',
    legal_form: 'SAS',
    vat_regime: 'reel_normal',
    iban: 'FR7630001007941234567890185',
    bic: 'AGRIFRPP',
    share_capital_cents: 100000,
    ape_code: '',
    rcs_city: '',
  },
}));
vi.mock('@/features/organizations', () => ({
  useCurrentOrganization: () => ({ organization: state.org }),
  useOrganization: () => ({ data: state.org, isPending: false, isError: false }),
  usePermission: () => ({ can: () => state.canUpdate }),
  useUpdateOrganization: () => ({ mutateAsync: state.save, error: null }),
  PERMISSIONS: { organizationUpdate: 'organization.update' },
  OrganizationNavTabs: () => null,
}));
vi.mock('@/features/einvoicing/components/ProviderConnectionCard', () => ({
  ProviderConnectionCard: () => (
    <section aria-label="Plateforme agréée">
      <span>SUPER PDP</span>
      <span>Non connectée</span>
    </section>
  ),
}));
const renderPage = () =>
  render(
    <MemoryRouter>
      <EinvoicingSettingsPage />
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.canUpdate = true;
  state.save.mockImplementation((patch: Record<string, unknown>) =>
    Promise.resolve({ ...state.org, ...patch }),
  );
});

describe('préparation à la facturation électronique', () => {
  it('présente la plateforme retenue séparément des informations légales', () => {
    renderPage();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7');
    expect(screen.getByRole('region', { name: 'Plateforme agréée' })).toHaveTextContent(
      'SUPER PDP',
    );
    expect(screen.getByText('Non connectée')).toBeInTheDocument();
  });
  it('enregistre les coordonnées bancaires normalisées et permet de vider une valeur', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.clear(screen.getByLabelText('IBAN'));
    await user.type(screen.getByLabelText('IBAN'), 'fr76 3000 1007 9412 3456 7890 185');
    await user.clear(screen.getByLabelText('BIC'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer les informations' }));
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith(
        expect.objectContaining({
          iban: 'FR7630001007941234567890185',
          bic: null,
          share_capital_cents: 100000,
        }),
      ),
    );
    expect(await screen.findByText('Informations enregistrées')).toBeInTheDocument();
  });
  it('ne permet pas l’écriture à un membre sans droit de modification', () => {
    state.canUpdate = false;
    renderPage();
    expect(screen.getByLabelText('IBAN')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Enregistrer les informations' }),
    ).not.toBeInTheDocument();
  });
});
