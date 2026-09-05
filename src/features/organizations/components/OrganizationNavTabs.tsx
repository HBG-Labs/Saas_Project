import { Building, CreditCard, FileCheck2, Scroll } from 'lucide-react';
import { NavLink } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

export function OrganizationNavTabs() {
  const tabs = [
    {
      to: ROUTES.organization,
      label: 'Paramètres Entreprise',
      shortLabel: 'Entreprise',
      icon: Building,
    },
    {
      to: ROUTES.organizationEinvoicing,
      label: 'Facturation électronique',
      shortLabel: 'E-facturation',
      icon: FileCheck2,
    },
    {
      to: ROUTES.organizationBilling,
      label: 'Abonnement & Facturation',
      shortLabel: 'Abonnement',
      icon: CreditCard,
    },
    {
      to: ROUTES.auditLog,
      label: 'Journal d’activité',
      shortLabel: 'Journal',
      icon: Scroll,
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
                'min-h-touch inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.98] sm:min-h-0 sm:flex-initial sm:shrink sm:gap-2 sm:px-3.5',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}
