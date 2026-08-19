import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AiSearchHistoryDrawer } from './AiSearchHistoryDrawer';

describe('AiSearchHistoryDrawer', () => {
  const mockHistory = [
    {
      id: 'h1',
      query: 'Vérifier les interventions en retard',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'h2',
      query: 'État du stock de câbles fibre',
      timestamp: new Date().toISOString(),
    },
  ];

  it('ne rend rien quand isOpen est false', () => {
    const { container } = render(
      <AiSearchHistoryDrawer
        isOpen={false}
        onClose={vi.fn()}
        history={mockHistory}
        onSelectSearch={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('affiche la liste des recherches quand isOpen est true', () => {
    render(
      <AiSearchHistoryDrawer
        isOpen={true}
        onClose={vi.fn()}
        history={mockHistory}
        onSelectSearch={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    expect(screen.getByText('Historique des recherches')).toBeInTheDocument();
    expect(screen.getByText('Vérifier les interventions en retard')).toBeInTheDocument();
    expect(screen.getByText('État du stock de câbles fibre')).toBeInTheDocument();
  });

  it('appelle onSelectSearch et onClose au clic sur une recherche', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <AiSearchHistoryDrawer
        isOpen={true}
        onClose={handleClose}
        history={mockHistory}
        onSelectSearch={handleSelect}
        onRemoveItem={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );

    await user.click(screen.getByText('Vérifier les interventions en retard'));

    expect(handleSelect).toHaveBeenCalledWith('Vérifier les interventions en retard');
    expect(handleClose).toHaveBeenCalled();
  });

  it('appelle onRemoveItem au clic sur le bouton de suppression individuelle', async () => {
    const user = userEvent.setup();
    const handleRemove = vi.fn();

    render(
      <AiSearchHistoryDrawer
        isOpen={true}
        onClose={vi.fn()}
        history={mockHistory}
        onSelectSearch={vi.fn()}
        onRemoveItem={handleRemove}
        onClearAll={vi.fn()}
      />,
    );

    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer cette recherche' });
    expect(deleteButtons).toHaveLength(2);

    await user.click(deleteButtons[0]!);
    expect(handleRemove).toHaveBeenCalledWith('h1');
  });

  it('demande confirmation avant d’appeler onClearAll', async () => {
    const user = userEvent.setup();
    const handleClearAll = vi.fn();

    render(
      <AiSearchHistoryDrawer
        isOpen={true}
        onClose={vi.fn()}
        history={mockHistory}
        onSelectSearch={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearAll={handleClearAll}
      />,
    );

    const clearButton = screen.getByRole('button', { name: /Effacer tout l’historique/ });
    await user.click(clearButton);

    // Un bouton de confirmation doit apparaître
    const confirmButton = screen.getByRole('button', { name: /Confirmer la suppression/ });
    expect(confirmButton).toBeInTheDocument();
    expect(handleClearAll).not.toHaveBeenCalled();

    await user.click(confirmButton);
    expect(handleClearAll).toHaveBeenCalled();
  });
});
