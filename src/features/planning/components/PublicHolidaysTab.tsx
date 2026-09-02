import { Flag } from 'lucide-react';
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
      {/* 1. Header with Territory Badge */}
      <div className="bg-surface p-4 rounded-2xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        <Badge variant="primary" className="text-3xs font-mono self-start sm:self-auto shrink-0">
          {holidays.length} Fériés ({new Date().getFullYear()})
        </Badge>
      </div>

      {/* 2. Quick Territory Filter Chips with Scroll Affordance on Mobile */}
      <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap pb-1 pr-6 sm:pr-0">
          {HOLIDAY_TERRITORIES.map((t) => {
            const isSelected = selectedTerritory === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTerritory(t.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer active:scale-[0.98]',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-surface text-muted-foreground border-border hover:text-foreground hover:bg-surface-hover',
                )}
              >
                <span>{t.flag}</span>
                <span className="sm:hidden">{t.shortLabel}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mobile subtle gradient scroll fade cue */}
        <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden flex items-center justify-end pr-1 text-primary/70 text-xs font-bold">
          ›
        </div>
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
                  ? 'border-warning/40 bg-warning/5 dark:bg-warning/10'
                  : 'border-border',
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  className={cn(
                    'size-6.5 rounded-lg flex items-center justify-center font-bold border shrink-0',
                    isSpecific
                      ? 'bg-warning/15 text-warning border-warning/30'
                      : 'bg-error/10 text-error border-error/20',
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
                    ? 'bg-warning/10 text-warning border border-warning/20'
                    : 'bg-error/10 text-error border border-error/20',
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
