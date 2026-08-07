import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/cn';

export interface StatCardProps {
  label: string;
  value: string | number;
  /** Unité affichée en plus petit après la valeur (dB, ms, %…). */
  unit?: string;
  icon?: LucideIcon;
  /** Variation en pourcentage. Positif = hausse. */
  trend?: number;
  /** Contexte de la variation, ex. « vs 30 derniers jours ». */
  trendLabel?: string;
  className?: string;
}

/**
 * Indicateur chiffré.
 *
 * La valeur utilise `tabular-nums` : sans cela, une statistique qui passe de
 * `9` à `10` fait sauter toute la mise en page, et deux cartes côte à côte
 * n'alignent pas leurs chiffres.
 */
export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  trendLabel,
  className,
}: StatCardProps) {
  const hasTrend = trend !== undefined;
  const isPositive = hasTrend && trend >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className={cn('bg-surface border-border shadow-raised rounded-lg border p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        {Icon ? (
          <Icon className="text-subtle-foreground size-4 shrink-0" aria-hidden="true" />
        ) : null}
      </div>

      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-foreground text-2xl leading-none font-semibold tabular-nums">
          {value}
        </span>
        {unit ? <span className="text-muted-foreground text-xs">{unit}</span> : null}
      </p>

      {hasTrend ? (
        <p className="mt-2 flex items-center gap-1 text-xs">
          <TrendIcon
            className={cn('size-3.5', isPositive ? 'text-success' : 'text-error')}
            aria-hidden="true"
          />
          <span
            className={cn('font-medium tabular-nums', isPositive ? 'text-success' : 'text-error')}
          >
            {isPositive ? '+' : ''}
            {trend}%
          </span>
          {trendLabel ? <span className="text-subtle-foreground">{trendLabel}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
