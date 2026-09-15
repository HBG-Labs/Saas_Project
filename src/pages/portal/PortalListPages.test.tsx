import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PortalDocumentsPage from '@/pages/portal/PortalDocumentsPage';
import PortalInvoicesPage from '@/pages/portal/PortalInvoicesPage';
import PortalMissionsPage from '@/pages/portal/PortalMissionsPage';
import PortalQuotesPage from '@/pages/portal/PortalQuotesPage';
import { renderWithProviders } from '@/test/utils';
import type { PortalDocument, PortalInvoice, PortalMission, PortalQuote } from '@/types/database';

const state = vi.hoisted(
  (): {
    documents: PortalDocument[];
    invoices: PortalInvoice[];
    missions: PortalMission[];
    quotes: PortalQuote[];
  } => ({ documents: [], invoices: [], missions: [], quotes: [] }),
);

function query<T>(data: T[]) {
  return {
    data,
    error: null,
    isError: false,
    isPending: false,
    isSuccess: true,
    refetch: vi.fn(),
  };
}

vi.mock('@/features/portal', async (importActual) => {
  const actual = await importActual<typeof import('@/features/portal')>();
  return {
    ...actual,
    usePortalDocuments: () => query(state.documents),
    usePortalInvoices: () => query(state.invoices),
    usePortalMissions: () => query(state.missions),
    usePortalQuotes: () => query(state.quotes),
    usePortalFileUrl: () => ({ isPending: false, mutate: vi.fn() }),
  };
});

describe('Listes du portail client', () => {
  it('met en avant les documents disponibles et leur action principale', () => {
    state.documents = [
      {
        id: 'document-1',
        organization_id: 'organization-1',
        name: 'Procès-verbal de réception.pdf',
        category: 'Rapport',
        mime_type: 'application/pdf',
        file_size: 2048,
        storage_path: 'organization-1/document.pdf',
        created_at: '2026-09-10T10:00:00Z',
      },
    ];

    renderWithProviders(<PortalDocumentsPage />, { route: '/portail/documents' });

    expect(screen.getByText('1 document')).toBeInTheDocument();
    expect(screen.getByText('Procès-verbal de réception.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toBeInTheDocument();
  });

  it('rend le reste à régler immédiatement visible sur les factures', () => {
    state.invoices = [
      {
        id: 'invoice-1',
        organization_id: 'organization-1',
        reference: 'FAC-2026-001',
        document_type: 'invoice',
        title: 'Maintenance annuelle',
        status: 'sent',
        issued_at: '2026-09-01',
        due_date: '2026-09-30',
        subtotal_cents: 10_000,
        vat_cents: 2_000,
        total_cents: 12_000,
        pdf_path: 'organization-1/invoice.pdf',
      },
    ];

    renderWithProviders(<PortalInvoicesPage />, { route: '/portail/factures' });

    expect(screen.getByText('Reste à régler')).toBeInTheDocument();
    expect(screen.getAllByText('120,00 €')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Ouvrir le PDF' })).toBeInTheDocument();
  });

  it('sépare les informations de rendez-vous et de lieu des interventions', () => {
    state.missions = [
      {
        id: 'mission-1',
        organization_id: 'organization-1',
        reference: 'MIS-2026-001',
        title: 'Entretien de la pompe à chaleur',
        status: 'in_progress',
        priority: 'normal',
        scheduled_start: '2026-09-15T08:00:00Z',
        scheduled_end: null,
        actual_start: null,
        actual_end: null,
        location_label: null,
        address_line1: null,
        postal_code: null,
        city: 'Lyon',
        site_name: 'Agence centrale',
        has_approved_report: false,
        shared_attachments_count: 0,
      },
    ];

    renderWithProviders(<PortalMissionsPage />, { route: '/portail/interventions' });

    expect(screen.getByText('1 en cours')).toBeInTheDocument();
    expect(screen.getByText('Agence centrale · Lyon')).toBeInTheDocument();
    expect(screen.getByText('Entretien de la pompe à chaleur')).toBeInTheDocument();
  });

  it('signale clairement les devis qui attendent une réponse', () => {
    state.quotes = [
      {
        id: 'quote-1',
        organization_id: 'organization-1',
        reference: 'DEV-2026-001',
        title: 'Remplacement du tableau',
        status: 'sent',
        valid_until: '2026-10-01',
        created_at: '2026-09-01',
        subtotal_cents: 10_000,
        vat_cents: 2_000,
        total_cents: 12_000,
        pdf_path: null,
      },
    ];

    renderWithProviders(<PortalQuotesPage />, { route: '/portail/devis' });

    expect(screen.getByText('1 réponse attendue')).toBeInTheDocument();
    expect(screen.getByText('Consulter et répondre')).toBeInTheDocument();
    expect(screen.getByText('Remplacement du tableau')).toBeInTheDocument();
  });
});
