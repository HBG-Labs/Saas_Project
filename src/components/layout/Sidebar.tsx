import {
  Briefcase,
  Building2,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';

import { ACCOUNT_NAV, SIDEBAR_GROUPS, type NavGroup, type NavItem } from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { useCurrentIndustry } from '@/features/industries';
import { useCurrentOrganization, useVisibleNavGroups } from '@/features/organizations';
import { cn } from '@/lib/cn';

import { FALLBACK_NAV_ICON, NAV_ICONS } from './nav-icons';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
  showCollapseButton?: boolean;
  className?: string;
  /**
   * Sections à afficher. Par défaut celles du pilotage ; `AppLayout` substitue
   * les sections « Espace Technicien » quand le rôle réel dans l'organisation
   * courante est `technician`.
   */
  groups?: readonly NavGroup[] | undefined;
}

function isGroupActive(group: NavGroup, pathname: string, search: string): boolean {
  const currentFullPath = pathname + search;
  return group.items.some((item) => {
    if (item.to.includes('?')) {
      return currentFullPath === item.to;
    }
    if (item.to === ROUTES.organization) {
      return pathname === ROUTES.organization || pathname === ROUTES.organizationNew;
    }
    if (item.to === ROUTES.tools) {
      return pathname === ROUTES.tools && (!search || search === '?cat=all');
    }
    if (item.to === ROUTES.metiers) {
      return pathname === ROUTES.metiers || pathname.startsWith('/metiers');
    }
    if (item.to === ROUTES.dashboard) {
      return pathname === ROUTES.dashboard;
    }
    if (item.to === ROUTES.stock) {
      return pathname === ROUTES.stock;
    }
    return pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to + '/'));
  });
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
  const location = useLocation();

  const currentFullPath = location.pathname + location.search;

  const isActive = (() => {
    if (item.to.includes('?')) {
      return currentFullPath === item.to;
    }
    if (item.to === ROUTES.tools) {
      return location.pathname === ROUTES.tools && (!location.search || location.search === '?cat=all');
    }
    if (item.to === ROUTES.metiers) {
      return location.pathname === ROUTES.metiers;
    }
    if (item.to === ROUTES.dashboard) {
      return location.pathname === ROUTES.dashboard;
    }
    if (item.to === ROUTES.organization) {
      return location.pathname === ROUTES.organization || location.pathname === ROUTES.organizationNew;
    }
    if (item.to === ROUTES.stock) {
      return location.pathname === ROUTES.stock;
    }
    return location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to + '/'));
  })();

  return (
    <li>
      <NavLink
        to={item.to}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={cn(
          'group relative flex min-h-9 items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium',
          'transition-all duration-150',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          collapsed ? 'justify-center px-0 size-9 mx-auto' : 'w-full',
          isActive
            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
            : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
        )}
      >
        <Icon
          className={cn(
            'size-4 shrink-0 transition-transform group-hover:scale-105',
            isActive && 'text-primary-foreground',
          )}
          aria-hidden="true"
        />
        <span className={cn(collapsed && 'sr-only', 'truncate')}>{item.label}</span>
      </NavLink>
    </li>
  );
}

function CollapsibleSidebarSection({
  group,
  collapsed,
  isOpen,
  onToggle,
  children,
}: {
  group: NavGroup;
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const Icon = group.icon ? NAV_ICONS[group.icon] : null;

  return (
    <div className="space-y-1">
      {!collapsed ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-2.5 py-1.5 text-2xs font-bold tracking-wider text-muted-foreground uppercase hover:text-foreground hover:bg-surface-hover/60 rounded-lg transition-colors group cursor-pointer select-none"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 truncate">
            {Icon && <Icon className="size-3.5 text-primary/80 shrink-0" />}
            <span className="truncate">{group.label}</span>
          </div>
          <ChevronDown
            className={cn(
              'size-3.5 text-muted-foreground group-hover:text-foreground transition-transform duration-200 shrink-0',
              !isOpen && '-rotate-90',
            )}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex size-9 mx-auto items-center justify-center rounded-xl transition-all cursor-pointer group',
            isOpen
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
          )}
          title={`${group.label} (${isOpen ? 'fermer' : 'ouvrir'})`}
          aria-label={group.label}
          aria-expanded={isOpen}
        >
          {Icon ? (
            <Icon className="size-4 shrink-0 transition-transform group-hover:scale-110" />
          ) : (
            <div className="size-2 rounded-full bg-border group-hover:bg-primary" />
          )}
        </button>
      )}

      {/* Contenu déroulant accordéon contrôlé par isOpen */}
      <div
        className={cn(
          'transition-all duration-200 overflow-hidden',
          !isOpen ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[600px] opacity-100',
        )}
      >
        <ul className="space-y-1">{children}</ul>
      </div>
    </div>
  );
}

