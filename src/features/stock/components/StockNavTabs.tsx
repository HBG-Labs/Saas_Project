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
      icon: Boxes,
      badge: lowStockCount > 0 ? `${lowStockCount} alerte${lowStockCount > 1 ? 's' : ''}` : null,
      badgeVariant: 'warning' as const,
    },
    {
      to: ROUTES.stockMovements,
      label: 'Mouvements & Historique',
      icon: ArrowLeftRight,
    },
    {
      to: ROUTES.equipment,
      label: 'Matériel & Outillage',
      icon: Wrench,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === ROUTES.stock}
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
