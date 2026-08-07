import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';

import { ErrorFallback } from '@/components/feedback/ErrorFallback';
import { AppShell } from '@/components/layout/AppShell';
import { ROUTE_PATTERNS, ROUTES } from '@/config/routes';
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth';

/**
 * Adapte un `import()` de page au format attendu par `lazy` de React Router.
 *
 * Chaque page devient ainsi son propre chunk : le navigateur ne télécharge que
 * le code de la route visitée (§13). Le helper évite de répéter quinze fois la
 * même conversion.
 */
function lazyPage(load: () => Promise<{ default: ComponentType }>) {
  return async () => ({ Component: (await load()).default });
}

/**
 * Arbre de routes, exporté séparément du routeur.
 *
 * Permet aux tests de reconstruire un routeur mémoire à partir des MÊMES
 * définitions que la production : ce qui est vérifié est bien ce qui est livré.
 */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    // Filet de sécurité au niveau du routeur : une erreur non capturée plus bas
    // affiche cet écran au lieu d'une page blanche.
    errorElement: <ErrorFallback error={null} />,
    children: [
      { index: true, lazy: lazyPage(() => import('@/pages/HomePage')) },

      // -------------------------------------------------- visiteurs non connectés
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

      // Accessible dans les deux états : le lien e-mail peut être ouvert avec
      // ou sans session active.
      { path: ROUTES.authCallback, lazy: lazyPage(() => import('@/pages/AuthCallbackPage')) },

      // ------------------------------------------------------------- catalogue public
      { path: ROUTES.tools, lazy: lazyPage(() => import('@/pages/ToolsPage')) },
      { path: ROUTE_PATTERNS.tool, lazy: lazyPage(() => import('@/pages/ToolDetailPage')) },
      { path: ROUTE_PATTERNS.category, lazy: lazyPage(() => import('@/pages/CategoryPage')) },
      { path: ROUTES.references, lazy: lazyPage(() => import('@/pages/ReferencesPage')) },

      // ------------------------------------------------------------- routes privées
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
];

export const router = createBrowserRouter(routes);
