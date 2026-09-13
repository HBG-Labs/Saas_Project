import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as OrganizationsModule from '@/features/organizations';

import { AttachmentGallery } from './AttachmentGallery';

/**
 * Le bug corrigé ici : un compte Starter ou Pro voyait les cinq boutons
 * d'ajout, cliquait, et recevait un rejet RLS brut habillé en « Une erreur
 * inattendue s'est produite » — la policy `intervention_attachments_upload`
 * exige `app.org_has_feature(org_id, 'attachments')`, réservé à Business et
 * Enterprise, et rien côté interface n'en informait avant le clic.
 *
 * Ces tests protègent la distinction centrale du correctif : la formule et le
 * statut de l'intervention sont deux raisons DIFFÉRENTES de bloquer l'ajout,
 * et une seule des deux justifie une incitation à mettre à niveau.
 */

const permission = vi.hoisted(() => ({ peutFacturer: true }));
const partage = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@/features/client-portal', () => ({
  useShareAttachments: () => ({ mutate: partage.mutate, isPending: false }),
}));

vi.mock('../hooks/useReports', () => ({
  useUploadAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAttachment: () => ({ mutate: vi.fn() }),
  useAttachmentUrl: () => ({ isPending: false, isError: false, data: null }),
}));

vi.mock('@/features/organizations', async (importActual) => {
  const reel = await importActual<typeof OrganizationsModule>();
  return {
    ...reel,
    usePermission: () => ({ can: () => permission.peutFacturer, canAny: () => false, role: 'owner' }),
  };
});

const PROPS_BASE = {
  interventionId: 'int-1',
  organizationId: 'org-1',
  missionId: 'mission-1',
  uploadedBy: 'user-1',
  attachments: [],
};

function afficher(hasAttachmentsFeature: boolean, canEdit: boolean) {
  return render(
    <MemoryRouter>
      <AttachmentGallery {...PROPS_BASE} canEdit={canEdit} hasAttachmentsFeature={hasAttachmentsFeature} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  permission.peutFacturer = true;
  partage.mutate.mockReset();
});

const PHOTO = {
  intervention_id: 'int-1',
  organization_id: 'org-1',
  kind: 'after' as const,
  mime_type: 'image/jpeg',
  size_bytes: 1000,
  caption: null,
  uploaded_by: 'user-1',
  shared_at: null,
  shared_by: null,
  created_at: '2026-09-01T10:00:00Z',
};

describe('AttachmentGallery — partage avec le client', () => {
  const photos = [
    { ...PHOTO, id: 'a', storage_path: 'org-1/a.jpg', file_name: 'a.jpg', shared_with_client: false },
    { ...PHOTO, id: 'b', storage_path: 'org-1/b.jpg', file_name: 'b.jpg', shared_with_client: false },
    { ...PHOTO, id: 'c', storage_path: 'org-1/c.jpg', file_name: 'c.jpg', shared_with_client: true },
  ];

  function afficherPartage(canShareWithClient: boolean) {
    return render(
      <MemoryRouter>
        <AttachmentGallery
          {...PROPS_BASE}
          attachments={photos}
          canEdit={false}
          hasAttachmentsFeature
          canShareWithClient={canShareWithClient}
        />
      </MemoryRouter>,
    );
  }

  it('AC14/AC15 — sans le droit de partager, aucune commande de partage ; l’état visible est quand même dit', () => {
    afficherPartage(false);

    expect(screen.queryByRole('button', { name: /choisir les photos à partager/i })).not.toBeInTheDocument();
    // La photo déjà partagée porte son badge : deux états, jamais d'ambiguïté.
    expect(screen.getAllByText('Client')).toHaveLength(1);
  });

  it('AC16 — plusieurs photos sélectionnées sont partagées en UNE opération', () => {
    afficherPartage(true);

    expect(screen.getByText(/1 sur 3 visible par le client/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /choisir les photos à partager/i }));
    const cases = screen.getAllByRole('button', { name: /ajouter à la sélection/i });
    fireEvent.click(cases[0]!);
    fireEvent.click(cases[1]!);
    fireEvent.click(screen.getByRole('button', { name: /rendre visible \(2\)/i }));

    expect(partage.mutate).toHaveBeenCalledTimes(1);
    expect(partage.mutate.mock.calls[0]?.[0]).toEqual({ ids: ['a', 'b'], shared: true });
  });

  it('AC17 — une photo partagée peut être rendue privée à nouveau', () => {
    afficherPartage(true);

    fireEvent.click(screen.getByRole('button', { name: /choisir les photos à partager/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /ajouter à la sélection/i })[2]!);
    fireEvent.click(screen.getByRole('button', { name: /rendre privé \(1\)/i }));

    expect(partage.mutate.mock.calls[0]?.[0]).toEqual({ ids: ['c'], shared: false });
  });
});

describe('AttachmentGallery — formule Business/Enterprise requise', () => {
  it('masque les boutons d’ajout et affiche une incitation quand la formule ne les inclut pas', () => {
    afficher(false, true);

    expect(screen.queryByRole('button', { name: /« Avant »/ })).not.toBeInTheDocument();
    expect(screen.getByText(/nécessite la formule/i)).toBeInTheDocument();
  });

  it('affiche les cinq boutons d’ajout quand la formule les inclut', () => {
    afficher(true, true);

    expect(screen.getByRole('button', { name: /« Avant »/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Doc \/ Plan/ })).toBeInTheDocument();
    expect(screen.queryByText(/nécessite la formule/i)).not.toBeInTheDocument();
  });

  it('ne montre pas l’incitation sur une intervention déjà verrouillée, même sans la formule', () => {
    // Une intervention terminée n'accepte plus aucune modification — lui
    // vanter une mise à niveau qui ne changerait rien serait trompeur.
    afficher(false, false);

    expect(screen.queryByText(/nécessite la formule/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /« Avant »/ })).not.toBeInTheDocument();
  });

  it('propose la facturation à qui peut la gérer, et les offres publiques sinon', () => {
    permission.peutFacturer = false;
    afficher(false, true);

    expect(screen.getByRole('link', { name: /découvrir les offres/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /mettre à niveau/i })).not.toBeInTheDocument();
  });
});
