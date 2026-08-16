import { NavLink } from 'react-router';

import { MOBILE_NAV } from '@/config/navigation';
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
  const visibleNav = useVisibleNavItems(MOBILE_NAV);

  return (
    <nav
      aria-label="Navigation rapide"
      className={cn(
        'bg-surface/95 border-border fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md shadow-lg',
        'safe-bottom md:hidden',
      )}
    >
      <ul className="flex items-stretch">
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
                    'min-h-touch relative flex flex-col items-center justify-center gap-0.5 px-1 py-1.5',
                    'text-3xs font-medium transition-colors duration-[120ms] xs:text-2xs',
                    isActive
                      ? 'text-primary font-bold'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('size-5 shrink-0 transition-transform', isActive && 'scale-110')} aria-hidden="true" />
                    <span className="w-full truncate text-center">{item.label}</span>
                    {isActive ? (
                      <span className="absolute top-1 size-1 rounded-full bg-primary" aria-hidden="true" />
                    ) : null}
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
