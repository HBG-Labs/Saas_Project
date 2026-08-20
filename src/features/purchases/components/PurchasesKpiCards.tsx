import {
  Calendar,
  ChevronDown,
  Clock,
  Euro,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Card } from '@/components/ui/Card';
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from '@/components/ui/Dropdown';
import type { PurchaseMetrics, PurchaseOrder } from '../types/purchases.types';

export type PurchasePeriod =
  | 'current_month'
  | 'last_month'
  | 'custom_month'
  | 'current_year'
  | 'all';

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
  const now = new Date();
  const currentMonthName = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
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
  ]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {/* 1. Total Commandes */}
      <Card className="border-blue-500/20 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Commandes
            </p>
            <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">
              {metrics.totalOrders}
            </p>
            <p className="text-2xs text-muted-foreground mt-0.5">
              {metrics.ordersDraft} brouillon{metrics.ordersDraft > 1 ? 's' : ''}
            </p>
          </div>
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex bg-blue-500/10 text-primary border border-blue-500/20">
            <ShoppingCart className="size-5" />
          </div>
        </div>
      </Card>

      {/* 2. En attente de livraison */}
      <Card
        className={`p-3 sm:p-4 transition-colors ${
          metrics.ordersPendingDelivery > 0
            ? 'border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10'
            : 'border-border'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`text-2xs font-semibold uppercase tracking-wider ${
                metrics.ordersPendingDelivery > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground'
              }`}
            >
              En Attente Livraison
            </p>
            <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">
              {metrics.ordersPendingDelivery}
            </p>
            <p className="text-2xs text-muted-foreground mt-0.5">
              {metrics.ordersPendingDelivery > 0
                ? 'Marchandises à réceptionner'
                : 'Toutes livraisons à jour'}
            </p>
          </div>
          <div
            className={`hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex ${
              metrics.ordersPendingDelivery > 0
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                : 'bg-surface-raised text-muted-foreground border border-border'
            }`}
          >
            <Clock className="size-5" />
          </div>
        </div>
      </Card>

      {/* 3. Dépenses engagées avec menu calendrier qui s'ouvre proprement sans chevauchement */}
      <Card className="border-emerald-500/20 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
              Achats HT
            </p>

            <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl font-mono">
              {periodSpend.amountEur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              })}
            </p>

            {/* Bouton calendrier ouvrant le menu de sélection de période */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <Dropdown
                align="start"
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg bg-surface-raised px-2 py-0.5 text-3xs font-semibold text-foreground border border-border hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-colors cursor-pointer max-w-full truncate"
                    title="Cliquer pour changer le mois ou la période"
                  >
                    <Calendar className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">{periodSpend.badgeText}</span>
                    <ChevronDown className="size-2.5 opacity-60 shrink-0" />
                  </button>
                }
              >
                <DropdownLabel>Période d'analyse des achats</DropdownLabel>
                <DropdownItem onClick={() => setSelectedPeriod('current_month')}>
                  <span className="text-xs">📌 Ce mois-ci ({currentMonthName})</span>
                </DropdownItem>
                <DropdownItem onClick={() => setSelectedPeriod('last_month')}>
                  <span className="text-xs">📅 Mois dernier ({prevMonthName})</span>
                </DropdownItem>
                <DropdownItem onClick={() => setSelectedPeriod('current_year')}>
                  <span className="text-xs">📊 Année {currentYear}</span>
                </DropdownItem>
                <DropdownItem onClick={() => setSelectedPeriod('all')}>
                  <span className="text-xs">🌐 Tout l’historique</span>
                </DropdownItem>

                <DropdownSeparator />

                <div className="p-2 space-y-1.5">
                  <label className="block text-3xs font-bold text-muted-foreground uppercase tracking-wider">
                    Choisir un mois précis :
                  </label>
                  <input
                    type="month"
                    value={customMonth}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCustomMonth(e.target.value);
                        setSelectedPeriod('custom_month');
                      }
                    }}
                    className="w-full h-7 rounded-lg border border-border bg-surface px-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none cursor-pointer"
                  />
                </div>
              </Dropdown>

              <span className="text-3xs text-muted-foreground shrink-0">
                ({periodSpend.count} cmd{periodSpend.count > 1 ? 's' : ''})
              </span>
            </div>
          </div>

          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ml-2">
            <Euro className="size-5" />
          </div>
        </div>
      </Card>

      {/* 4. Fournisseurs Référencés */}
      <Card className="border-purple-500/20 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Fournisseurs Actifs
            </p>
            <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">
              {metrics.activeSuppliersCount}
            </p>
            <p className="text-2xs text-muted-foreground mt-0.5">
              Partenaires &amp; Grossistes
            </p>
          </div>
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Store className="size-5" />
          </div>
        </div>
      </Card>
    </div>
  );
}
