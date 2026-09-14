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
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/Dropdown';
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
  const prevMonthDate = useMemo(() => new Date(now.getFullYear(), now.getMonth() - 1, 1), [now]);
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
          <Badge variant="success" className="text-3xs gap-1 px-1.5 py-0">
            <ArrowDownLeft className="size-3" />
            <span>{label}</span>
          </Badge>
        );
      case 'out':
        return (
          <Badge variant="error" className="text-3xs gap-1 px-1.5 py-0">
            <ArrowUpRight className="size-3" />
            <span>{label}</span>
          </Badge>
        );
      case 'transfer':
        return (
          <Badge variant="info" className="text-3xs gap-1 px-1.5 py-0">
            <ArrowRight className="size-3" />
            <span>{label}</span>
          </Badge>
        );
      case 'adjustment':
        return (
          <Badge variant="warning" className="text-3xs gap-1 px-1.5 py-0">
            <RefreshCw className="size-3" />
            <span>{label}</span>
          </Badge>
        );
    }
  }

  function renderMobileMovement(mov: StockMovement) {
    const variant = STOCK_MOVEMENT_TYPE_VARIANTS[mov.type];
    const location =
      mov.type === 'transfer'
        ? `${mov.locationFrom || 'Dépôt'} → ${mov.locationTo || 'Véhicule'}`
        : mov.locationFrom || mov.locationTo || 'Dépôt Central';

    return (
      <article key={mov.id} className="space-y-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="border-border bg-surface-subtle text-muted-foreground text-3xs inline-flex rounded-md border px-1.5 py-0.5 font-mono font-bold">
              {mov.consumableReference}
            </span>
            <p className="text-foreground mt-1 truncate text-sm font-semibold">
              {mov.consumableName}
            </p>
          </div>
          <span className={`shrink-0 font-mono text-base font-extrabold ${variant.color}`}>
            {variant.sign}
            {mov.quantity}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {renderTypeBadge(mov.type)}
          <span className="text-muted-foreground text-3xs inline-flex items-center gap-1 font-mono">
            <Calendar className="size-3.5" aria-hidden="true" />
            {new Date(mov.date).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
          {mov.interventionRef ? (
            <span className="bg-primary-subtle text-primary text-3xs rounded-md px-1.5 py-0.5 font-mono">
              {mov.interventionRef}
            </span>
          ) : null}
        </div>

        <p className="text-foreground text-xs leading-relaxed">{mov.reason}</p>

        <div className="border-border text-3xs text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span>{location}</span>
          {mov.technicianName ? (
            <span className="text-foreground inline-flex items-center gap-1 font-medium">
              <User className="size-3.5" aria-hidden="true" />
              {mov.technicianName}
            </span>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <Card className="border-border/80 bg-surface overflow-hidden shadow-xs">
      {/* Barre de recherche et filtres */}
      <div className="border-border space-y-3 border-b p-3 sm:p-4">
        <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
          {/* Champ de recherche */}
          <div className="min-w-0 flex-1">
            <Input
              label="Rechercher un mouvement de stock"
              hideLabel
              placeholder="Rechercher par article, motif, technicien, réf. intervention…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              leadingIcon={<Search aria-hidden="true" />}
              className="bg-surface-raised"
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
                  className="border-border bg-surface-raised text-foreground hover:border-accent/50 hover:bg-accent/10 focus-visible:ring-ring/30 inline-flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none sm:h-9 sm:flex-none"
                  title="Filtrer par mois ou période"
                >
                  <Calendar className="text-accent size-3.5 shrink-0" />
                  <span className="truncate">{periodBadgeText}</span>
                  <ChevronDown className="size-3 shrink-0 opacity-60" />
                </button>
              }
            >
              <DropdownLabel>Période d'affichage</DropdownLabel>
              <DropdownItem onClick={() => setSelectedPeriod('current_month')}>
                <Calendar aria-hidden="true" />
                <span className="text-xs">Ce mois-ci ({currentMonthName})</span>
              </DropdownItem>
              <DropdownItem onClick={() => setSelectedPeriod('last_month')}>
                <Calendar aria-hidden="true" />
                <span className="text-xs">Mois dernier ({prevMonthName})</span>
              </DropdownItem>
              <DropdownItem onClick={() => setSelectedPeriod('current_year')}>
                <Calendar aria-hidden="true" />
                <span className="text-xs">Année {currentYear}</span>
              </DropdownItem>
              <DropdownItem onClick={() => setSelectedPeriod('all')}>
                <RefreshCw aria-hidden="true" />
                <span className="text-xs">Tout l’historique</span>
              </DropdownItem>

              <DropdownSeparator />

              <div className="space-y-1.5 p-2">
                <label
                  htmlFor="stockmovementstable-choisir-un-mois-precis"
                  className="text-3xs text-muted-foreground block font-bold tracking-wider uppercase"
                >
                  Choisir un mois précis :
                </label>
                <Input
                  id="stockmovementstable-choisir-un-mois-precis"
                  type="month"
                  value={customMonth}
                  onChange={(e) => {
                    if (e.target.value) {
                      setCustomMonth(e.target.value);
                      setSelectedPeriod('custom_month');
                    }
                  }}
                  className="border-border bg-surface text-foreground focus:border-accent focus:ring-accent/25 h-11 w-full rounded-lg border px-2 text-xs focus:ring-2 focus:outline-none sm:h-8"
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
              className="border-border bg-surface-raised text-foreground focus:border-primary focus:ring-primary/25 h-11 min-w-0 flex-1 rounded-xl border px-2.5 py-1 text-xs focus:ring-2 focus:outline-none sm:h-9 sm:flex-none"
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
        <div className="text-muted-foreground px-4 py-10 text-center">
          <p className="text-sm font-semibold">Aucun mouvement pour cette sélection</p>
          <p className="text-2xs text-subtle-foreground mx-auto mt-1 max-w-md">
            Changez de période ou ajustez vos critères de recherche.
          </p>
        </div>
      ) : (
        <>
          <div className="divide-border divide-y md:hidden">
            {paginatedMovements.map(renderMobileMovement)}
          </div>
          <div className="hidden w-full overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-border bg-surface-raised/50 text-3xs text-muted-foreground border-b font-bold tracking-wider uppercase">
                  <th className="px-3 py-2.5 sm:px-4">Date &amp; Type</th>
                  <th className="px-3 py-2.5">Article Concerné</th>
                  <th className="px-3 py-2.5 text-center">Quantité</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Motif &amp; Justificatif</th>
                  <th className="px-3 py-2.5 text-right sm:px-4">Intervenant / Emplacement</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {paginatedMovements.map((mov) => {
                  const variant = STOCK_MOVEMENT_TYPE_VARIANTS[mov.type];

                  return (
                    <tr key={mov.id} className="hover:bg-surface-hover/50 transition-colors">
                      {/* 1. Date & Type */}
                      <td className="px-3 py-3 sm:px-4">
                        <div className="flex flex-col gap-1">
                          <div className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="text-subtle-foreground size-3" />
                            <span className="text-3xs font-mono">
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
                      <td className="px-3 py-3">
                        <span className="text-3xs text-muted-foreground bg-surface-raised border-border rounded border px-1.5 py-0.5 font-mono font-bold">
                          {mov.consumableReference}
                        </span>
                        <p className="text-foreground mt-0.5 text-xs leading-snug font-semibold">
                          {mov.consumableName}
                        </p>
                      </td>

                      {/* 3. Quantité */}
                      <td className="px-3 py-3 text-center">
                        <span className={`font-mono text-sm font-extrabold ${variant.color}`}>
                          {variant.sign}
                          {mov.quantity}
                        </span>
                      </td>

                      {/* 4. Motif & Justificatif */}
                      <td className="hidden px-3 py-3 md:table-cell">
                        <p className="text-foreground text-xs font-medium">{mov.reason}</p>
                        {mov.interventionRef && (
                          <span className="text-3xs text-primary bg-primary/10 mt-0.5 inline-block rounded px-1 py-0.5 font-mono">
                            Réf : {mov.interventionRef}
                          </span>
                        )}
                      </td>

                      {/* 5. Intervenant / Trajet */}
                      <td className="px-3 py-3 text-right sm:px-4">
                        {mov.technicianName && (
                          <div className="text-foreground inline-flex items-center gap-1 text-xs font-medium">
                            <User className="text-muted-foreground size-3" />
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
        </>
      )}

      {/* Pagination & Compteur */}
      {filteredMovements.length > 0 && (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-between gap-3 border-t p-3 text-xs sm:flex-row sm:p-4">
          <div>
            Affichage de{' '}
            <span className="text-foreground font-semibold">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}
            </span>{' '}
            à{' '}
            <span className="text-foreground font-semibold">
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredMovements.length)}
            </span>{' '}
            sur <span className="text-foreground font-semibold">{filteredMovements.length}</span>{' '}
            mouvement{filteredMovements.length > 1 ? 's' : ''}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-11 px-2 text-xs sm:h-8"
              >
                <ChevronLeft className="size-3.5" />
                <span className="hidden sm:inline">Précédent</span>
              </Button>

              <span className="text-foreground px-2 text-xs font-semibold">
                Page {currentPage} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-11 px-2 text-xs sm:h-8"
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
