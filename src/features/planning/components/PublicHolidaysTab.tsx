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
      <div className="border-border bg-surface flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-foreground text-sm font-extrabold">
              Calendrier des Jours Fériés Légaux
            </h3>
            <span className="text-base" title={currentTerritory?.label}>
              {currentTerritory?.flag}
            </span>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Calcul automatique des jours ouvrés, astreintes et majorations selon le territoire
          </p>
        </div>

        <Badge variant="primary" className="text-3xs shrink-0 self-start font-mono sm:self-auto">
          {holidays.length} Fériés ({new Date().getFullYear()})
        </Badge>
      </div>

      {/* 2. Quick Territory Filter Chips with Scroll Affordance on Mobile */}
      <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto scroll-smooth pr-6 pb-1 whitespace-nowrap sm:pr-0">
          {HOLIDAY_TERRITORIES.map((t) => {
            const isSelected = selectedTerritory === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTerritory(t.id)}
                className={cn(
                  'min-h-touch inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors sm:min-h-0',
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

        <div className="border-border bg-background/95 text-primary/70 pointer-events-none absolute top-0 right-0 bottom-1 flex w-8 items-center justify-end border-l pr-1 text-xs font-bold sm:hidden">
          ›
        </div>
      </div>

      {/* 3. Holidays Grid Compact Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
        {holidays.map((h) => {
          const isSpecific = h.territory && h.territory !== 'national';

          return (
            <div
              key={`${h.date}-${h.name}`}
              className={cn(
                'bg-surface hover:border-border-strong flex items-center justify-between gap-1.5 rounded-lg border p-2.5 transition-colors',
                isSpecific ? 'border-warning/40 bg-warning/5 dark:bg-warning/10' : 'border-border',
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className={cn(
                    'flex size-6.5 shrink-0 items-center justify-center rounded-lg border font-bold',
                    isSpecific
                      ? 'bg-warning/15 text-warning border-warning/30'
                      : 'bg-error/10 text-error border-error/20',
                  )}
                >
                  <Flag className="size-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4
                    className="text-foreground truncate text-xs leading-tight font-bold"
                    title={h.name}
                  >
                    {h.name}
                  </h4>
                  <p className="text-3xs text-muted-foreground mt-0.5 font-mono leading-tight">
                    {h.date}
                  </p>
                </div>
              </div>

              <span
                className={cn(
                  'text-3xs shrink-0 rounded-md px-1.5 py-0.5 leading-none font-medium tracking-tight',
                  isSpecific
                    ? 'bg-warning/10 text-warning border-warning/20 border'
                    : 'bg-error/10 text-error border-error/20 border',
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
