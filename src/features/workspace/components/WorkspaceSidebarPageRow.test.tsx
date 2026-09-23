import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { WorkspacePage } from '../api/workspace.api';
import { WorkspaceSidebarPageRow } from './WorkspaceSidebarPageRow';

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

const page = {
  id: 'page-1',
  title: 'Réunion du lundi',
  icon: '📝',
} as WorkspacePage;

function renderRow({ canEdit = true, isFavorite = false } = {}) {
  const handlers = {
    onSelect: vi.fn(),
    onToggleFavorite: vi.fn(),
    onCopyLink: vi.fn(),
    onArchive: vi.fn(),
  };

  render(
    <MemoryRouter>
      <ul>
        <WorkspaceSidebarPageRow
          page={page}
          to="/workspace/pages/page-1"
          canEdit={canEdit}
          isFavorite={isFavorite}
          {...handlers}
        />
      </ul>
    </MemoryRouter>,
  );

  return handlers;
}

async function openQuickActions() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Actions rapides pour Réunion du lundi' }));
  return { user, menu: within(await screen.findByRole('menu')) };
}

describe('WorkspaceSidebarPageRow', () => {
  it('affiche le bouton à trois points et les actions rapides', async () => {
    renderRow();
    const { menu } = await openQuickActions();

    expect(menu.getByText('Ajouter aux favoris')).toBeInTheDocument();
    expect(menu.getByText('Copier le lien')).toBeInTheDocument();
    expect(menu.getByText('Ouvrir dans un nouvel onglet')).toBeInTheDocument();
    expect(menu.getByText('Déplacer dans la corbeille')).toBeInTheDocument();
  });

  it('déclenche la mise en corbeille depuis le menu', async () => {
    const { onArchive } = renderRow();
    const { user, menu } = await openQuickActions();

    await user.click(menu.getByText('Déplacer dans la corbeille'));

    expect(onArchive).toHaveBeenCalledWith(page);
  });

  it('masque la mise en corbeille sans droit de modification', async () => {
    renderRow({ canEdit: false });
    const { menu } = await openQuickActions();

    expect(menu.queryByText('Déplacer dans la corbeille')).not.toBeInTheDocument();
  });
});
