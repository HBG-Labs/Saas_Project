import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';

import { CommandBarProvider } from '@/features/search/CommandBarProvider';
import { useCatalogReconciliation } from '@/features/tools';
import { useMetaPixel } from '@/lib/use-meta-pixel';

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

  /*
    Ici et nulle part ailleurs.

    `RootLayout` est le seul élément traversé par TOUTES les routes, publiques
    comme privées. Poser la mesure plus bas — dans `PublicLayout`, par exemple —
    la rendrait aveugle dès l'entrée dans l'application, c'est-à-dire au moment
    précis où la conversion se joue.

    Inerte sans `VITE_META_PIXEL_ID` et sans consentement marketing.
  */
  useMetaPixel();

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
