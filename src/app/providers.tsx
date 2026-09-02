import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { CookieConsentBanner } from '@/components/feedback/CookieConsentBanner';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { ErrorFallback } from '@/components/feedback/ErrorFallback';
import { ToastProvider } from '@/components/feedback/Toast';
import { SupportBubble } from '@/components/feedback/SupportBubble';
import { AuthProvider } from '@/features/auth';
import { OrganizationProvider } from '@/features/organizations';
import { CustomizerDrawer } from '@/features/theme';
import { ThemeProvider } from '@/features/theme/ThemeProvider';
import { createQueryClient } from '@/lib/query-client';

/**
 * Contextes globaux.
 *
 * L'ordre est significatif :
 *   ErrorBoundary        — capture même une panne des providers eux-mêmes ;
 *   ThemeProvider        — l'écran d'erreur doit s'afficher dans le bon thème ;
 *   QueryClient          — l'authentification déclenchera des requêtes ;
 *   AuthProvider         — la session doit être disponible avant le routeur ;
 *   OrganizationProvider — s'appuie sur les deux précédents : il interroge le
 *                          serveur (donc QueryClient) pour les organisations de
 *                          l'utilisateur courant (donc AuthProvider).
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
          <AuthProvider>
            <OrganizationProvider>
              <ToastProvider>{children}</ToastProvider>
              <SupportBubble />
              <CustomizerDrawer />
              <CookieConsentBanner />
            </OrganizationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

