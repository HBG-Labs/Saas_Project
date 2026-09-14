import { Input } from '@/components/ui/Input';
import { Calendar, ChevronDown, Clock, Euro, ShoppingCart, Store } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Card } from '@/components/ui/Card';
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
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {/* 1. Total Commandes */}
      <Card className="before:bg-primary/70 hover:border-primary/35 hover:shadow-raised border-border/80 relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs text-muted-foreground font-semibold tracking-wider uppercase">
              Total Commandes
            </p>
            <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">
              {metrics.totalOrders}
            </p>
            <p className="text-2xs text-muted-foreground mt-0.5">
              {metrics.ordersDraft} brouillon{metrics.ordersDraft > 1 ? 's' : ''}
            </p>
          </div>
          <div className="bg-primary/10 text-primary border-primary/20 hidden size-10 shrink-0 items-center justify-center rounded-xl border sm:flex">
            <ShoppingCart className="size-5" />
          </div>
        </div>
      </Card>

      {/* 2. En attente de livraison */}
      <Card
        className={`before:bg-warning/70 hover:shadow-raised relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:p-4 ${
          metrics.ordersPendingDelivery > 0
            ? 'border-warning/30 bg-warning/5 dark:bg-warning/10'
            : 'border-border'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`text-2xs font-semibold tracking-wider uppercase ${
                metrics.ordersPendingDelivery > 0 ? 'text-warning' : 'text-muted-foreground'
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
                ? 'bg-warning/15 text-warning border-warning/30 border'
                : 'bg-surface-raised text-muted-foreground border-border border'
            }`}
          >
            <Clock className="size-5" />
          </div>
        </div>
      </Card>

      {/* 3. Dépenses engagées avec menu calendrier qui s'ouvre proprement sans chevauchement */}
      <Card className="before:bg-success/70 hover:border-success/35 hover:shadow-raised border-border/80 relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-2xs text-success truncate font-semibold tracking-wider uppercase">
              Achats HT
            </p>

            <p className="text-foreground mt-1 font-mono text-xl font-bold sm:text-2xl">
              {periodSpend.amountEur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              })}
            </p>

            {/* Bouton calendrier ouvrant le menu de sélection de période */}
            <div className="mt-1.5 flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center">
              <Dropdown
                align="start"
                trigger={
                  <button
                    type="button"
                    className="min-h-touch border-border bg-surface-raised text-3xs text-foreground hover:border-success/50 hover:bg-success/10 inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-lg border px-2 py-0.5 font-semibold transition-colors sm:min-h-0"
                    title="Cliquer pour changer le mois ou la période"
                  >
                    <Calendar className="text-success size-3 shrink-0" />
                    <span className="truncate">{periodSpend.badgeText}</span>
                    <ChevronDown className="size-2.5 shrink-0 opacity-60" />
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

                <div className="space-y-1.5 p-2">
                  <label
                    htmlFor="purchaseskpicards-choisir-un-mois-precis"
                    className="text-3xs text-muted-foreground block font-bold tracking-wider uppercase"
                  >
                    Choisir un mois précis :
                  </label>
                  <Input
                    id="purchaseskpicards-choisir-un-mois-precis"
                    type="month"
                    value={customMonth}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCustomMonth(e.target.value);
                        setSelectedPeriod('custom_month');
                      }
                    }}
                    className="border-border bg-surface text-foreground focus:border-success h-7 w-full cursor-pointer rounded-lg border px-2 text-xs focus:outline-none"
                  />
                </div>
              </Dropdown>

              <span className="text-3xs text-muted-foreground shrink-0">
                ({periodSpend.count} cmd{periodSpend.count > 1 ? 's' : ''})
              </span>
            </div>
          </div>

          <div className="bg-success/10 text-success border-success/20 ml-2 hidden size-10 shrink-0 items-center justify-center rounded-xl border sm:flex">
            <Euro className="size-5" />
          </div>
        </div>
      </Card>

      {/* 4. Fournisseurs Référencés */}
      <Card className="before:bg-accent/70 hover:border-accent/35 hover:shadow-raised border-border/80 relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs text-accent font-semibold tracking-wider uppercase">
              Fournisseurs Actifs
            </p>
            <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">
              {metrics.activeSuppliersCount}
            </p>
            <p className="text-2xs text-muted-foreground mt-0.5">Partenaires &amp; Grossistes</p>
          </div>
          <div className="bg-accent/10 text-accent border-accent/20 hidden size-10 shrink-0 items-center justify-center rounded-xl border sm:flex">
            <Store className="size-5" />
          </div>
        </div>
      </Card>
    </div>
  );
}
