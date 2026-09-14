import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';
import type { OrganizationDocument } from '@/types/domain';

import { DocumentShareDialog } from './DocumentShareDialog';

const mutations = vi.hoisted(() => ({
  setAll: vi.fn(),
  setCustomers: vi.fn(),
}));

vi.mock('@/features/customers', () => ({
  useCustomers: () => ({
    isPending: false,
    data: [
      { id: 'c1', name: 'TRICATEL', reference: 'CLI-0001', status: 'active' },
      { id: 'c2', name: 'Dupont SARL', reference: 'CLI-0002', status: 'active' },
      { id: 'c3', name: 'Ancien client', reference: 'CLI-0003', status: 'archived' },
    ],
  }),
}));

vi.mock('../hooks/useClientPortal', () => ({
  useShareDocument: () => ({ mutateAsync: mutations.setAll, isPending: false }),
  useSetDocumentCustomerShares: () => ({ mutateAsync: mutations.setCustomers, isPending: false }),
}));

const DOC: OrganizationDocument = {
  id: 'doc-1',
  organization_id: 'org-1',
  folder_id: null,
  uploaded_by: 'u1',
  name: 'Plan du site',
  original_filename: 'plan.pdf',
  storage_path: 'org-1/plan.pdf',
  mime_type: 'application/pdf',
  file_size: 2048,
  description: null,
  category: null,
  shared_with_client: false,
  created_at: '2026-09-02T08:30:00Z',
  updated_at: '2026-09-02T08:30:00Z',
};

describe('DocumentShareDialog — qui voit un document', () => {
  beforeEach(() => {
    mutations.setAll.mockReset().mockResolvedValue(undefined);
    mutations.setCustomers.mockReset().mockResolvedValue(undefined);
  });

  it('AC18 — partager avec UN client n’envoie que ce client, sans toucher au partage général', async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <DocumentShareDialog document={DOC} organizationId="org-1" sharedCustomerIds={[]} onOpenChange={onOpenChange} />,
    );

    // Les clients archivés n'apparaissent pas s'ils ne sont pas déjà partagés.
    expect(screen.queryByLabelText('Ancien client')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('TRICATEL'));
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(mutations.setCustomers).toHaveBeenCalledWith({ documentId: 'doc-1', organizationId: 'org-1', add: ['c1'], remove: [] });
    expect(mutations.setAll).not.toHaveBeenCalled();
  });

  it('retirer un client et passer en « tous » se traduit par les deux écritures, séparément', async () => {
    renderWithProviders(
      <DocumentShareDialog document={DOC} organizationId="org-1" sharedCustomerIds={['c2']} onOpenChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByLabelText('Dupont SARL'));
    fireEvent.click(screen.getByLabelText(/visible par tous les clients/i));
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => {
      expect(mutations.setAll).toHaveBeenCalledWith({ documentId: 'doc-1', shared: true });
    });
    expect(mutations.setCustomers).toHaveBeenCalledWith({ documentId: 'doc-1', organizationId: 'org-1', add: [], remove: ['c2'] });
  });

  it('sans changement, rien ne part', () => {
    renderWithProviders(
      <DocumentShareDialog document={DOC} organizationId="org-1" sharedCustomerIds={['c1']} onOpenChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
  });
});