export function Sidebar({
  collapsed: externalCollapsed,
  onToggleCollapse,
  onNavigate,
  onClose,
  showCollapseButton = true,
  className,
  groups,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = showCollapseButton ? (externalCollapsed ?? internalCollapsed) : false;
  const activeGroups = useVisibleNavGroups(groups ?? SIDEBAR_GROUPS);
  const { organization } = useCurrentOrganization();
  const { label: industryLabel, isResolved } = useCurrentIndustry();
  const location = useLocation();

  const accountGroup: NavGroup = {
    id: 'account',
    label: 'Compte & Paramètres',
    icon: 'settings',
    items: ACCOUNT_NAV,
  };

  const allGroups = [...activeGroups, accountGroup];
  const currentFullPath = location.pathname + location.search;

  // Un seul volet ouvert à la fois : celui qui contient la page courante.
  const activeGroupId =
    allGroups.find((g) => isGroupActive(g, location.pathname, location.search))?.id ??
    activeGroups[0]?.id ??
    'interventions';

  // Le repli manuel ne vaut QUE pour la page où il a été fait. Mémoriser le
  // chemin avec le choix suffit à le périmer à la navigation suivante, sans
  // effet de synchronisation.
  //
  // Déduit au rendu, et non posé par un `useEffect` : `setOpenGroupId` dans un
  // effet provoquait un second rendu à chaque navigation, et le volet s'ouvrait
  // une image après le changement de page. C'est le défaut que le code
  // précédent documentait avoir corrigé — et que la règle ESLint
  // `react-hooks/set-state-in-effect` signalait ici.
  const [manualOverride, setManualOverride] = useState<{
    path: string;
    openId: string | null;
  } | null>(null);

  const openGroupId =
    manualOverride?.path === currentFullPath ? manualOverride.openId : activeGroupId;

  const handleToggleGroup = (groupId: string) => {
    setManualOverride({
      path: currentFullPath,
      openId: openGroupId === groupId ? null : groupId,
    });
  };

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  return (
    <nav
      aria-label="Navigation principale"
      className={cn(
        'flex h-full w-full flex-col justify-between transition-all duration-200 bg-surface border-border',
        isCollapsed ? 'px-2 py-3' : 'p-3',
        className,
      )}
    >
      <div className="space-y-3 overflow-y-auto overflow-x-hidden pr-0.5">
        {/* En-tête Organisation & Métier */}
        <div
          className={cn(
            'flex items-center pt-1 pb-1',
            isCollapsed ? 'justify-center' : 'justify-between px-1',
          )}
        >
          {!isCollapsed ? (
            <NavLink
              to={ROUTES.organization}
              onClick={onNavigate}
              className="min-w-0 pr-2 block rounded-lg p-1 -m-1 hover:bg-surface-hover/80 transition-colors group cursor-pointer"
              title="Paramètres de l'entreprise (modifier nom et secteur d'activité)"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                <Building2 className="size-3.5 text-primary shrink-0" />
                <span className="truncate">{organization?.name ?? 'REZO360'}</span>
              </div>
              {isResolved && industryLabel ? (
                <div className="mt-0.5 flex items-center gap-1 text-2xs text-muted-foreground group-hover:text-foreground/80 transition-colors truncate">
                  <Briefcase className="size-3 text-subtle-foreground shrink-0" />
                  <span className="truncate">{industryLabel}</span>
                </div>
              ) : null}
            </NavLink>
          ) : null}

          {showCollapseButton ? (
            <button
              type="button"
              onClick={handleToggle}
              className={cn(
                'rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer shrink-0',
                isCollapsed && 'mx-auto',
              )}
              title={isCollapsed ? 'Développer la sidebar' : 'Réduire la sidebar'}
              aria-label="Toggle Sidebar"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          ) : onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer shrink-0"
              title="Fermer le menu"
              aria-label="Fermer le menu"
            >
              <PanelLeftClose className="size-4" />
            </button>
          ) : null}
        </div>

        {/* Sections de navigation accordéon (un seul volet ouvert à la fois) */}
        {activeGroups.map((group) => (
          <CollapsibleSidebarSection
            key={group.id}
            group={group}
            collapsed={isCollapsed}
            isOpen={openGroupId === group.id}
            onToggle={() => handleToggleGroup(group.id)}
          >
            {group.items.map((item) => (
              <SidebarLink
                key={`${group.id}-${item.to}-${item.label}`}
                item={item}
                collapsed={isCollapsed}
                onNavigate={onNavigate}
              />
            ))}
          </CollapsibleSidebarSection>
        ))}
      </div>

      <div className="pt-2 border-t border-border">
        <CollapsibleSidebarSection
          group={accountGroup}
          collapsed={isCollapsed}
          isOpen={openGroupId === 'account'}
          onToggle={() => handleToggleGroup('account')}
        >
          {ACCOUNT_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={isCollapsed} onNavigate={onNavigate} />
          ))}
        </CollapsibleSidebarSection>
      </div>
    </nav>
  );
}
