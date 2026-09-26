import { isValidElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppProviders } from './providers';
import { routes } from './router';
import { FEATURES } from '@/features/billing';
import { PERMISSIONS } from '@/features/organizations';
import { ROUTES } from '@/config/routes';

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

function routeTrail(path: string) {
  const visit = (children: typeof routes, trail: typeof routes): typeof routes | null => {
    for (const route of children) {
      const nextTrail = [...trail, route];
      if (route.path === path) return nextTrail;
      if (route.children) {
        const found = visit(route.children, nextTrail);
        if (found) return found;
      }
    }
    return null;
  };

  return visit(routes, []);
}

function elementProps(element: unknown): Record<string, unknown> {
  if (!isValidElement<Record<string, unknown>>(element)) return {};
  return element.props;
}

describe('routing', () => {
  it("affiche la page d'accueil publique sur /", async () => {
    renderAt('/');

    const heading = await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
    expect(heading).toHaveAccessibleName('Votre activité en mieux. Tout simplement.');
    // La landing utilise l'ossature publique, pas la navigation applicative.
    expect(screen.getByRole('navigation', { name: 'Navigation du site' })).toBeInTheDocument();
  });

  it('affiche le catalogue public sur /tools sans session', async () => {
    renderAt('/tools');

    // Expression régulière plutôt que chaîne exacte : le titre contient une
    // apostrophe typographique (« d’ingénierie ») qu'une comparaison stricte
    // rendrait fragile au moindre ajustement de copie.
    expect(
      await screen.findByRole(
        'heading',
        { name: /catalogue des outils/i, level: 1 },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
  });

  it('initialise le registre avant une route outil ouverte directement', async () => {
    renderAt('/tools/subnet-calculator');

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Calculateur IPv4 / CIDR', level: 1 },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
  });

  it('charge la palette et son catalogue seulement à la première ouverture', async () => {
    renderAt('/');
    await screen.findByRole(
      'heading',
      { name: 'Votre activité en mieux. Tout simplement.', level: 1 },
      { timeout: 5000 },
    );

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    await screen.findByPlaceholderText('Rechercher un outil, une page…', undefined, {
      timeout: 10_000,
    });
    expect(screen.getByText('Calculateur IPv4 / CIDR')).toBeInTheDocument();
  });

  it('affiche le centre de formation sans session', async () => {
    renderAt('/tutoriels');

    expect(
      await screen.findByRole(
        'heading',
        {
          name: /tutoriels & formation/i,
          level: 1,
        },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
  });

  it('ouvre directement le cours de facturation électronique', async () => {
    renderAt('/tutoriels/facturation-electronique');

    expect(
      await screen.findByRole(
        'heading',
        {
          name: /utiliser la facturation électronique/i,
          level: 1,
        },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/l’émission est une étape engageante/i)).toBeInTheDocument();
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
  it.each([
    '/favorites',
    '/history',
    '/profile',
    '/settings',
    '/assistant-ia',
    '/studio-social',
    // Prospect Radar (module interne) : `ProtectedRoute` doit déjà bloquer
    // avant même que `RequirePlatformAdmin` n'entre en jeu.
    '/admin/prospection',
  ])('protège la route privée %s', async (path) => {
    const router = renderAt(path);

    await waitFor(
      () => {
        expect(router.state.location.pathname).toBe('/login');
      },
      { timeout: 4000 },
    );
  });

  it('affiche la page 404 sur une URL inconnue', async () => {
    renderAt('/cette-page-nexiste-pas');

    expect(await screen.findByRole('heading', { name: /page introuvable/i })).toBeInTheDocument();
  });

  it('protège Social Studio par la formule et la permission social.view', () => {
    const trail = routeTrail(ROUTES.socialStudio);

    expect(trail, 'route Social Studio introuvable').not.toBeNull();
    expect(
      trail?.some((route) => elementProps(route.element).feature === FEATURES.socialStudio),
    ).toBe(true);
    expect(
      trail?.some((route) => elementProps(route.element).permission === PERMISSIONS.socialView),
    ).toBe(true);
  });

  it('affiche un message clair pour un outil non enregistré', async () => {
    renderAt('/tools/outil-qui-nexiste-pas');

    expect(await screen.findByRole('heading', { name: /outil introuvable/i })).toBeInTheDocument();
  });

  it('sert la galerie du système de design en développement', async () => {
    /*
      La route est conditionnée par `import.meta.env.DEV`, que Vitest met à
      `true`. Vérifier qu'elle rend bien la galerie, et pas la page 404,
      prouve deux choses d'un coup : la route est placée AVANT l'attrape-tout
      `*`, et la page monte réellement.

      Son absence en production est vérifiée autrement — en cherchant la page
      dans le paquet compilé, puisqu'ici la branche est toujours prise.
    */
    renderAt('/_design');

    expect(
      await screen.findByRole('heading', { name: /galerie du système de design/i, level: 1 }),
    ).toBeInTheDocument();

    // Les deux rendus de `DataView` sortent de la même liste. jsdom n'applique
    // pas les points de rupture : les deux sont donc montés.
    expect(screen.getAllByText('Nexans Câbles')).toHaveLength(2);
  });

  it('conserve la navigation principale sur toutes les pages', async () => {
    renderAt('/tools');

    expect(
      await screen.findByRole('navigation', { name: 'Navigation principale' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    // Lien d'évitement pour la navigation au clavier (§12).
    expect(screen.getByRole('link', { name: /aller au contenu principal/i })).toBeInTheDocument();
  });
});
