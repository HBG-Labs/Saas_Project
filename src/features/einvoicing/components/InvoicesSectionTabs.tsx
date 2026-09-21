import { FileUp, Inbox } from 'lucide-react';
import { NavLink } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

/** Même patron que `OrganizationNavTabs` : deux sections du même module, jamais deux pages indépendantes. */
export function InvoicesSectionTabs() {
  const tabs = [
    { to: ROUTES.invoices, label: 'Factures émises', shortLabel: 'Émises', icon: FileUp },
    {
      to: ROUTES.receivedInvoices,
      label: 'Factures reçues',
      shortLabel: 'Reçues',
      icon: Inbox,
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
          </NavLink>
        );
      })}
    </div>
  );
}
