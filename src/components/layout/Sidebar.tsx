import { NavLink } from 'react-router';

import { ACCOUNT_NAV, APP_NAV, ORGANIZATION_NAV, type NavItem } from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { useVisibleNavItems } from '@/features/organizations';
import { cn } from '@/lib/cn';

import { FALLBACK_NAV_ICON, NAV_ICONS } from './nav-icons';

interface SidebarProps {
  /** Réduit la barre aux icônes seules (tablette, ou préférence utilisateur). */
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const Icon = NAV_ICONS[item.icon] ?? FALLBACK_NAV_ICON;

  return (
    <li>
      <NavLink
        to={item.to}
        onClick={onNavigate}
        // `end` évite que /tools reste marqué actif sur /tools/mon-outil.
        end={item.to === ROUTES.dashboard}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            'flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium',
            'transition-colors duration-[120ms]',
            'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
            collapsed && 'justify-center px-0',
            isActive
              ? 'bg-primary-subtle text-primary'
              : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
          )
        }
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
      </NavLink>
    </li>
  );
}

/**
 * Navigation latérale de l'application.
 *
 * Persistante à partir de `lg`, réduite en icônes sur tablette, et rendue dans
 * un tiroir sur mobile (voir `AppLayout`).
 */
export function Sidebar({ collapsed = false, onNavigate, className }: SidebarProps) {
  // Les entrées réservées à un rôle ou à une formule disparaissent plutôt que
  // d'être grisées : un menu qui propose six sections dont quatre inaccessibles
  // décrit l'application, pas le travail de celui qui la regarde.
  const visibleNav = useVisibleNavItems(APP_NAV);
  const visibleOrganizationNav = useVisibleNavItems(ORGANIZATION_NAV);

  return (
    <nav
      aria-label="Navigation principale"
      className={cn('flex h-full flex-col gap-6 p-3', className)}
    >
      <ul className="space-y-0.5">
        {visibleNav.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </ul>

      {/*
        La section entière disparaît hors organisation — un intitulé
        « Entreprise » surmontant le vide poserait plus de questions qu'il n'en
        résout.
      */}
      {visibleOrganizationNav.length > 0 && (
        <div>
          <p
            className={cn(
              'text-subtle-foreground text-2xs mb-1 px-2.5 font-medium tracking-wider uppercase',
              collapsed && 'sr-only',
            )}
          >
            Entreprise
          </p>
          <ul className="space-y-0.5">
            {visibleOrganizationNav.map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto">
        <p
          className={cn(
            'text-subtle-foreground text-2xs mb-1 px-2.5 font-medium tracking-wider uppercase',
            collapsed && 'sr-only',
          )}
        >
          Compte
        </p>
        <ul className="space-y-0.5">
          {ACCOUNT_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </ul>
      </div>
    </nav>
  );
}
