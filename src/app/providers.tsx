import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { ErrorFallback } from '@/components/feedback/ErrorFallback';
import { AuthProvider } from '@/features/auth';
import { ThemeProvider } from '@/features/theme/ThemeProvider';
import { createQueryClient } from '@/lib/query-client';

/**
 * Contextes globaux.
 *
 * L'ordre est significatif :
 *   ErrorBoundary  — capture même une panne des providers eux-mêmes ;
 *   ThemeProvider  — l'écran d'erreur doit s'afficher dans le bon thème ;
 *   QueryClient    — l'authentification déclenchera des requêtes ;
 *   AuthProvider   — la session doit être disponible avant le routeur.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // Initialisation paresseuse : un seul QueryClient pour toute la vie de
  // l'application, sans variable de module (qui serait partagée entre les tests
  // et provoquerait des fuites de cache entre eux).
  const [queryClient] = useState(createQueryClient);

  return (
    <ErrorBoundary fallback={({ error, reset }) => <ErrorFallback error={error} reset={reset} />}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
