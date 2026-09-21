import { NavLink } from 'react-router';

import { MOBILE_NAV_CANDIDATES, MOBILE_NAV_SIZE } from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { useVisibleNavItems } from '@/features/organizations';
import { cn } from '@/lib/cn';

import { FALLBACK_NAV_ICON, NAV_ICONS } from './nav-icons';

/**
 * Navigation basse, mobile uniquement.
 *
 * Pourquoi en bas plutôt qu'un simple menu hamburger : sur un téléphone tenu à
 * une main, le haut de l'écran est hors d'atteinte du pouce. Les destinations
 * fréquentes doivent être là où la main est.
 *
 * Le rembourrage bas suit `env(safe-area-inset-bottom)` pour ne pas passer sous
 * l'indicateur d'accueil iOS ni sous la barre gestuelle Android.
 */
export function MobileNav() {
  // Filtrer D'ABORD, couper ENSUITE : l'inverse laissait une entrée gâcher sa
  // place puis disparaître, et la barre tombait à trois destinations sur un
  // compte dont la formule n'ouvre pas le planning.
  const visibleNav = useVisibleNavItems(MOBILE_NAV_CANDIDATES).slice(0, MOBILE_NAV_SIZE);

  return (
    <nav
      aria-label="Navigation rapide"
      className={cn(
        'bg-surface border-border fixed inset-x-0 bottom-0 z-40 border-t',
        'safe-bottom md:hidden',
      )}
    >
      <ul className="flex items-stretch gap-1 px-2 py-1">
        {visibleNav.map((item) => {
          const Icon = NAV_ICONS[item.icon] ?? FALLBACK_NAV_ICON;

          return (
            <li key={item.to} className="min-w-0 flex-1">
              <NavLink
                to={item.to}
                end={item.to === ROUTES.dashboard}
                className={({ isActive }) =>
                  cn(
                    // 44 px minimum : cible tactile WCAG 2.5.5.
                    'group min-h-touch focus-visible:ring-ring relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                    'text-3xs xs:text-2xs font-medium transition-colors duration-[120ms]',
                    isActive
                      ? 'text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'size-6 shrink-0 transition-[color,transform] duration-150',
                        isActive
                          ? 'text-nav-selected -translate-y-0.5'
                          : 'text-muted-foreground group-hover:text-foreground',
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                      aria-hidden="true"
                    />
                    <span className="w-full truncate text-center">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
