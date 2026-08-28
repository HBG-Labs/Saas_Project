import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';

import { CommandBarProvider } from '@/features/search/CommandBarProvider';
import { useCatalogReconciliation } from '@/features/tools';

/**
 * Racine commune aux deux ossatures.
 *
 * Gère la palette de commandes globale, la réconciliation du catalogue
 * et la remontée systématique du défilement en haut de page (Scroll to Top)
 * à chaque changement de route ou actualisation.
 */
export function RootLayout() {
  // Confronte le registry au catalogue en base. Silencieux en production, et
  // silencieux tant que les deux concordent.
  useCatalogReconciliation();
  const location = useLocation();

  // Remonte systématiquement en haut lors de chaque navigation ou actualisation
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } catch {
        window.scrollTo(0, 0);
      }
    }
  }, [location.pathname]);

  return (
    <CommandBarProvider>
      <ScrollRestoration getKey={() => 'top'} />
      <Outlet />
    </CommandBarProvider>
  );
}
