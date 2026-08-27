import { Sparkles, Star, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { TRADES } from '../registry';
import type { TradeSlug } from '../types';
import { FALLBACK_NAV_ICON, NAV_ICONS } from '@/components/layout/nav-icons';

interface MetierTradeFilterTabsProps {
  activeTab: TradeSlug | 'all' | 'favorites';
  onTabChange: (tab: TradeSlug | 'all' | 'favorites') => void;
  favoritesCount?: number | undefined;
  totalToolsCount?: number | undefined;
}

export function MetierTradeFilterTabs({
  activeTab,
  onTabChange,
  favoritesCount = 0,
  totalToolsCount = 36,
}: MetierTradeFilterTabsProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {/* Tous */}
      <button
        type="button"
        onClick={() => onTabChange('all')}
        className={cn(
          'h-9 rounded-xl border px-3.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none',
          activeTab === 'all'
            ? 'border-primary bg-primary/10 text-primary shadow-xs'
            : 'border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover',
        )}
      >
        <Sparkles className="size-3.5" />
        <span>Tous ({totalToolsCount})</span>
      </button>

      {/* Les 6 métiers */}
      {TRADES.map((trade) => {
        const Icon: LucideIcon = NAV_ICONS[trade.icon] ?? FALLBACK_NAV_ICON;
        const isSelected = activeTab === trade.slug;

        return (
          <button
            key={trade.slug}
            type="button"
            onClick={() => onTabChange(trade.slug)}
            className={cn(
              'h-9 rounded-xl border px-3.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground shadow-xs font-bold'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover',
            )}
          >
            <Icon className="size-3.5" />
            <span>{trade.shortName} ({trade.toolsCount})</span>
          </button>
        );
      })}

      {/* Favoris */}
      <button
        type="button"
        onClick={() => onTabChange('favorites')}
        className={cn(
          'h-9 rounded-xl border px-3.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none',
          activeTab === 'favorites'
            ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs font-bold'
            : 'border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover',
        )}
      >
        <Star className={cn('size-3.5', favoritesCount > 0 && 'fill-amber-500 text-amber-500')} />
        <span>Favoris ({favoritesCount})</span>
      </button>
    </div>
  );
}
