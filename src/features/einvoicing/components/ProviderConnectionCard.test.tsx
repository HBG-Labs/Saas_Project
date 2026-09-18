import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderConnectionCard } from './ProviderConnectionCard';

const { getEinvoicingProviderConnection, getSuperPdpReadiness, activateSuperPdpReception } =
  vi.hoisted(() => ({
    getEinvoicingProviderConnection: vi.fn(),
    getSuperPdpReadiness: vi.fn(),
    activateSuperPdpReception: vi.fn(),
  }));

vi.mock('../api/provider.api', () => ({
  getEinvoicingProviderConnection,
  getSuperPdpReadiness,
  startSuperPdpConnection: vi.fn(),
  verifySuperPdpConnection: vi.fn(),
  disconnectSuperPdp: vi.fn(),
  activateSuperPdpReception,
}));

function renderCard(props: { canManage?: boolean; registrationNumber?: string | null } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProviderConnectionCard
        organizationId="org-1"
        canManage={props.canManage ?? true}
        registrationNumber={props.registrationNumber ?? null}
      />
    </QueryClientProvider>,
  );
}

/**
 * Le connecteur n'expose `reception_status` que depuis la Phase 3 (réception).
 * La ligne complète — colonnes lues en base — sert de référence commune,
 * avec les champs faisant varier chaque scénario en override.
 */
function connection(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: 'org-1',
    provider_code: 'superpdp',
    status: 'connected',
    provider_company_id: '42',
    provider_environment: 'sandbox',
    company_verification_status: 'verified',
    user_identity_verification_status: 'verified',
    last_verified_at: '2026-09-04T00:00:00.000Z',
    last_error_code: null,
    last_error_message: null,
    reception_status: 'not_requested',
    reception_activated_at: null,
    reception_last_checked_at: null,
    reception_last_error_code: null,
    reception_last_error_message: null,
    created_at: '2026-09-04T00:00:00.000Z',
    updated_at: '2026-09-04T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSuperPdpReadiness.mockResolvedValue({ configured: true, environment: 'sandbox' });
});

describe('activation de la réception (Phase 2)', () => {
  it('n’affiche jamais la réception avant que l’émission ne soit connectée', async () => {
    getEinvoicingProviderConnection.mockResolvedValue(null);
    renderCard();
    await waitFor(() => expect(getEinvoicingProviderConnection).toHaveBeenCalled());
    expect(screen.queryByText('Réception des factures fournisseurs')).not.toBeInTheDocument();
  });

  it('propose l’activation une fois l’émission connectée, jamais activée par défaut', async () => {
    getEinvoicingProviderConnection.mockResolvedValue(connection());
    renderCard();
    await screen.findByText('Réception des factures fournisseurs');
    expect(screen.getByText('Non activée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Activer la réception/ })).toBeInTheDocument();
  });

  it('demande le lien d’autorisation au clic, jamais avant', async () => {
    getEinvoicingProviderConnection.mockResolvedValue(connection());
    activateSuperPdpReception.mockResolvedValue('https://api.superpdp.tech/oauth2/authorize?state=xyz');
    const user = userEvent.setup();
    renderCard();
    await screen.findByRole('button', { name: /Activer la réception/ });
    expect(activateSuperPdpReception).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Activer la réception/ }));
    expect(activateSuperPdpReception).toHaveBeenCalledWith('org-1');
    const link = await screen.findByRole('link', { name: /Continuer sur SUPER PDP/ });
    expect(link).toHaveAttribute('href', 'https://api.superpdp.tech/oauth2/authorize?state=xyz');
  });

  it('affiche l’adresse de facturation électronique une fois la réception active', async () => {
    getEinvoicingProviderConnection.mockResolvedValue(connection({ reception_status: 'active' }));
    renderCard({ registrationNumber: '852 322 915 00017' });
    await screen.findByText('Active');
    expect(screen.getByText('Adresse de facturation électronique')).toBeInTheDocument();
    expect(screen.getByText('852322915')).toBeInTheDocument();
    // Une activation déjà acquise ne doit plus proposer le bouton d'activation.
    expect(screen.queryByRole('button', { name: /Activer la réception/ })).not.toBeInTheDocument();
  });

  it('un échec affiche le motif renvoyé par SUPER PDP et permet de réessayer', async () => {
    getEinvoicingProviderConnection.mockResolvedValue(
      connection({
        reception_status: 'failed',
        reception_last_error_message: 'SUPER PDP a refusé l’accès à la réception.',
      }),
    );
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'SUPER PDP a refusé l’accès à la réception.',
    );
    expect(screen.getByRole('button', { name: /Réessayer l’activation/ })).toBeInTheDocument();
  });

  it('un membre en lecture seule voit le statut mais aucun bouton d’activation', async () => {
    getEinvoicingProviderConnection.mockResolvedValue(connection());
    renderCard({ canManage: false });
    await screen.findByText('Réception des factures fournisseurs');
    expect(screen.queryByRole('button', { name: /Activer la réception/ })).not.toBeInTheDocument();
  });
});
