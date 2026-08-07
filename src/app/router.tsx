import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';

import { ErrorFallback } from '@/components/feedback/ErrorFallback';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { AppLayout } from '@/components/layout/AppLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { RootLayout } from '@/components/layout/RootLayout';
import { ROUTE_PATTERNS, ROUTES } from '@/config/routes';
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth';

/**
 * Adapte un `import()` de page au format attendu par `lazy` de React Router.
 * Chaque page devient son propre chunk : le navigateur ne télécharge que le
 * code de la route visitée.
 */
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  return async () => ({ Component: (await load()).default });
}

/**
 * Arbre de routes, exporté séparément du routeur pour que les tests puissent
 * reconstruire un routeur mémoire à partir des MÊMES définitions.
 *
 * Trois niveaux :
 *   • `RootLayout` — sans interface propre, héberge ce qui doit être disponible
 *     partout (palette de commandes). Placé DANS le routeur car `CommandBar`
 *     dépend de `useNavigate`.
 *   • `PublicLayout` — landing et authentification : en-tête marketing, pied de
 *     page, corps de texte à 16 px.
 *   • `AppLayout` — application connectée : barre latérale, navigation basse
 *     mobile, densité à 14 px.
 *
 * Séparer les deux ossatures évite le composant unique truffé de conditions qui
 * finit par charger le code du tableau de bord sur la page d'accueil.
 */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <ErrorFallback error={null} />,
    // Requis dès qu'une route descendante est paresseuse : sans lui, React
    // Router n'a rien à afficher pendant la résolution initiale du module.
    hydrateFallbackElement: <LoadingScreen />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, lazy: lazyPage(() => import('@/pages/LandingPage')) },
          { path: ROUTES.features, lazy: lazyPage(() => import('@/pages/FeaturesPage')) },
          { path: ROUTES.pricing, lazy: lazyPage(() => import('@/pages/PricingPage')) },
          { path: ROUTES.faq, lazy: lazyPage(() => import('@/pages/FaqPage')) },

          {
            element: <PublicOnlyRoute />,
            children: [
              { path: ROUTES.login, lazy: lazyPage(() => import('@/pages/LoginPage')) },
              { path: ROUTES.register, lazy: lazyPage(() => import('@/pages/RegisterPage')) },
              {
                path: ROUTES.forgotPassword,
                lazy: lazyPage(() => import('@/pages/ForgotPasswordPage')),
              },
            ],
          },

          // Accessible connecté ou non : le lien e-mail peut être ouvert dans un
          // navigateur sans session.
          { path: ROUTES.authCallback, lazy: lazyPage(() => import('@/pages/AuthCallbackPage')) },
        ],
      },

      {
        element: <AppLayout />,
        children: [
          // Catalogue public : consultable sans compte, mais dans l'ossature
          // applicative — un visiteur qui explore les outils est déjà dans le
          // produit, pas dans la vitrine.
          { path: ROUTES.tools, lazy: lazyPage(() => import('@/pages/ToolsPage')) },
          { path: ROUTE_PATTERNS.tool, lazy: lazyPage(() => import('@/pages/ToolDetailPage')) },
          { path: ROUTE_PATTERNS.category, lazy: lazyPage(() => import('@/pages/CategoryPage')) },
          { path: ROUTES.references, lazy: lazyPage(() => import('@/pages/ReferencesPage')) },

          {
            element: <ProtectedRoute />,
            children: [
              { path: ROUTES.dashboard, lazy: lazyPage(() => import('@/pages/DashboardPage')) },
              { path: ROUTES.favorites, lazy: lazyPage(() => import('@/pages/FavoritesPage')) },
              { path: ROUTES.history, lazy: lazyPage(() => import('@/pages/HistoryPage')) },
              { path: ROUTES.profile, lazy: lazyPage(() => import('@/pages/ProfilePage')) },
              { path: ROUTES.settings, lazy: lazyPage(() => import('@/pages/SettingsPage')) },
            ],
          },

          { path: '*', lazy: lazyPage(() => import('@/pages/NotFoundPage')) },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
