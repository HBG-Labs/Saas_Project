import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PortalMissionDetailPage from '@/pages/portal/PortalMissionDetailPage';
import { renderWithProviders } from '@/test/utils';
import type { PortalMissionDetail } from '@/types/database';

const state = vi.hoisted((): { mission: unknown } => ({ mission: null }));

vi.mock('@/features/portal', async (importActual) => {
  const reel = await importActual<typeof import('@/features/portal')>();
  return {
    ...reel,
    usePortalMission: () => ({ isPending: false, isError: false, data: state.mission }),
    usePortalFileUrl: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

const BASE: PortalMissionDetail = {
  id: 'm1',
  organization_id: 'org',
  reference: 'MIS-0001',
  title: 'Remplacement tableau',
  description: null,
  status: 'completed',
  priority: 'normal',
  scheduled_start: '2026-09-10T08:00:00Z',
  scheduled_end: null,
  actual_start: null,
  actual_end: null,
  location_label: null,
  address_line1: '1 rue du Bac',
  address_line2: null,
  postal_code: '75001',
  city: 'Paris',
  site_name: 'Siège',
  interventions: [],
  report: null,
  attachments: [],
};

describe('PortalMissionDetailPage — ce que le client voit', () => {
  it('AC07/AC08 — sans rapport approuvé, aucune section « Compte rendu » ; avec, ses seuls champs autorisés', () => {
    state.mission = BASE;
    const { unmount } = renderWithProviders(<PortalMissionDetailPage />, { route: '/portail/interventions/m1' });
    expect(screen.queryByText(/compte rendu/i)).not.toBeInTheDocument();
    expect(screen.getByText('Réalisée')).toBeInTheDocument();
    unmount();

    state.mission = {
      ...BASE,
      report: { work_description: 'Tableau remplacé', materials_used: null, submitted_at: '2026-09-10T12:00:00Z', customer_signature_name: 'J. Client' },
    };
    renderWithProviders(<PortalMissionDetailPage />, { route: '/portail/interventions/m1' });
    expect(screen.getByText(/compte rendu/i)).toBeInTheDocument();
    expect(screen.getByText('Tableau remplacé')).toBeInTheDocument();
    expect(screen.getByText(/signé par J\. Client/i)).toBeInTheDocument();
  });

  it('AC13 — seules les photos reçues (donc partagées) sont listées, avec un bouton d’ouverture', () => {
    state.mission = {
      ...BASE,
      attachments: [
        { id: 'a', kind: 'after', file_name: 'apres.jpg', mime_type: 'image/jpeg', size_bytes: 10, caption: 'Après travaux', storage_path: 'org/a.jpg', created_at: '2026-09-10T12:00:00Z' },
      ],
    };
    renderWithProviders(<PortalMissionDetailPage />, { route: '/portail/interventions/m1' });
    expect(screen.getByText('Après travaux')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /ouvrir/i })).toHaveLength(1);
  });

  it('AC06 — une intervention invisible (NULL) est « introuvable », sans distinguer inexistante et refusée', () => {
    state.mission = null;
    renderWithProviders(<PortalMissionDetailPage />, { route: '/portail/interventions/m1' });
    expect(screen.getByText(/intervention introuvable/i)).toBeInTheDocument();
  });
});
