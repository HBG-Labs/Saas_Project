import { ArrowLeftRight, Boxes, Wrench } from 'lucide-react';
import { NavLink } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

interface StockNavTabsProps {
  lowStockCount?: number;
  equipmentCount?: number;
}

export function StockNavTabs({ lowStockCount = 0 }: StockNavTabsProps) {
  const tabs = [
    {
      to: ROUTES.stock,
      label: 'Articles & Fournitures',
      shortLabel: 'Articles',
      icon: Boxes,
      badge: lowStockCount > 0 ? `${lowStockCount}` : null,
      badgeVariant: 'warning' as const,
    },
    {
      to: ROUTES.stockMovements,
      label: 'Mouvements & Historique',
      shortLabel: 'Mouvements',
      icon: ArrowLeftRight,
    },
    {
      to: ROUTES.equipment,
      label: 'Matériel & Outillage',
      shortLabel: 'Matériel',
      icon: Wrench,
    },
  ];

  return (
    <nav
      aria-label="Navigation du stock"
      className="border-border -mx-4 mb-5 grid grid-cols-3 items-center gap-1.5 border-b px-4 pb-2.5 sm:mx-0 sm:flex sm:overflow-x-auto sm:px-0"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === ROUTES.stock}
            className={({ isActive }) =>
              cn(
                'min-h-touch inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] sm:min-h-0 sm:flex-initial sm:shrink sm:gap-2 sm:px-3.5',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            <span className="min-w-0 truncate sm:hidden">{tab.shortLabel}</span>
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
    </nav>
  );
}
