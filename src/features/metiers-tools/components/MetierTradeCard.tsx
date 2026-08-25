import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import type { TradeDefinition } from '../types';
import { FALLBACK_NAV_ICON, NAV_ICONS } from '@/components/layout/nav-icons';

export function MetierTradeCard({ trade }: { trade: TradeDefinition }) {
  const Icon: LucideIcon = NAV_ICONS[trade.icon] ?? FALLBACK_NAV_ICON;

  return (
    <Card
      className={cn(
        'group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border border-border bg-surface shadow-xs transition-all duration-200',
        'hover:shadow-md hover:border-primary/50',
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div
            className={cn(
              'flex size-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105 shadow-2xs',
              trade.badgeColor,
            )}
          >
            <Icon className="size-5" />
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold bg-surface-raised border border-border text-foreground/80">
            {trade.toolsCount} outil{trade.toolsCount > 1 ? 's' : ''}
          </span>
        </div>

        <h3 className="text-base font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
          <Link to={`/metiers/${trade.slug}`} className="after:absolute after:inset-0 after:rounded-2xl">
            {trade.name}
          </Link>
        </h3>
        <p className="text-xs font-semibold text-primary/90 mt-0.5">
          {trade.subtitle}
        </p>
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
          {trade.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
        <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider">
          Module autonome
        </span>
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
          <span>Voir les outils</span>
          <ArrowRight className="size-3.5" />
        </div>
      </div>
    </Card>
  );
}
