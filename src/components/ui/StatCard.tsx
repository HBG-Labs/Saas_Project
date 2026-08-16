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
    <div
      className={cn(
        'bg-surface border-border shadow-xs hover:border-border-strong hover:shadow-md transition-all rounded-2xl border p-5 sm:p-6 flex flex-col justify-between min-h-[152px]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{label}</p>
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Icon className="size-5 shrink-0" aria-hidden="true" />
          </div>
        ) : null}
      </div>

      <p className="mt-auto pt-2 flex items-baseline gap-1.5">
        <span className="text-foreground text-2xl sm:text-3xl leading-none font-extrabold tracking-tight tabular-nums">
          {value}
        </span>
        {unit ? <span className="text-muted-foreground text-xs font-medium">{unit}</span> : null}
      </p>

      {hasTrend ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-bold tabular-nums',
              isPositive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
            )}
          >
            <TrendIcon className="size-3" aria-hidden="true" />
            {isPositive ? '+' : ''}
            {trend}%
          </span>
          {trendLabel ? <span className="text-subtle-foreground text-2xs">{trendLabel}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
