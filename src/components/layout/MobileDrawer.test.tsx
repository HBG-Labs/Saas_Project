import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MobileDrawer } from './MobileDrawer';

describe('MobileDrawer', () => {
  it('affiche le contenu quand isOpen est true', () => {
    render(
      <MobileDrawer isOpen={true} onClose={vi.fn()} title="Menu de navigation">
        <div>Contenu du drawer</div>
      </MobileDrawer>,
    );

    expect(screen.getByRole('dialog', { name: 'Menu de navigation' })).toBeInTheDocument();
    expect(screen.getByText('Contenu du drawer')).toBeInTheDocument();
  });

  it('ne rend rien quand isOpen est false', () => {
    render(
      <MobileDrawer isOpen={false} onClose={vi.fn()} title="Menu de navigation">
        <div>Contenu du drawer</div>
      </MobileDrawer>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('appelle onClose au clic sur le bouton de fermeture', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <MobileDrawer isOpen={true} onClose={handleClose} title="Menu de navigation">
        <div>Contenu</div>
      </MobileDrawer>,
    );

    const closeBtn = screen.getByRole('button', { name: 'Fermer le menu' });
    await user.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('appelle onClose lors de la touche Escape', () => {
    const handleClose = vi.fn();

    render(
      <MobileDrawer isOpen={true} onClose={handleClose} title="Menu de navigation">
        <div>Contenu</div>
      </MobileDrawer>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('gère le swipe tactile vers la gauche pour fermer', () => {
    vi.useFakeTimers();
    const handleClose = vi.fn();

    render(
      <MobileDrawer isOpen={true} onClose={handleClose} title="Menu de navigation">
        <div>Contenu</div>
      </MobileDrawer>,
    );

    const drawerPanel = screen.getByRole('dialog');

    // Start touch at x: 200, y: 100
    fireEvent.touchStart(drawerPanel, {
      touches: [{ clientX: 200, clientY: 100 }],
      changedTouches: [{ clientX: 200, clientY: 100 }],
    });

    // Swipe left to x: 50 (deltaX = -150)
    fireEvent.touchMove(drawerPanel, {
      touches: [{ clientX: 50, clientY: 100 }],
      changedTouches: [{ clientX: 50, clientY: 100 }],
    });

    // Release touch
    fireEvent.touchEnd(drawerPanel, {
      touches: [],
      changedTouches: [{ clientX: 50, clientY: 100 }],
    });

    // Fast-forward animation timer
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('rend le focus au bouton qui a ouvert le menu', async () => {
    const user = userEvent.setup();

    function DrawerHarness() {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Ouvrir le menu
          </button>
          <MobileDrawer isOpen={open} onClose={() => setOpen(false)}>
            <a href="#contenu">Premier lien</a>
          </MobileDrawer>
        </>
      );
    }

    render(<DrawerHarness />);
    const trigger = screen.getByRole('button', { name: 'Ouvrir le menu' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Menu de navigation' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fermer le menu' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
