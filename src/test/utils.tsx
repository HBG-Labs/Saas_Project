import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

interface RenderWithProvidersOptions {
  /** Route initiale du routeur mémoire. */
  route?: string;
}

/**
 * Rend un composant avec les contextes dont dépend l'application.
 *
 * Un QueryClient neuf est créé à chaque appel : partager un cache entre tests
 * produit des échecs dépendants de l'ordre d'exécution, particulièrement
 * pénibles à diagnostiquer. Les tentatives sont désactivées pour qu'un cas
 * d'erreur échoue immédiatement au lieu de temporiser.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/' }: RenderWithProvidersOptions = {},
): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const router = createMemoryRouter([{ path: '*', element: ui }], {
    initialEntries: [route],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
