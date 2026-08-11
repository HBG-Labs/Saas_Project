import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import { ACCOUNT_NAV, SIDEBAR_GROUPS, type NavItem } from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

import { FALLBACK_NAV_ICON, NAV_ICONS } from './nav-icons';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onDownloadAppClick?: () => void;
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
        className={
          cn(
            'flex min-h-9 items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium',
            'transition-all duration-150',
            'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
            collapsed && 'justify-center px-0',
            isActive
              ? 'bg-blue-600 text-white font-semibold shadow-xs dark:bg-blue-600 dark:text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white',
          )
        }
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className={cn(collapsed && 'sr-only', 'truncate')}>{item.label}</span>
      </NavLink>
    </li>
  );
}

export function Sidebar({
  collapsed: externalCollapsed = false,
  onToggleCollapse,
  onNavigate,
  onDownloadAppClick,
  className,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(externalCollapsed);
  const isCollapsed = onToggleCollapse ? externalCollapsed : internalCollapsed;

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
        'flex h-full w-full flex-col justify-between p-3 transition-all duration-200 bg-white dark:bg-slate-950',
        className,
      )}
    >
      <div className="space-y-6 overflow-y-auto overflow-x-hidden">
        {/* Bouton de bascule Collapsible */}
        <div className="flex items-center justify-between px-1 pt-1">
          {!isCollapsed && (
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Espace de travail
            </span>
          )}
          <button
            type="button"
            onClick={handleToggle}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
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

        {/* 3 Sections demandées */}
        {SIDEBAR_GROUPS.map((group) => (
          <SidebarSection key={group.id} label={group.label} collapsed={isCollapsed}>
            {group.items.map((item) => (
              <SidebarLink
                key={`${group.id}-${item.to}-${item.label}`}
                item={item}
                collapsed={isCollapsed}
                onNavigate={onNavigate}
              />
            ))}
          </SidebarSection>
        ))}
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60">
        <SidebarSection label="Gestion Compte" collapsed={isCollapsed}>
          {ACCOUNT_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={isCollapsed} onNavigate={onNavigate} />
          ))}
        </SidebarSection>
      </div>
    </nav>
  );
}

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
          'text-2xs mb-1 px-2.5 font-bold tracking-wider text-slate-400 uppercase',
          collapsed && 'sr-only',
        )}
      >
        {label}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}
