import { render, screen } from '@testing-library/react';
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
