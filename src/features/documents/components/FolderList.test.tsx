import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { DocumentFolder } from '@/types/domain';

import { FolderBreadcrumb, FolderGrid } from './FolderList';

beforeAll(() => {
  // Radix pilote son menu par les événements Pointer, que jsdom n'implémente pas.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

function dossier(id: string, name: string, parent: string | null = null): DocumentFolder {
  return {
    id,
    organization_id: 'org-1',
    parent_folder_id: parent,
    name,
    created_by: 'u1',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  };
}

//   Clients ─ Orange ─ Plans
//   Fibre
const ARBRE: DocumentFolder[] = [
  dossier('clients', 'Clients'),
  dossier('orange', 'Orange', 'clients'),
  dossier('plans', 'Plans', 'orange'),
  dossier('fibre', 'Fibre'),
];

const REMONTER = 'Remonter d’un dossier';

describe('FolderBreadcrumb', () => {
  it('ne propose rien à remonter depuis la racine', () => {
    render(<FolderBreadcrumb folders={ARBRE} currentFolderId={null} onNavigate={vi.fn()} />);

    expect(screen.queryByLabelText(REMONTER)).not.toBeInTheDocument();
    // « Bibliothèque » est alors la page courante : un bouton qui ne mène nulle
    // part apprendrait à se méfier des autres.
    expect(screen.queryByRole('button', { name: 'Bibliothèque' })).not.toBeInTheDocument();
    expect(screen.getByText('Bibliothèque')).toHaveAttribute('aria-current', 'page');
  });

  it('remonte à la racine depuis un dossier de premier niveau', async () => {
    const utilisateur = userEvent.setup();
    const onNavigate = vi.fn();
    render(<FolderBreadcrumb folders={ARBRE} currentFolderId="fibre" onNavigate={onNavigate} />);

    await utilisateur.click(screen.getByLabelText(REMONTER));

    expect(onNavigate).toHaveBeenCalledWith(null);
  });

  it('remonte au parent, pas à la racine, depuis un dossier profond', async () => {
    const utilisateur = userEvent.setup();
    const onNavigate = vi.fn();
    render(<FolderBreadcrumb folders={ARBRE} currentFolderId="plans" onNavigate={onNavigate} />);

    await utilisateur.click(screen.getByLabelText(REMONTER));

    expect(onNavigate).toHaveBeenCalledWith('orange');
  });

  it('rend chaque ancêtre cliquable', async () => {
    const utilisateur = userEvent.setup();
    const onNavigate = vi.fn();
    render(<FolderBreadcrumb folders={ARBRE} currentFolderId="plans" onNavigate={onNavigate} />);

    await utilisateur.click(screen.getByRole('button', { name: 'Bibliothèque' }));
    expect(onNavigate).toHaveBeenCalledWith(null);

    await utilisateur.click(screen.getByRole('button', { name: 'Clients' }));
    expect(onNavigate).toHaveBeenCalledWith('clients');
  });

  it('n’offre pas de lien vers le dossier où l’on se trouve déjà', () => {
    render(<FolderBreadcrumb folders={ARBRE} currentFolderId="plans" onNavigate={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Plans' })).not.toBeInTheDocument();
    expect(screen.getByText('Plans')).toHaveAttribute('aria-current', 'page');
  });
});

function grille(props: Partial<Parameters<typeof FolderGrid>[0]> = {}) {
  const handlers = {
    onOpen: vi.fn(),
    onRename: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
  };

  render(
    <FolderGrid
      folders={ARBRE}
      currentFolderId={null}
      canManage
      canDelete
      {...handlers}
      {...props}
    />,
  );

  return handlers;
}

describe('FolderGrid', () => {
  it('n’affiche que les enfants directs du dossier courant', () => {
    grille();

    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Fibre')).toBeInTheDocument();
    expect(screen.queryByText('Orange')).not.toBeInTheDocument();
  });

  it('annonce les sous-dossiers d’un dossier', () => {
    grille();
    expect(screen.getByText('1 sous-dossier')).toBeInTheDocument();
  });

  it('disparaît quand le dossier n’a pas d’enfant', () => {
    const { container } = render(
      <FolderGrid
        folders={ARBRE}
        currentFolderId="plans"
        canManage
        canDelete
        onOpen={vi.fn()}
        onRename={vi.fn()}
        onMove={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('ouvre le dossier au clic sur son nom', async () => {
    const utilisateur = userEvent.setup();
    const { onOpen } = grille();

    await utilisateur.click(screen.getByText('Clients'));

    expect(onOpen).toHaveBeenCalledWith('clients');
  });

  it('réserve renommer, déplacer et supprimer aux droits correspondants', async () => {
    const utilisateur = userEvent.setup();
    grille();

    await utilisateur.click(screen.getByLabelText('Actions pour le dossier Clients'));
    const menu = within(await screen.findByRole('menu'));

    expect(menu.getByText('Renommer')).toBeInTheDocument();
    expect(menu.getByText('Déplacer')).toBeInTheDocument();
    expect(menu.getByText('Supprimer')).toBeInTheDocument();
  });

  it('ne montre aucun menu à qui ne peut ni gérer ni supprimer', () => {
    grille({ canManage: false, canDelete: false });

    expect(screen.queryByLabelText('Actions pour le dossier Clients')).not.toBeInTheDocument();
  });
});
