import { NavLink } from 'react-router';

import { ACCOUNT_NAV, ROOT_NAV, SIDEBAR_GROUPS, type NavItem } from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { useVisibleNavGroups, useVisibleNavItems } from '@/features/organizations';
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
  const visibleRoot = useVisibleNavItems(ROOT_NAV);

  /*
    Quatre sections nommées plutôt qu'une liste plate surmontée d'un unique
    « Entreprise » — intitulé qui désignait aussi l'une de ses propres entrées.
    Les missions et la facturation ne se cherchent pas au même rythme ; les
    ranger ensemble obligeait à relire huit lignes pour en trouver une.

    Hors organisation, les trois premières sections s'effacent entièrement :
    aucune de leurs entrées ne passe le filtrage.
  */
  const visibleGroups = useVisibleNavGroups(SIDEBAR_GROUPS);

  return (
    <nav
      aria-label="Navigation principale"
      className={cn('flex h-full flex-col gap-5 p-3', className)}
    >
      <ul className="space-y-0.5">
        {visibleRoot.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </ul>

      {visibleGroups.map((group) => (
        <SidebarSection key={group.id} label={group.label} collapsed={collapsed}>
          {group.items.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </SidebarSection>
      ))}

      <div className="mt-auto">
        <SidebarSection label="Compte" collapsed={collapsed}>
          {ACCOUNT_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </SidebarSection>
      </div>
    </nav>
  );
}

/**
 * Section titrée.
 *
 * L'intitulé passe en `sr-only` en mode réduit : les icônes seules ne laissent
 * pas la place d'un titre, mais le lecteur d'écran garde le repère qui
 * distingue « Missions » de « Facturation ».
 */
function SidebarSection({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={cn(
          'text-subtle-foreground text-2xs mb-1 px-2.5 font-medium tracking-wider uppercase',
          collapsed && 'sr-only',
        )}
      >
        {label}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}
