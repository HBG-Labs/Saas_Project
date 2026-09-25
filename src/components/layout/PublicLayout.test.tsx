import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('relie la navigation de la landing à ses sections et conserve les routes du footer', () => {
    renderWithProviders(<PublicLayout />, { route: ROUTES.home });
    const navigation = within(screen.getByRole('navigation', { name: 'Navigation du site' }));
    expect(navigation.getByRole('link', { name: 'Le produit' })).toHaveAttribute(
      'href',
      '/#produit',
    );
    expect(navigation.getByRole('link', { name: 'Les univers' })).toHaveAttribute(
      'href',
      '/#univers',
    );
    expect(navigation.getByRole('link', { name: 'Tarifs' })).toHaveAttribute('href', '/#tarifs');
    const footer = within(screen.getByRole('contentinfo'));
    expect(footer.getByRole('link', { name: 'Tarifs' })).toHaveAttribute('href', ROUTES.pricing);
    expect(footer.getByRole('link', { name: 'Connexion' })).toHaveAttribute('href', ROUTES.login);
  });

  it('conserve les routes marketing sur les autres pages', () => {
    renderWithProviders(<PublicLayout />, { route: ROUTES.pricing });
    const navigation = within(screen.getByRole('navigation', { name: 'Navigation du site' }));
    expect(navigation.getByRole('link', { name: 'Fonctionnalités' })).toHaveAttribute(
      'href',
      ROUTES.features,
    );
    expect(navigation.getByRole('link', { name: 'Tarifs' })).toHaveAttribute(
      'href',
      ROUTES.pricing,
    );
  });

  it('garde le menu de la landing en clair et annonce son rôle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PublicLayout />, { route: ROUTES.home });
    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu de navigation' });
    expect(dialog).toHaveClass('theme-jour-verrouille');
    expect(dialog).toHaveAccessibleDescription(
      'Explorez REZO360, accédez à votre compte ou installez l’application.',
    );
    expect(within(dialog).getByRole('link', { name: 'Créer mon compte gratuit' })).toHaveAttribute(
      'href',
      ROUTES.register,
    );
    await user.click(within(dialog).getByRole('button', { name: 'Fermer le menu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
