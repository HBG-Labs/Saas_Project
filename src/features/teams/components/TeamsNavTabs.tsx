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
      icon: UsersRound,
    },
    {
      to: ROUTES.organizationMembers,
      label: 'Techniciens & Membres',
      icon: Users,
      badge: memberCount > 0 ? `${memberCount}` : null,
    },
    {
      to: ROUTES.vehicles,
      label: 'Flotte & Véhicules',
      icon: Truck,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3 mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={cn(
                  'ml-1 rounded-full px-1.5 py-0.5 text-3xs font-bold leading-none',
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
