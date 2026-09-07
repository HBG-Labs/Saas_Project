import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { DocumentFolder, OrganizationDocument } from '@/types/domain';

import { DocumentList } from './DocumentList';

beforeAll(() => {
  // Radix pilote son menu par les événements Pointer, que jsdom n'implémente
  // pas. Sans ces doublures, le menu ne s'ouvre jamais et le test mesurerait
  // jsdom plutôt que le composant.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

const DOSSIER: DocumentFolder = {
  id: 'dossier-1',
  organization_id: 'org-1',
  parent_folder_id: null,
  name: 'Procédures',
  created_by: 'u1',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
};

function document(patch: Partial<OrganizationDocument> = {}): OrganizationDocument {
  return {
    id: 'doc-1',
    organization_id: 'org-1',
    folder_id: 'dossier-1',
    uploaded_by: 'u1',
    name: 'Notice fibre',
    original_filename: 'notice.pdf',
    storage_path: 'org-1/uuid-notice.pdf',
    mime_type: 'application/pdf',
    file_size: 2048,
    description: null,
    category: null,
    created_at: '2026-09-02T08:30:00Z',
    updated_at: '2026-09-02T08:30:00Z',
    ...patch,
  };
}

function afficher(props: Partial<Parameters<typeof DocumentList>[0]> = {}) {
  const handlers = {
    onOpen: vi.fn(),
    onDownload: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  render(
    <DocumentList
      documents={[document()]}
      folders={[DOSSIER]}
      canManage
      canDelete
      {...handlers}
      {...props}
    />,
  );

  return handlers;
}

/** Le menu est rendu deux fois — carte mobile et ligne de tableau. */
async function ouvrirLeMenu(nomDuDocument: string) {
  const utilisateur = userEvent.setup();
  const declencheurs = screen.getAllByLabelText(`Actions pour ${nomDuDocument}`);
  await utilisateur.click(declencheurs[0]!);
  return within(await screen.findByRole('menu'));
}

describe('DocumentList', () => {
  it('rend la même liste en cartes et en tableau', () => {
    afficher();

    // Les deux mises en page coexistent dans le DOM ; c'est le CSS qui choisit.
    // Sur un chantier, une ligne de tableau à faire défiler d'une main est
    // inutilisable.
    expect(screen.getAllByText('Notice fibre')).toHaveLength(2);
    expect(screen.getAllByText(/2 Ko/)).toHaveLength(2);
  });

  it('rattache le document à son dossier par son nom', () => {
    afficher();
    expect(screen.getAllByText(/Procédures/).length).toBeGreaterThan(0);
  });

  it('ouvre le document quand on clique son nom', async () => {
    const utilisateur = userEvent.setup();
    const { onOpen } = afficher();

    await utilisateur.click(screen.getAllByText('Notice fibre')[0]!);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0]).toMatchObject({ id: 'doc-1' });
  });

  it('propose la modification et la suppression à qui en a le droit', async () => {
    afficher();
    const menu = await ouvrirLeMenu('Notice fibre');

    expect(menu.getByText('Ouvrir')).toBeInTheDocument();
    expect(menu.getByText('Télécharger')).toBeInTheDocument();
    expect(menu.getByText(/Renommer/)).toBeInTheDocument();
    expect(menu.getByText('Supprimer')).toBeInTheDocument();
  });

  it('retire la suppression sans le droit correspondant', async () => {
    afficher({ canDelete: false });
    const menu = await ouvrirLeMenu('Notice fibre');

    expect(menu.queryByText('Supprimer')).not.toBeInTheDocument();
    // Lire et télécharger restent ouverts : `document.view` suffit.
    expect(menu.getByText('Télécharger')).toBeInTheDocument();
  });

  it('retire la modification sans le droit correspondant', async () => {
    afficher({ canManage: false, canDelete: false });
    const menu = await ouvrirLeMenu('Notice fibre');

    expect(menu.queryByText(/Renommer/)).not.toBeInTheDocument();
  });

  it('affiche un tiret quand le document n’est rangé nulle part', () => {
    afficher({ documents: [document({ folder_id: null })] });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('affiche un tiret quand la taille est inconnue', () => {
    afficher({ documents: [document({ file_size: null })] });
    expect(screen.getAllByText(/—/).length).toBeGreaterThan(0);
  });

  it('choisit le libellé de type sur le MIME, pas sur l’extension', () => {
    // Un fichier nommé « .pdf » mais déposé en CSV reste un tableur.
    afficher({
      documents: [document({ name: 'Faux PDF', original_filename: 'x.pdf', mime_type: 'text/csv' })],
    });
    expect(screen.getByText('Tableur')).toBeInTheDocument();
  });
});
