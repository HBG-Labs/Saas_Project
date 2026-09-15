import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PortalQuoteDetailPage from '@/pages/portal/PortalQuoteDetailPage';
import { renderWithProviders } from '@/test/utils';
import type { PortalQuoteDetail } from '@/types/database';

const state = vi.hoisted(() => ({
  quote: null as PortalQuoteDetail | null,
  respond: vi.fn(),
  openFile: vi.fn(),
}));

vi.mock('@/features/portal', async (importActual) => {
  const actual = await importActual<typeof import('@/features/portal')>();
  return {
    ...actual,
    usePortalQuote: () => ({
      data: state.quote,
      error: null,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    }),
    useRespondPortalQuote: () => ({ isPending: false, mutate: state.respond }),
    usePortalFileUrl: () => ({ isPending: false, mutate: state.openFile }),
  };
});

const QUOTE: PortalQuoteDetail = {
  id: 'quote-1',
  organization_id: 'organization-1',
  reference: 'DEV-2026-001',
  title: 'Remplacement du tableau',
  status: 'sent',
  notes: 'Intervention à programmer avec le client.',
  valid_until: '2026-10-01',
  vat_rate: 20,
  created_at: '2026-09-01',
  client_responded_at: null,
  site_name: 'Agence centrale',
  subtotal_cents: 10_000,
  vat_cents: 2_000,
  total_cents: 12_000,
  pdf_path: null,
  items: [
    {
      id: 'item-1',
      description: 'Tableau électrique',
      unit: 'u',
      quantity: 1,
      unit_price_cents: 10_000,
      line_total_cents: 10_000,
    },
  ],
};

describe('PortalQuoteDetailPage', () => {
  it('hiérarchise le statut, le montant et les prestations du devis', () => {
    state.quote = QUOTE;

    renderWithProviders(<PortalQuoteDetailPage />, { route: '/portail/devis/quote-1' });

    expect(screen.getByRole('heading', { name: 'Remplacement du tableau' })).toBeInTheDocument();
    expect(screen.getByText('En attente de votre réponse')).toBeInTheDocument();
    expect(screen.getAllByText('120,00 €')).toHaveLength(2);
    expect(screen.getAllByText('Tableau électrique')).not.toHaveLength(0);
    expect(screen.getByText(/agence centrale/i)).toBeInTheDocument();
  });

  it('affiche le téléchargement du PDF seulement quand il existe', () => {
    state.quote = { ...QUOTE, pdf_path: null };
    const { unmount } = renderWithProviders(<PortalQuoteDetailPage />, {
      route: '/portail/devis/quote-1',
    });
    expect(screen.queryByRole('button', { name: /télécharger le pdf/i })).not.toBeInTheDocument();
    unmount();

    state.quote = { ...QUOTE, pdf_path: `${QUOTE.organization_id}/quote-1/devis.pdf` };
    renderWithProviders(<PortalQuoteDetailPage />, { route: '/portail/devis/quote-1' });
    expect(screen.getByRole('button', { name: /télécharger le pdf/i })).toBeInTheDocument();
  });

  it('demande confirmation avant de transmettre une acceptation', async () => {
    state.quote = QUOTE;
    state.respond.mockReset();
    const user = userEvent.setup();

    renderWithProviders(<PortalQuoteDetailPage />, { route: '/portail/devis/quote-1' });

    await user.click(screen.getByRole('button', { name: 'Accepter le devis' }));
    expect(screen.getByRole('heading', { name: 'Accepter ce devis ?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmer l’acceptation' }));
    expect(state.respond).toHaveBeenCalledWith(
      { quoteId: 'quote-1', decision: 'accepted' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });
});
