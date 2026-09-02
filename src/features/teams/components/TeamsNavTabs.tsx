import { Truck, Users, UsersRound } from 'lucide-react';
import { NavLink } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

interface TeamsNavTabsProps {
  memberCount?: number;
}

export function TeamsNavTabs({ memberCount = 0 }: TeamsNavTabsProps) {
  const tabs = [
    {
      to: ROUTES.teams,
      label: 'Équipes',
      shortLabel: 'Équipes',
      icon: UsersRound,
    },
    {
      to: ROUTES.organizationMembers,
      label: 'Techniciens & Membres',
      shortLabel: 'Techniciens',
      icon: Users,
      badge: memberCount > 0 ? `${memberCount}` : null,
    },
    {
      to: ROUTES.vehicles,
      label: 'Flotte & Véhicules',
      shortLabel: 'Véhicules',
      icon: Truck,
    },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap border-b border-border pb-2.5 mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              cn(
                'min-h-touch sm:min-h-0 inline-flex flex-1 sm:flex-initial justify-center shrink-0 sm:shrink items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-3.5 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98]',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge && (
              <span
                className={cn(
                  'ml-0.5 sm:ml-1 rounded-full px-1.5 py-0.5 text-3xs font-bold leading-none',
                  'bg-primary/20 text-primary dark:bg-primary/30',
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
