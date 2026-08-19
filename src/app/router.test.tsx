import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppProviders } from './providers';
import { routes } from './router';

/**
 * Vérification du routing sur l'arbre de routes RÉEL.
 *
 * Un serveur de développement renvoie `index.html` avec un code 200 pour
 * n'importe quelle URL : cela ne prouve rien du routing côté client. Ce test
 * monte l'application complète — providers, session, chargement paresseux
 * compris — et observe le comportement effectif.
 *
 * Aucune session n'existe dans jsdom : l'utilisateur est donc non authentifié,
 * ce qui est exactement le cas à vérifier pour les routes privées.
 */
function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );

  return router;
}

describe('routing', () => {
  it("affiche la page d'accueil publique sur /", async () => {
    renderAt('/');

    expect(
      await screen.findByRole('heading', { name: /pilotez votre activité technique/i, level: 1 }),
    ).toBeInTheDocument();
    // La landing utilise l'ossature publique, pas la navigation applicative.
    expect(screen.getByRole('navigation', { name: 'Navigation du site' })).toBeInTheDocument();
  });

  it('affiche le catalogue public sur /tools sans session', async () => {
    renderAt('/tools');

    // Expression régulière plutôt que chaîne exacte : le titre contient une
    // apostrophe typographique (« d’ingénierie ») qu'une comparaison stricte
    // rendrait fragile au moindre ajustement de copie.
    expect(
      await screen.findByRole('heading', { name: /catalogue des outils/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('redirige une route privée vers /login quand la session est absente', async () => {
    const router = renderAt('/dashboard');

    await waitFor(
      () => {
        expect(router.state.location.pathname).toBe('/login');
      },
      { timeout: 4000 },
    );

    // L'origine est conservée pour permettre le retour après connexion.
    expect(router.state.location.state).toMatchObject({ from: '/dashboard' });
  });

  // `it.each` plutôt qu'une boucle dans un seul test : chaque cas bénéficie du
  // nettoyage automatique entre les tests. Une boucle empilerait quatre
  // applications dans le même document, source d'échecs intermittents.
  it.each(['/favorites', '/history', '/profile', '/settings', '/assistant-ia'])(
    'protège la route privée %s',
    async (path) => {
      const router = renderAt(path);

      await waitFor(
        () => {
          expect(router.state.location.pathname).toBe('/login');
        },
        { timeout: 4000 },
      );
    },
  );

  it('affiche la page 404 sur une URL inconnue', async () => {
    renderAt('/cette-page-nexiste-pas');

    expect(await screen.findByRole('heading', { name: /page introuvable/i })).toBeInTheDocument();
  });

  it('affiche un message clair pour un outil non enregistré', async () => {
    renderAt('/tools/outil-qui-nexiste-pas');

    expect(await screen.findByRole('heading', { name: /outil introuvable/i })).toBeInTheDocument();
  });

  it('conserve la navigation principale sur toutes les pages', async () => {
    renderAt('/tools');

    expect(
      await screen.findByRole('navigation', { name: 'Navigation principale' }),
    ).toBeInTheDocument();
    // Lien d'évitement pour la navigation au clavier (§12).
    expect(screen.getByRole('link', { name: /aller au contenu principal/i })).toBeInTheDocument();
  });
});
