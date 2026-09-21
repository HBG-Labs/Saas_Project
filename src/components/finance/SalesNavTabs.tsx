import { Calculator, FileText, ReceiptText } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

const tabs = [
  { to: ROUTES.quotes, label: 'Chiffrer', icon: Calculator },
  { to: ROUTES.quotesHistory, label: 'Devis', icon: FileText },
  { to: ROUTES.invoices, label: 'Factures', icon: ReceiptText },
] as const;

/** Navigation locale de la chaîne de vente, sans modifier les routes historiques. */
export function SalesNavTabs() {
  const { pathname } = useLocation();

  const isActive = (to: string) => {
    if (to === ROUTES.quotes) return pathname === ROUTES.quotes;
    if (to === ROUTES.quotesHistory) {
      return pathname === ROUTES.quotesHistory || pathname.startsWith(`${ROUTES.quotes}/`);
    }
    return pathname === ROUTES.invoices || pathname.startsWith(`${ROUTES.invoices}/`);
  };

  return (
    <nav
      aria-label="Navigation des ventes"
      className="border-border -mx-4 grid grid-cols-3 gap-1.5 border-b px-4 pb-2.5 sm:mx-0 sm:flex sm:px-0"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.to);

        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'min-h-touch inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-bold transition-colors sm:min-h-0 sm:px-4',
              active
                ? 'bg-primary-subtle text-primary'
                : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
