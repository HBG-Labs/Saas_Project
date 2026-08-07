import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/utils';

import NotFoundPage from './NotFoundPage';

/**
 * Test d'intégration d'amorçage : vérifie que Testing Library, le routeur et
 * les providers sont correctement câblés ensemble.
 */
describe('NotFoundPage', () => {
  it('affiche un titre accessible et un retour vers l’accueil', () => {
    renderWithProviders(<NotFoundPage />, { route: '/route-inexistante' });

    expect(screen.getByRole('heading', { name: /page introuvable/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /retour à l'accueil/i })).toHaveAttribute('href', '/');
  });
});
