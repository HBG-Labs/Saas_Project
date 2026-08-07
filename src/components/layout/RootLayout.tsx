import { Outlet } from 'react-router';

import { CommandBarProvider } from '@/features/search/CommandBarProvider';

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
  return (
    <CommandBarProvider>
      <Outlet />
    </CommandBarProvider>
  );
}
