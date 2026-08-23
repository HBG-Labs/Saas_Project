import { Building, CreditCard, Scroll } from 'lucide-react';
import { NavLink } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

export function OrganizationNavTabs() {
  const tabs = [
    {
      to: ROUTES.organization,
      label: 'Paramètres Entreprise',
      icon: Building,
    },
    {
      to: ROUTES.organizationBilling,
      label: 'Abonnement & Facturation',
      icon: CreditCard,
    },
    {
      to: ROUTES.auditLog,
      label: 'Journal d’activité',
      icon: Scroll,
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
          </NavLink>
        );
      })}
    </div>
  );
}
