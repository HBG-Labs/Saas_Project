import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InstagramIntegrationCard } from './InstagramIntegrationCard';

const { useInstagramAccount, useInstagramReadiness } = vi.hoisted(() => ({
  useInstagramAccount: vi.fn(),
  useInstagramReadiness: vi.fn(),
}));

vi.mock('../hooks/useInstagramIntegration', () => ({
  useInstagramAccount,
  useInstagramReadiness,
  useStartInstagramConnection: () => ({ isPending: false, error: null, mutate: vi.fn() }),
  useSyncInstagramConnection: () => ({ isPending: false, error: null, mutate: vi.fn() }),
  useDisconnectInstagram: () => ({ isPending: false, error: null, mutate: vi.fn() }),
}));

function renderCard(canManage = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <InstagramIntegrationCard organizationId="org-1" canManage={canManage} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useInstagramReadiness.mockReturnValue({
    data: { configured: true },
    error: null,
    isPending: false,
  });
});

describe('InstagramIntegrationCard', () => {
  it('affiche le compte connecté sans information sensible', () => {
    useInstagramAccount.mockReturnValue({
      data: {
        status: 'connected',
        username: 'rezo.360',
        account_type: 'BUSINESS',
        profile_picture_url: null,
        last_synced_at: '2026-09-26T12:00:00.000Z',
        granted_permissions: ['instagram_business_basic'],
      },
      error: null,
    });

    renderCard();

    expect(screen.getByText('@rezo.360')).toBeInTheDocument();
    expect(screen.getByText('Compte BUSINESS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Synchroniser' })).toBeInTheDocument();
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
  });

  it('masque les actions de gestion en lecture seule', () => {
    useInstagramAccount.mockReturnValue({ data: null, error: null });

    renderCard(false);

    expect(screen.queryByRole('button', { name: 'Connecter Instagram' })).not.toBeInTheDocument();
    expect(screen.getByText(/propriétaire ou administrateur/)).toBeInTheDocument();
  });
});
