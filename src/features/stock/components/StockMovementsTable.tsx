import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from '@/components/ui/Dropdown';
import type { StockPeriod } from './StockKpiCards';
import {
  STOCK_MOVEMENT_TYPE_LABELS,
  STOCK_MOVEMENT_TYPE_VARIANTS,
  type StockMovement,
  type StockMovementType,
} from '../types/stock.types';

interface StockMovementsTableProps {
  movements: StockMovement[];
  selectedPeriod?: StockPeriod | undefined;
  onPeriodChange?: ((period: StockPeriod) => void) | undefined;
  customMonth?: string | undefined;
  onCustomMonthChange?: ((month: string) => void) | undefined;
}

const ITEMS_PER_PAGE = 15;

export function StockMovementsTable({
  movements,
  selectedPeriod: externalPeriod,
  onPeriodChange: externalOnPeriodChange,
  customMonth: externalCustomMonth,
  onCustomMonthChange: externalOnCustomMonthChange,
}: StockMovementsTableProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Gestion d'état local si non contrôlé par le parent
  const [internalPeriod, setInternalPeriod] = useState<StockPeriod>('current_month');
  const [internalCustomMonth, setInternalCustomMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );

  const selectedPeriod = externalPeriod ?? internalPeriod;
  const setSelectedPeriod = (p: StockPeriod) => {
    setCurrentPage(1);
    if (externalOnPeriodChange) {
      externalOnPeriodChange(p);
    } else {
      setInternalPeriod(p);
    }
  };

  const customMonth = externalCustomMonth ?? internalCustomMonth;
  const setCustomMonth = (m: string) => {
    setCurrentPage(1);
    if (externalOnCustomMonthChange) {
      externalOnCustomMonthChange(m);
    } else {
      setInternalCustomMonth(m);
    }
  };

  // Mois actuel et précédent pour affichage dynamique
  const now = useMemo(() => new Date(), []);
  const currentMonthName = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const prevMonthDate = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() - 1, 1),
    [now],
  );
  const prevMonthName = prevMonthDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const currentYear = now.getFullYear();

  const periodBadgeText = useMemo(() => {
    if (selectedPeriod === 'current_month') return currentMonthName;
    if (selectedPeriod === 'last_month') return prevMonthName;
    if (selectedPeriod === 'current_year') return `Année ${currentYear}`;
    if (selectedPeriod === 'custom_month' && customMonth) {
      const [yStr, mStr] = customMonth.split('-');
      const targetDate = new Date(Number(yStr), Number(mStr) - 1, 1);
      return targetDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    }
    return 'Historique global';
  }, [selectedPeriod, customMonth, currentMonthName, prevMonthName, currentYear]);

  const filteredMovements = useMemo(() => {
    const currentYearNum = now.getFullYear();
    const currentMonthNum = now.getMonth();

    return movements.filter((mov) => {
      // 1. Filtre par période / date
      if (selectedPeriod === 'current_month') {
        const d = new Date(mov.date);
        if (d.getFullYear() !== currentYearNum || d.getMonth() !== currentMonthNum) {
          return false;
        }
      } else if (selectedPeriod === 'last_month') {
        const d = new Date(mov.date);
        const prevYearNum = prevMonthDate.getFullYear();
        const prevMonthIdx = prevMonthDate.getMonth();
        if (d.getFullYear() !== prevYearNum || d.getMonth() !== prevMonthIdx) {
          return false;
        }
      } else if (selectedPeriod === 'custom_month' && customMonth) {
        const [yStr, mStr] = customMonth.split('-');
        const y = Number(yStr);
        const m = Number(mStr) - 1;
        const d = new Date(mov.date);
        if (d.getFullYear() !== y || d.getMonth() !== m) {
          return false;
        }
      } else if (selectedPeriod === 'current_year') {
        const d = new Date(mov.date);
        if (d.getFullYear() !== currentYearNum) {
          return false;
        }
      }

      // 2. Filtre de recherche
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        mov.consumableName.toLowerCase().includes(q) ||
        mov.consumableReference.toLowerCase().includes(q) ||
        mov.reason.toLowerCase().includes(q) ||
        (mov.technicianName && mov.technicianName.toLowerCase().includes(q)) ||
        (mov.interventionRef && mov.interventionRef.toLowerCase().includes(q));

      // 3. Filtre de type
      const matchesType = typeFilter === 'all' || mov.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [movements, search, typeFilter, selectedPeriod, customMonth, prevMonthDate, now]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / ITEMS_PER_PAGE));
  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMovements.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMovements, currentPage]);

  function renderTypeBadge(type: StockMovementType) {
    const label = STOCK_MOVEMENT_TYPE_LABELS[type];

    switch (type) {
      case 'in':
        return (
          <Badge variant="success" className="gap-1 text-3xs py-0 px-1.5">
            <ArrowDownLeft className="size-3" />
            <span>{label}</span>
          </Badge>
        );
      case 'out':
        return (
          <Badge variant="error" className="gap-1 text-3xs py-0 px-1.5">
            <ArrowUpRight className="size-3" />
            <span>{label}</span>
          </Badge>
        );
      case 'transfer':
        return (
          <Badge variant="info" className="gap-1 text-3xs py-0 px-1.5">
            <ArrowRight className="size-3" />
            <span>{label}</span>
          </Badge>
        );
      case 'adjustment':
        return (
          <Badge variant="warning" className="gap-1 text-3xs py-0 px-1.5">
            <RefreshCw className="size-3" />
            <span>{label}</span>
          </Badge>
        );
    }
  }

  return (
    <Card className="border-border bg-surface shadow-xs">
      {/* Barre de recherche et filtres */}
      <div className="p-3 sm:p-4 border-b border-border space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Champ de recherche */}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par article, motif, technicien, réf. intervention…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-xl border border-border bg-surface-raised pl-9 pr-4 text-xs text-foreground placeholder:text-subtle-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filtres déroulants et menu calendrier */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {/* Popover Période / Calendrier */}
            <Dropdown
              align="end"
              trigger={
                <button
                  type="button"
                  className="h-9 min-w-0 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 py-1 text-xs font-semibold text-foreground hover:border-accent/50 hover:bg-accent/10 transition-colors cursor-pointer sm:flex-none"
                  title="Filtrer par mois ou période"
                >
                  <Calendar className="size-3.5 text-accent shrink-0" />
                  <span className="truncate">{periodBadgeText}</span>
                  <ChevronDown className="size-3 opacity-60 shrink-0" />
                </button>
              }
            >
              <DropdownLabel>Période d'affichage</DropdownLabel>
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
                <label htmlFor="stockmovementstable-choisir-un-mois-precis" className="block text-3xs font-bold text-muted-foreground uppercase tracking-wider">
                  Choisir un mois précis :
                </label>
                <Input id="stockmovementstable-choisir-un-mois-precis"
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

            {/* Filtre Type de mouvement */}
            <SelectField
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:flex-none"
            >
              <option value="all">Tous les types</option>
              <option value="in">Entrées (Réceptions)</option>
              <option value="out">Sorties (Chantiers)</option>
              <option value="transfer">Transferts (Véhicules)</option>
              <option value="adjustment">Régularisations (Inventaire)</option>
            </SelectField>
          </div>
        </div>
      </div>

      {paginatedMovements.length === 0 ? (
        <div className="px-4 py-10 text-center text-muted-foreground">
          <p className="text-sm font-semibold">Aucun mouvement pour cette sélection</p>
          <p className="mx-auto mt-1 max-w-md text-2xs text-subtle-foreground">
            Changez de période ou ajustez vos critères de recherche.
          </p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[640px] w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50 text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="py-2.5 px-3 sm:px-4">Date &amp; Type</th>
                <th className="py-2.5 px-3">Article Concerné</th>
                <th className="py-2.5 px-3 text-center">Quantité</th>
                <th className="py-2.5 px-3 hidden md:table-cell">Motif &amp; Justificatif</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Intervenant / Emplacement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedMovements.map((mov) => {
              const variant = STOCK_MOVEMENT_TYPE_VARIANTS[mov.type];

              return (
                <tr
                  key={mov.id}
                  className="hover:bg-surface-hover/50 transition-colors"
                >
                  {/* 1. Date & Type */}
                  <td className="py-3 px-3 sm:px-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="size-3 text-subtle-foreground" />
                        <span className="font-mono text-3xs">
                          {new Date(mov.date).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div>{renderTypeBadge(mov.type)}</div>
                    </div>
                  </td>

                  {/* 2. Article & Réf */}
                  <td className="py-3 px-3">
                    <span className="font-mono text-3xs font-bold text-muted-foreground bg-surface-raised px-1.5 py-0.5 rounded border border-border">
                      {mov.consumableReference}
                    </span>
                    <p className="font-semibold text-foreground text-xs leading-snug mt-0.5">
                      {mov.consumableName}
                    </p>
                  </td>

                  {/* 3. Quantité */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`font-mono text-sm font-extrabold ${variant.color}`}
                    >
                      {variant.sign}
                      {mov.quantity}
                    </span>
                  </td>

                  {/* 4. Motif & Justificatif */}
                  <td className="py-3 px-3 hidden md:table-cell">
                    <p className="text-foreground text-xs font-medium">
                      {mov.reason}
                    </p>
                    {mov.interventionRef && (
                      <span className="text-3xs font-mono text-primary bg-primary/10 px-1 py-0.5 rounded mt-0.5 inline-block">
                        Réf : {mov.interventionRef}
                      </span>
                    )}
                  </td>

                  {/* 5. Intervenant / Trajet */}
                  <td className="py-3 px-3 sm:px-4 text-right">
                    {mov.technicianName && (
                      <div className="inline-flex items-center gap-1 text-foreground font-medium text-xs">
                        <User className="size-3 text-muted-foreground" />
                        <span>{mov.technicianName}</span>
                      </div>
                    )}
                    <div className="text-3xs text-subtle-foreground mt-0.5">
                      {mov.type === 'transfer' ? (
                        <span>
                          {mov.locationFrom || 'Dépôt'} → {mov.locationTo || 'Véhicule'}
                        </span>
                      ) : (
                        <span>{mov.locationFrom || mov.locationTo || 'Dépôt Central'}</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination & Compteur */}
      {filteredMovements.length > 0 && (
        <div className="p-3 sm:p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            Affichage de{' '}
            <span className="font-semibold text-foreground">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}
            </span>{' '}
            à{' '}
            <span className="font-semibold text-foreground">
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredMovements.length)}
            </span>{' '}
            sur{' '}
            <span className="font-semibold text-foreground">
              {filteredMovements.length}
            </span>{' '}
            mouvement{filteredMovements.length > 1 ? 's' : ''}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2 text-xs"
              >
                <ChevronLeft className="size-3.5" />
                <span className="hidden sm:inline">Précédent</span>
              </Button>

              <span className="px-2 text-xs font-semibold text-foreground">
                Page {currentPage} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-2 text-xs"
              >
                <span className="hidden sm:inline">Suivant</span>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
