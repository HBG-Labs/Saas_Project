import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { ErrorFallback } from '@/components/feedback/ErrorFallback';
import { AuthProvider } from '@/features/auth';
import { createQueryClient } from '@/lib/query-client';

/**
 * Contextes globaux de l'application.
 *
 * L'ordre est significatif :
 *   ErrorBoundary  — capture même une panne des providers eux-mêmes ;
 *   QueryClient    — l'authentification déclenchera des requêtes ;
 *   AuthProvider   — la session doit être disponible avant le routeur.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // `useState` d'initialisation paresseuse : un seul QueryClient pour toute la
  // vie de l'application, sans variable de module (qui serait partagée entre
  // les tests et provoquerait des fuites de cache entre eux).
  const [queryClient] = useState(createQueryClient);

  return (
    <ErrorBoundary fallback={({ error, reset }) => <ErrorFallback error={error} reset={reset} />}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
