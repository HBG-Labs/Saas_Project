import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ErrorFallback } from './ErrorFallback';

function afficher(error: Error) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: <ErrorFallback error={error} />,
    },
  ]);

  return render(<RouterProvider router={router} />);
}

describe('ErrorFallback', () => {
  it('traduit une erreur de module en consigne rassurante', () => {
    afficher(
      new TypeError(
        'Failed to fetch dynamically imported module: https://example.com/assets/Page-old.js',
      ),
    );

    expect(screen.getByRole('heading', { name: 'Actualisation nécessaire' })).toBeInTheDocument();
    expect(screen.getByText(/Vos données sont conservées/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualiser REZO360' })).toBeInTheDocument();
    expect(screen.queryByText(/Page-old\.js/)).not.toBeInTheDocument();
  });

  it('ne montre jamais directement le message brut d’une erreur inconnue', () => {
    afficher(new Error('nom_table_interne: contrainte secrète'));

    expect(screen.getByText("Une erreur inattendue s'est produite.")).toBeInTheDocument();
    expect(screen.queryByText(/nom_table_interne/)).not.toBeInTheDocument();
  });
});
