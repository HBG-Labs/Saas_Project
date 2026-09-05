import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  Calendar,
  ChevronDown,
  Euro,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Card } from '@/components/ui/Card';
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from '@/components/ui/Dropdown';
import type { StockMetrics, StockMovement } from '../types/stock.types';

export type StockPeriod =
  | 'current_month'
  | 'last_month'
  | 'custom_month'
  | 'current_year'
  | 'all';

interface StockKpiCardsProps {
  metrics: StockMetrics;
  movements?: StockMovement[] | undefined;
  selectedPeriod?: StockPeriod | undefined;
  onPeriodChange?: ((period: StockPeriod) => void) | undefined;
  customMonth?: string | undefined;
  onCustomMonthChange?: ((month: string) => void) | undefined;
}

export function StockKpiCards({
  metrics,
  movements = [],
  selectedPeriod: externalPeriod,
  onPeriodChange: externalOnPeriodChange,
  customMonth: externalCustomMonth,
  onCustomMonthChange: externalOnCustomMonthChange,
}: StockKpiCardsProps) {
  // Gestion d'état local si non contrôlé
  const [internalPeriod, setInternalPeriod] = useState<StockPeriod>('current_month');
  const [internalCustomMonth, setInternalCustomMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );

  const selectedPeriod = externalPeriod ?? internalPeriod;
  const setSelectedPeriod = externalOnPeriodChange ?? setInternalPeriod;
  const customMonth = externalCustomMonth ?? internalCustomMonth;
  const setCustomMonth = externalOnCustomMonthChange ?? setInternalCustomMonth;

  // Mois actuel et précédent pour affichage dynamique
  const now = new Date();
  const currentMonthName = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthName = prevMonthDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const currentYear = now.getFullYear();

  const periodData = useMemo(() => {
    if (!movements || movements.length === 0) {
      return {
        count: metrics.movementsCountMonth,
        badgeText: currentMonthName,
      };
    }

    const currentYearNum = now.getFullYear();
    const currentMonthNum = now.getMonth();

    let filtered = movements;
    let badgeText = currentMonthName;

    if (selectedPeriod === 'current_month') {
      badgeText = currentMonthName;
      filtered = filtered.filter((m) => {
        const d = new Date(m.date);
        return d.getFullYear() === currentYearNum && d.getMonth() === currentMonthNum;
      });
    } else if (selectedPeriod === 'last_month') {
      badgeText = prevMonthName;
      const prevYearNum = prevMonthDate.getFullYear();
      const prevMonthIdx = prevMonthDate.getMonth();
      filtered = filtered.filter((m) => {
        const d = new Date(m.date);
        return d.getFullYear() === prevYearNum && d.getMonth() === prevMonthIdx;
      });
    } else if (selectedPeriod === 'custom_month' && customMonth) {
      const [yStr, mStr] = customMonth.split('-');
      const targetYear = Number(yStr);
      const targetMonth = Number(mStr) - 1;
      const targetDate = new Date(targetYear, targetMonth, 1);
      const formattedMonth = targetDate.toLocaleString('fr-FR', {
        month: 'long',
        year: 'numeric',
      });
      badgeText = formattedMonth;
      filtered = filtered.filter((mov) => {
        const d = new Date(mov.date);
        return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
      });
    } else if (selectedPeriod === 'current_year') {
      badgeText = `Année ${currentYear}`;
      filtered = filtered.filter((m) => {
        const d = new Date(m.date);
        return d.getFullYear() === currentYearNum;
      });
    } else {
      badgeText = 'Historique global';
    }

    return {
      count: filtered.length,
      badgeText,
    };
  }, [
    movements,
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
      {/* 1. Total Articles */}
      <Card className="border-primary/20 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Articles Référencés
            </p>
            <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">
              {metrics.totalArticles}
            </p>
            <p className="text-2xs text-muted-foreground mt-0.5">
              {metrics.totalQuantity} unités en stock
            </p>
          </div>
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex bg-primary/10 text-primary border border-primary/20">
            <Boxes className="size-5" />
          </div>
        </div>
      </Card>

      {/* 2. Alertes Stock Faible */}
      <Card
        className={`p-3 sm:p-4 transition-colors ${
          metrics.lowStockCount > 0
            ? 'border-warning/30 bg-warning/5 dark:bg-warning/10'
            : 'border-border'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`text-2xs font-semibold uppercase tracking-wider ${
                metrics.lowStockCount > 0 ? 'text-warning' : 'text-muted-foreground'
              }`}
            >
              Stock Faible &amp; Alertes
            </p>
            <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">
              {metrics.lowStockCount}
            </p>
            <p className="text-2xs text-muted-foreground mt-0.5">
              {metrics.lowStockCount > 0
                ? 'Réapprovisionnement requis'
                : 'Tous les stocks sont au vert'}
            </p>
          </div>
          <div
            className={`hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex ${
              metrics.lowStockCount > 0
                ? 'bg-warning/15 text-warning border border-warning/30'
                : 'bg-surface-raised text-muted-foreground border border-border'
            }`}
          >
            <AlertTriangle className="size-5" />
          </div>
        </div>
      </Card>

      {/* 3. Valeur Totale du Stock */}
      <Card className="border-success/20 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-success">
              Valeur Totale du Stock
            </p>
            <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">
              {metrics.totalValueEur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-2xs text-muted-foreground mt-0.5">Prix d’achat total HT</p>
          </div>
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex bg-success/10 text-success border border-success/20">
            <Euro className="size-5" />
          </div>
        </div>
      </Card>

      {/* 4. Mouvements avec menu calendrier sans chevauchement */}
      <Card className="border-accent/20 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-semibold uppercase leading-snug tracking-wider text-accent">
              Mouvements Stock
            </p>
            <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl font-mono">
              {periodData.count}
            </p>

            {/* Bouton calendrier ouvrant le menu de sélection de période */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <Dropdown
                align="start"
                trigger={
                  <button
                    type="button"
                    className="min-h-touch sm:min-h-0 inline-flex items-center gap-1 rounded-lg bg-surface-raised px-2 py-0.5 text-3xs font-semibold text-foreground border border-border hover:border-accent/50 hover:bg-accent/10 transition-colors cursor-pointer max-w-full truncate"
                    title="Cliquer pour changer le mois ou la période"
                  >
                    <Calendar className="size-3 text-accent shrink-0" />
                    <span className="truncate">{periodData.badgeText}</span>
                    <ChevronDown className="size-2.5 opacity-60 shrink-0" />
                  </button>
                }
              >
                <DropdownLabel>Période des mouvements</DropdownLabel>
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
                  <label htmlFor="stockkpicards-choisir-un-mois-precis" className="block text-3xs font-bold text-muted-foreground uppercase tracking-wider">
                    Choisir un mois précis :
                  </label>
                  <input id="stockkpicards-choisir-un-mois-precis"
                    type="month"
                    value={customMonth}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCustomMonth(e.target.value);
                        setSelectedPeriod('custom_month');
                      }
                    }}
                    className="w-full h-8 rounded-lg border border-border bg-surface px-2 text-xs text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </Dropdown>
            </div>
          </div>
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex bg-accent/10 text-accent border border-accent/20">
            <ArrowLeftRight className="size-5" />
          </div>
        </div>
      </Card>
    </div>
  );
}
