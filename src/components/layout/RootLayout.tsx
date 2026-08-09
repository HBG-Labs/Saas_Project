import { Outlet } from 'react-router';

import { CommandBarProvider } from '@/features/search/CommandBarProvider';
import { useCatalogReconciliation } from '@/features/tools';

/**
 * Racine commune aux deux ossatures.
 *
 * Existe pour héberger ce qui doit être disponible partout — aujourd'hui la
 * palette de commandes — tout en restant À L'INTÉRIEUR du routeur, dont
 * `CommandBar` dépend via `useNavigate`.
 *
 * Ne rend aucune interface propre : la présentation reste entièrement dans
 * `PublicLayout` et `AppLayout`.
 */
export function RootLayout() {
  // Confronte le registry au catalogue en base. Silencieux en production, et
  // silencieux tant que les deux concordent.
  useCatalogReconciliation();

  return (
    <CommandBarProvider>
      <Outlet />
    </CommandBarProvider>
  );
}
