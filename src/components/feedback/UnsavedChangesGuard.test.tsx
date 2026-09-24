import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { UnsavedChangesGuard } from './UnsavedChangesGuard';

function renderGuard() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <UnsavedChangesGuard when />
            <h1>Brouillon</h1>
            <Link to="/destination">Changer de page</Link>
          </>
        ),
      },
      { path: '/destination', element: <h1>Destination</h1> },
    ],
    { initialEntries: ['/'] },
  );

  render(<RouterProvider router={router} />);
  return router;
}

describe('UnsavedChangesGuard', () => {
  it('laisse choisir entre conserver la saisie et quitter', async () => {
    const router = renderGuard();

    fireEvent.click(screen.getByRole('link', { name: 'Changer de page' }));
    expect(await screen.findByRole('dialog', { name: 'Quitter sans enregistrer ?' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/');

    fireEvent.click(screen.getByRole('button', { name: 'Continuer à modifier' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');

    fireEvent.click(screen.getByRole('link', { name: 'Changer de page' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quitter sans enregistrer' }));

    expect(await screen.findByRole('heading', { name: 'Destination' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/destination');
  });

  it('protège aussi la fermeture de l’onglet', () => {
    renderGuard();

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
