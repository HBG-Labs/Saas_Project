import { Flag, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { HOLIDAY_TERRITORIES } from '../public-holidays';
import type { PublicHoliday, HolidayTerritory } from '../types';

interface PublicHolidaysTabProps {
  holidays: PublicHoliday[];
  selectedTerritory: HolidayTerritory;
  onSelectTerritory: (territory: HolidayTerritory) => void;
}

export function PublicHolidaysTab({
  holidays,
  selectedTerritory,
  onSelectTerritory,
}: PublicHolidaysTabProps) {
  const currentTerritory =
    HOLIDAY_TERRITORIES.find((t) => t.id === selectedTerritory) || HOLIDAY_TERRITORIES[0];

  return (
    <div className="space-y-4">
      {/* 1. Header with Territory Selector */}
      <div className="bg-surface p-4 rounded-2xl border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-foreground">
              Calendrier des Jours Fériés Légaux
            </h3>
            <span className="text-base" title={currentTerritory?.label}>
              {currentTerritory?.flag}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Calcul automatique des jours ouvrés, astreintes et majorations selon le territoire
          </p>
        </div>

        {/* Territory Dropdown Selector */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-1.5 bg-surface-subtle px-2.5 py-1 rounded-xl border border-border">
            <Globe className="size-3.5 text-primary shrink-0" />
            <span className="text-3xs text-muted-foreground font-semibold">Territoire :</span>
            <select
              value={selectedTerritory}
              onChange={(e) => onSelectTerritory(e.target.value as HolidayTerritory)}
              className="bg-transparent text-xs font-bold text-foreground focus:outline-hidden cursor-pointer"
            >
              {HOLIDAY_TERRITORIES.map((t) => (
                <option key={t.id} value={t.id} className="bg-surface text-foreground">
                  {t.flag} {t.label}
                </option>
              ))}
            </select>
          </div>

          <Badge variant="primary" className="text-3xs font-mono">
            {holidays.length} Fériés ({new Date().getFullYear()})
          </Badge>
        </div>
      </div>

      {/* 2. Quick Territory Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {HOLIDAY_TERRITORIES.map((t) => {
          const isSelected = selectedTerritory === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTerritory(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-surface text-muted-foreground border-border hover:text-foreground hover:bg-surface-hover',
              )}
            >
              <span>{t.flag}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Holidays Grid Compact Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {holidays.map((h) => {
          const isSpecific = h.territory && h.territory !== 'national';

          return (
            <div
              key={`${h.date}-${h.name}`}
              className={cn(
                'p-2.5 rounded-xl bg-surface border shadow-2xs flex items-center justify-between gap-1.5 transition-all hover:border-border-strong',
                isSpecific
                  ? 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10'
                  : 'border-border',
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  className={cn(
                    'size-6.5 rounded-lg flex items-center justify-center font-bold border shrink-0',
                    isSpecific
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                  )}
                >
                  <Flag className="size-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-foreground truncate leading-tight" title={h.name}>
                    {h.name}
                  </h4>
                  <p className="text-3xs text-muted-foreground font-mono leading-tight mt-0.5">{h.date}</p>
                </div>
              </div>

              <span
                className={cn(
                  'text-[9px] font-medium px-1.5 py-0.5 rounded-md shrink-0 leading-none tracking-tight',
                  isSpecific
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
                )}
              >
                Férié
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
