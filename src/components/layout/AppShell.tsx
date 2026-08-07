import { NavLink, Outlet } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { to: ROUTES.home, label: 'Accueil' },
  { to: ROUTES.tools, label: 'Outils' },
  { to: ROUTES.references, label: 'Références' },
  { to: ROUTES.dashboard, label: 'Tableau de bord' },
] as const;

/**
 * Ossature de l'application : en-tête, navigation, zone de contenu.
 *
 * Volontairement sobre — le Design System fait l'objet d'une phase dédiée.
 * Trois choix sont néanmoins structurels et posés dès maintenant :
 *   • responsive mobile-first (§11), pas ajouté après coup ;
 *   • lien d'évitement + repères sémantiques header/nav/main (§12) ;
 *   • cibles tactiles de 44 px minimum sur les liens de navigation.
 */
export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu-principal"
        className="bg-brand-600 sr-only rounded-md px-4 py-2 text-white focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Aller au contenu principal
      </a>

      <header className="border-border bg-surface sticky top-0 z-40 border-b">
        <div
          className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ paddingTop: 'max(0.75rem, var(--safe-top))' }}
        >
          <NavLink to={ROUTES.home} className="text-lg font-semibold tracking-tight">
            Nexora<span className="text-brand-600">Tech</span>
          </NavLink>

          <nav aria-label="Navigation principale">
            <ul className="flex flex-wrap items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'min-h-touch flex items-center rounded-md px-3 text-sm transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-700 font-medium'
                          : 'text-content-muted hover:bg-surface-muted',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="contenu-principal" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer
        className="border-border text-content-muted border-t px-4 py-6 text-center text-xs"
        style={{ paddingBottom: 'max(1.5rem, var(--safe-bottom))' }}
      >
        NexoraTech — fondations Phase 1
      </footer>
    </div>
  );
}
