import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/config/routes';
import { renderWithProviders } from '@/test/utils';

import { PublicLayout } from './PublicLayout';

vi.mock('@/features/auth', () => ({ useAuth: () => ({ status: 'unauthenticated' }) }));

// La bascule réelle exige le `ThemeProvider` ; ce qui est vérifié ici est sa
// PRÉSENCE, pas son fonctionnement — couvert par `ThemeCustomizer.test.tsx`.
vi.mock('@/features/theme', () => ({
  ThemeToggle: () => (
    <button type="button" aria-label="Changer de thème">
      Thème
    </button>
  ),
}));

/**
 * L'accueil est une vitrine : il se présente de la même façon à tout le monde.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CES CAS EMPÊCHENT DE REVENIR
 *
 * Une version antérieure verrouillait l'accueil en SOMBRE et masquait la
 * bascule pour que le verrou ne se voie pas — l'en-tête de `PublicLayout` en
 * garde la trace. Le verrou d'aujourd'hui est l'inverse et il est assumé : il
 * porte sur le clair, et la bascule reste visible sur toutes les autres pages
 * publiques.
 *
 * Sans ces cas, retirer `theme-jour-verrouille` en laissant la bascule cachée
 * ramènerait le pire des deux mondes : un accueil qui suit le thème, et aucun
 * moyen d'en changer depuis cette page.
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('PublicLayout', () => {
  it.each([
    ['l’accueil', ROUTES.home],
    ['la connexion', ROUTES.login],
    ['l’inscription', ROUTES.register],
    ['le mot de passe oublié', ROUTES.forgotPassword],
  ])('verrouille %s en clair et y masque la bascule', (_nom, route) => {
    const { container } = renderWithProviders(<PublicLayout />, { route });

    expect(container.querySelector('.theme-jour-verrouille')).not.toBeNull();
    expect(screen.queryByLabelText('Changer de thème')).not.toBeInTheDocument();
  });

  it('laisse les autres pages publiques suivre le thème, bascule comprise', () => {
    const { container } = renderWithProviders(<PublicLayout />, { route: ROUTES.pricing });

    expect(container.querySelector('.theme-jour-verrouille')).toBeNull();
    expect(screen.getByLabelText('Changer de thème')).toBeInTheDocument();
  });

  it('garde la navigation marketing sur les deux', () => {
    renderWithProviders(<PublicLayout />, { route: ROUTES.home });
    expect(screen.getAllByText('Tarifs').length).toBeGreaterThan(0);
  });
});
