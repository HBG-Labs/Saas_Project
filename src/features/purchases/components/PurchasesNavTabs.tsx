import { ShoppingCart, Store } from 'lucide-react';
import { NavLink } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

interface PurchasesNavTabsProps {
  pendingDeliveryCount?: number;
}

export function PurchasesNavTabs({ pendingDeliveryCount = 0 }: PurchasesNavTabsProps) {
  const tabs = [
    {
      to: ROUTES.purchaseOrders,
      label: 'Commandes Fournisseurs',
      shortLabel: 'Commandes',
      icon: ShoppingCart,
      badge: pendingDeliveryCount > 0 ? `${pendingDeliveryCount}` : null,
      badgeVariant: 'primary' as const,
    },
    {
      to: ROUTES.suppliers,
      label: 'Fournisseurs & Tarifs',
      shortLabel: 'Fournisseurs',
      icon: Store,
    },
  ];

  return (
    <nav
      aria-label="Navigation des achats"
      className="border-border -mx-4 mb-5 grid grid-cols-2 items-center gap-1.5 border-b px-4 pb-2.5 sm:mx-0 sm:flex sm:overflow-x-auto sm:px-0"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === ROUTES.purchaseOrders || tab.to === ROUTES.suppliers}
            className={({ isActive }) =>
              cn(
                'atelier-action-tab min-h-touch inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-bold transition-colors sm:min-h-0 sm:flex-initial sm:shrink sm:gap-1.5 sm:px-3',
                isActive
                  ? 'bg-primary-subtle text-primary'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )
            }
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge && (
              <span
                className={cn(
                  'text-3xs ml-0.5 rounded-full px-1.5 py-0.5 leading-none font-bold sm:ml-1',
                  'bg-primary text-primary-foreground',
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
