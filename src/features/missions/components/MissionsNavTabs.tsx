import { Archive, ClipboardCheck, ClipboardList } from 'lucide-react';
import { NavLink } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

interface MissionsNavTabsProps {
  pendingReviewCount?: number;
}

export function MissionsNavTabs({ pendingReviewCount = 0 }: MissionsNavTabsProps) {
  const tabs = [
    {
      to: ROUTES.missions,
      label: 'Missions & Chantiers',
      shortLabel: 'Missions',
      icon: ClipboardList,
    },
    {
      to: ROUTES.review,
      label: 'Contrôle & Rapports',
      shortLabel: 'Rapports',
      icon: ClipboardCheck,
      badge: pendingReviewCount > 0 ? `${pendingReviewCount}` : null,
    },
    {
      to: ROUTES.archives,
      label: 'Dossiers clôturés',
      shortLabel: 'Archives',
      icon: Archive,
    },
  ];

  return (
    <div className="no-scrollbar border-border -mx-4 flex items-center gap-1.5 overflow-x-auto scroll-smooth border-b px-4 pb-2 whitespace-nowrap sm:mx-0 sm:px-0 sm:pb-2.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              cn(
                'atelier-action-tab min-h-touch inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] sm:min-h-0 sm:flex-initial sm:shrink sm:gap-1.5 sm:px-3',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )
            }
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge && (
              <span
                className={cn(
                  'text-3xs ml-0.5 rounded-full px-1.5 py-0.5 leading-none font-bold sm:ml-1',
                  'bg-warning/20 text-warning dark:bg-warning/30',
                )}
              >
                {tab.badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}
