import {
  Briefcase,
  Building2,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import { ACCOUNT_NAV, SIDEBAR_GROUPS, type NavGroup, type NavItem } from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import { useCurrentIndustry } from '@/features/industries';
import { useCurrentOrganization, useVisibleNavGroups } from '@/features/organizations';

import { FALLBACK_NAV_ICON, NAV_ICONS } from './nav-icons';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onDownloadAppClick?: () => void;
  className?: string;
  /**
   * Sections à afficher. Par défaut celles du pilotage ; `AppLayout` substitue
   * les sections « Espace Technicien » quand le rôle réel dans l'organisation
   * courante est `technician`.
   */
  groups?: readonly NavGroup[] | undefined;
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
    if (item.to === ROUTES.dashboard) {
      return location.pathname === ROUTES.dashboard;
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
          collapsed && 'justify-center px-0',
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
  children,
}: {
  group: NavGroup;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = group.icon ? NAV_ICONS[group.icon] : null;

  return (
    <div className="space-y-1">
      {!collapsed ? (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
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
        <div className="h-px bg-border my-2" />
      )}

      <div
        className={cn(
          'transition-all duration-200 overflow-hidden',
          !collapsed && !isOpen ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100',
        )}
      >
        <ul className="space-y-0.5">{children}</ul>
      </div>
    </div>
  );
}

export function Sidebar({
  collapsed: externalCollapsed,
  onToggleCollapse,
  onNavigate,
  className,
  groups,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = externalCollapsed ?? internalCollapsed;
  const activeGroups = useVisibleNavGroups(groups ?? SIDEBAR_GROUPS);
  const { organization } = useCurrentOrganization();
  const { label: industryLabel, isResolved } = useCurrentIndustry();

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
        'flex h-full w-full flex-col justify-between p-3 transition-all duration-200 bg-surface border-border',
        className,
      )}
    >
      <div className="space-y-4 overflow-y-auto overflow-x-hidden pr-0.5">
        {/* En-tête Organisation & Métier */}
        <div className="flex items-center justify-between px-1 pt-1 pb-1">
          {!isCollapsed ? (
            <NavLink
              to={ROUTES.organization}
              onClick={onNavigate}
              className="min-w-0 pr-2 block rounded-lg p-1 -m-1 hover:bg-surface-hover/80 transition-colors group cursor-pointer"
              title="Paramètres de l'entreprise (modifier nom et secteur d'activité)"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                <Building2 className="size-3.5 text-primary shrink-0" />
                <span className="truncate">{organization?.name ?? 'NexoraTech'}</span>
              </div>
              {isResolved && industryLabel ? (
                <div className="mt-0.5 flex items-center gap-1 text-2xs text-muted-foreground group-hover:text-foreground/80 transition-colors truncate">
                  <Briefcase className="size-3 text-subtle-foreground shrink-0" />
                  <span className="truncate">{industryLabel}</span>
                </div>
              ) : null}
            </NavLink>
          ) : null}

          <button
            type="button"
            onClick={handleToggle}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer shrink-0"
            title={isCollapsed ? 'Développer la sidebar' : 'Réduire la sidebar'}
            aria-label="Toggle Sidebar"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>

        {/* Sections de navigation accordéon */}
        {activeGroups.map((group) => (
          <CollapsibleSidebarSection key={group.id} group={group} collapsed={isCollapsed}>
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

      <div className="pt-3 border-t border-border">
        <CollapsibleSidebarSection
          group={{ id: 'account', label: 'Compte & Paramètres', icon: 'settings', items: ACCOUNT_NAV }}
          collapsed={isCollapsed}
        >
          {ACCOUNT_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={isCollapsed} onNavigate={onNavigate} />
          ))}
        </CollapsibleSidebarSection>
      </div>
    </nav>
  );
}
