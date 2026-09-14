import { Input } from '@/components/ui/Input';
import { AlertTriangle, ArrowLeftRight, Boxes, Calendar, ChevronDown, Euro } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Card } from '@/components/ui/Card';
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/Dropdown';
import type { StockMetrics, StockMovement } from '../types/stock.types';

export type StockPeriod = 'current_month' | 'last_month' | 'custom_month' | 'current_year' | 'all';

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
  const now = useMemo(() => new Date(), []);
  const currentMonthName = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const prevMonthDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), [now]);
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
    now,
  ]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {/* 1. Total Articles */}
      <Card className="before:bg-primary/70 hover:border-primary/35 hover:shadow-raised border-border/80 relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs text-muted-foreground font-semibold tracking-wider uppercase">
              Articles Référencés
            </p>
            <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">
              {metrics.totalArticles}
            </p>
            <p className="text-2xs text-muted-foreground mt-0.5">
              {metrics.totalQuantity} unités en stock
            </p>
          </div>
          <div className="bg-primary/10 text-primary border-primary/20 hidden size-10 shrink-0 items-center justify-center rounded-xl border sm:flex">
            <Boxes className="size-5" />
          </div>
        </div>
      </Card>

      {/* 2. Alertes Stock Faible */}
      <Card
        className={`before:bg-warning/70 hover:shadow-raised relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:p-4 ${
          metrics.lowStockCount > 0
            ? 'border-warning/30 bg-warning/5 dark:bg-warning/10'
            : 'border-border'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`text-2xs font-semibold tracking-wider uppercase ${
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
                ? 'bg-warning/15 text-warning border-warning/30 border'
                : 'bg-surface-raised text-muted-foreground border-border border'
            }`}
          >
            <AlertTriangle className="size-5" />
          </div>
        </div>
      </Card>

      {/* 3. Valeur Totale du Stock */}
      <Card className="before:bg-success/70 hover:border-success/35 hover:shadow-raised border-border/80 relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs text-success font-semibold tracking-wider uppercase">
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
          <div className="bg-success/10 text-success border-success/20 hidden size-10 shrink-0 items-center justify-center rounded-xl border sm:flex">
            <Euro className="size-5" />
          </div>
        </div>
      </Card>

      {/* 4. Mouvements avec menu calendrier sans chevauchement */}
      <Card className="before:bg-accent/70 hover:border-accent/35 hover:shadow-raised border-border/80 relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-2xs text-accent leading-snug font-semibold tracking-wider uppercase">
              Mouvements Stock
            </p>
            <p className="text-foreground mt-1 font-mono text-xl font-bold sm:text-2xl">
              {periodData.count}
            </p>

            {/* Bouton calendrier ouvrant le menu de sélection de période */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <Dropdown
                align="start"
                trigger={
                  <button
                    type="button"
                    className="min-h-touch bg-surface-raised text-3xs text-foreground border-border hover:border-accent/50 hover:bg-accent/10 inline-flex max-w-full cursor-pointer items-center gap-1 truncate rounded-lg border px-2 py-0.5 font-semibold transition-colors sm:min-h-0"
                    title="Cliquer pour changer le mois ou la période"
                  >
                    <Calendar className="text-accent size-3 shrink-0" />
                    <span className="truncate">{periodData.badgeText}</span>
                    <ChevronDown className="size-2.5 shrink-0 opacity-60" />
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

                <div className="space-y-1.5 p-2">
                  <label
                    htmlFor="stockkpicards-choisir-un-mois-precis"
                    className="text-3xs text-muted-foreground block font-bold tracking-wider uppercase"
                  >
                    Choisir un mois précis :
                  </label>
                  <Input
                    id="stockkpicards-choisir-un-mois-precis"
                    type="month"
                    value={customMonth}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCustomMonth(e.target.value);
                        setSelectedPeriod('custom_month');
                      }
                    }}
                    className="border-border bg-surface text-foreground focus:border-accent focus:ring-accent h-8 w-full rounded-lg border px-2 text-xs focus:ring-1 focus:outline-none"
                  />
                </div>
              </Dropdown>
            </div>
          </div>
          <div className="bg-accent/10 text-accent border-accent/20 hidden size-10 shrink-0 items-center justify-center rounded-xl border sm:flex">
            <ArrowLeftRight className="size-5" />
          </div>
        </div>
      </Card>
    </div>
  );
}
