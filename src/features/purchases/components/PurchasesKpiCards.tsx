import { Input } from '@/components/ui/Input';
import { Calendar, ChevronDown, Clock, Euro, ShoppingCart, Store } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/Dropdown';
import type { PurchaseMetrics, PurchaseOrder } from '../types/purchases.types';

export type PurchasePeriod =
  'current_month' | 'last_month' | 'custom_month' | 'current_year' | 'all';

interface PurchasesKpiCardsProps {
  metrics: PurchaseMetrics;
  orders?: PurchaseOrder[] | undefined;
}

export function PurchasesKpiCards({ metrics, orders = [] }: PurchasesKpiCardsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PurchasePeriod>('current_month');
  const [customMonth, setCustomMonth] = useState<string>(
    new Date().toISOString().slice(0, 7), // YYYY-MM
  );

  // Mois actuel et précédent pour affichage dynamique
  const now = useMemo(() => new Date(), []);
  const currentMonthName = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const prevMonthDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), [now]);
  const prevMonthName = prevMonthDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const currentYear = now.getFullYear();

  const periodSpend = useMemo(() => {
    if (!orders || orders.length === 0) {
      return {
        amountEur: metrics.totalSpendMonthEur,
        count: metrics.ordersCompleted,
        label: 'Ce mois-ci',
        badgeText: 'Ce mois-ci',
      };
    }

    const currentYearNum = now.getFullYear();
    const currentMonthNum = now.getMonth();

    let filtered = orders.filter((o) => o.status !== 'cancelled');
    let label = `Ce mois-ci (${currentMonthName})`;
    let badgeText = 'Ce mois-ci';

    if (selectedPeriod === 'current_month') {
      label = `Ce mois-ci (${currentMonthName})`;
      badgeText = currentMonthName;
      filtered = filtered.filter((o) => {
        const d = new Date(o.orderDate);
        return d.getFullYear() === currentYearNum && d.getMonth() === currentMonthNum;
      });
    } else if (selectedPeriod === 'last_month') {
      label = `Mois dernier (${prevMonthName})`;
      badgeText = prevMonthName;
      const prevYearNum = prevMonthDate.getFullYear();
      const prevMonthIdx = prevMonthDate.getMonth();
      filtered = filtered.filter((o) => {
        const d = new Date(o.orderDate);
        return d.getFullYear() === prevYearNum && d.getMonth() === prevMonthIdx;
      });
    } else if (selectedPeriod === 'custom_month' && customMonth) {
      const [yStr, mStr] = customMonth.split('-');
      const y = Number(yStr);
      const m = Number(mStr) - 1;
      const targetDate = new Date(y, m, 1);
      const formattedMonth = targetDate.toLocaleString('fr-FR', {
        month: 'long',
        year: 'numeric',
      });
      label = `Mois : ${formattedMonth}`;
      badgeText = formattedMonth;
      filtered = filtered.filter((o) => {
        const d = new Date(o.orderDate);
        return d.getFullYear() === y && d.getMonth() === m;
      });
    } else if (selectedPeriod === 'current_year') {
      label = `Année ${currentYear}`;
      badgeText = `Année ${currentYear}`;
      filtered = filtered.filter((o) => {
        const d = new Date(o.orderDate);
        return d.getFullYear() === currentYearNum;
      });
    } else {
      label = 'Tout l’historique';
      badgeText = 'Historique global';
    }

    const amountEur = Math.round(filtered.reduce((sum, o) => sum + o.subtotalEur, 0) * 100) / 100;
    const count = filtered.length;

    return { amountEur, count, label, badgeText };
  }, [
    orders,
    selectedPeriod,
    customMonth,
    metrics,
    currentMonthName,
    prevMonthName,
    currentYear,
    prevMonthDate,
    now,
  ]);

  return (
    <dl className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border lg:grid-cols-4">
      <div className="bg-surface p-3 sm:p-4">
        <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
          <ShoppingCart className="text-primary size-4" aria-hidden="true" />
          Commandes
        </dt>
        <dd className="text-foreground mt-2 text-xl font-bold tabular-nums sm:text-2xl">
          {metrics.totalOrders}
        </dd>
        <p className="text-subtle-foreground mt-0.5 text-xs">
          {metrics.ordersDraft} brouillon{metrics.ordersDraft > 1 ? 's' : ''}
        </p>
      </div>

      <div
        className={
          metrics.ordersPendingDelivery > 0
            ? 'bg-warning-subtle p-3 sm:p-4'
            : 'bg-surface p-3 sm:p-4'
        }
      >
        <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
          <Clock
            className={metrics.ordersPendingDelivery > 0 ? 'text-warning size-4' : 'size-4'}
            aria-hidden="true"
          />
          À réceptionner
        </dt>
        <dd className="text-foreground mt-2 text-xl font-bold tabular-nums sm:text-2xl">
          {metrics.ordersPendingDelivery}
        </dd>
        <p className="text-subtle-foreground mt-0.5 text-xs">
          {metrics.ordersPendingDelivery > 0 ? 'Livraisons attendues' : 'Livraisons à jour'}
        </p>
      </div>

      <div className="bg-surface p-3 sm:p-4">
        <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
          <Euro className="text-success size-4" aria-hidden="true" />
          Achats HT
        </dt>
        <dd className="text-foreground mt-2 text-xl font-bold tabular-nums sm:text-2xl">
          {periodSpend.amountEur.toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0,
          })}
        </dd>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <Dropdown
            align="start"
            trigger={
              <button
                type="button"
                className="min-h-touch text-primary hover:text-primary-hover inline-flex min-w-0 items-center gap-1 text-left text-xs font-semibold sm:min-h-0"
                title="Changer la période des achats"
              >
                <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{periodSpend.badgeText}</span>
                <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
              </button>
            }
          >
            <DropdownLabel>Période d’analyse</DropdownLabel>
            <DropdownItem onClick={() => setSelectedPeriod('current_month')}>
              Ce mois-ci ({currentMonthName})
            </DropdownItem>
            <DropdownItem onClick={() => setSelectedPeriod('last_month')}>
              Mois dernier ({prevMonthName})
            </DropdownItem>
            <DropdownItem onClick={() => setSelectedPeriod('current_year')}>
              Année {currentYear}
            </DropdownItem>
            <DropdownItem onClick={() => setSelectedPeriod('all')}>Tout l’historique</DropdownItem>
            <DropdownSeparator />
            <div className="space-y-1.5 p-2">
              <label
                htmlFor="purchaseskpicards-choisir-un-mois-precis"
                className="text-muted-foreground block text-xs font-semibold"
              >
                Choisir un mois
              </label>
              <Input
                id="purchaseskpicards-choisir-un-mois-precis"
                type="month"
                value={customMonth}
                onChange={(event) => {
                  if (event.target.value) {
                    setCustomMonth(event.target.value);
                    setSelectedPeriod('custom_month');
                  }
                }}
              />
            </div>
          </Dropdown>
          <span className="text-subtle-foreground shrink-0 text-xs">· {periodSpend.count} cmd</span>
        </div>
      </div>

      <div className="bg-surface p-3 sm:p-4">
        <dt className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
          <Store className="text-accent size-4" aria-hidden="true" />
          Fournisseurs actifs
        </dt>
        <dd className="text-foreground mt-2 text-xl font-bold tabular-nums sm:text-2xl">
          {metrics.activeSuppliersCount}
        </dd>
        <p className="text-subtle-foreground mt-0.5 text-xs">Partenaires référencés</p>
      </div>
    </dl>
  );
}
