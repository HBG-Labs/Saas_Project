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
    <div className="no-scrollbar border-border -mx-4 mb-5 flex items-center gap-1.5 overflow-x-auto scroll-smooth border-b px-4 pb-2.5 whitespace-nowrap sm:mx-0 sm:px-0">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              cn(
                'min-h-touch inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-[color,background-color,box-shadow,transform] duration-150 active:scale-[0.98] sm:min-h-0 sm:flex-initial sm:shrink sm:gap-2 sm:px-3.5',
                'focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none motion-reduce:active:scale-100',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge ? (
                  <span
                    className={cn(
                      'text-3xs ml-0.5 rounded-full px-1.5 py-0.5 leading-none font-bold sm:ml-1',
                      isActive
                        ? 'bg-primary-foreground/15 text-primary-foreground'
                        : 'bg-primary/10 text-primary',
                    )}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}
