import { ChevronRight, Sparkles, Star, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { useUserEntitlements } from '@/features/billing';
import { cn } from '@/lib/cn';
import { getTrade } from '../registry';
import type { MetierToolDefinition } from '../types';
import { FALLBACK_NAV_ICON, NAV_ICONS } from '@/components/layout/nav-icons';

interface MetierToolCardProps {
  tool: MetierToolDefinition;
  variant?: 'grid' | 'list';
  isFavorite?: boolean;
  onToggleFavorite?: (slug: string) => void;
  className?: string;
}

export function MetierToolCard({
  tool,
  variant = 'list',
  isFavorite = false,
  onToggleFavorite,
  className,
}: MetierToolCardProps) {
  const { has } = useUserEntitlements();
  const isProUnlocked = has('pro_tools');
  const trade = getTrade(tool.tradeSlug);
  const Icon: LucideIcon = NAV_ICONS[tool.icon] ?? (trade ? NAV_ICONS[trade.icon] : undefined) ?? FALLBACK_NAV_ICON;
  const targetUrl = `/metiers/${tool.tradeSlug}/${tool.slug}`;

  if (variant === 'list') {
    return (
      <div
        className={cn(
          'group bg-surface border-border shadow-2xs relative flex items-center justify-between rounded-xl border p-3 sm:p-3.5 gap-3',
          'hover:border-primary/50 hover:shadow-xs transition-all duration-200',
          'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
          className,
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
              trade?.badgeColor ?? 'bg-surface-raised text-muted-foreground',
            )}
          >
            <Icon className="size-4.5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="text-foreground font-bold text-sm tracking-tight">
                <Link
                  to={targetUrl}
                  className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none hover:text-primary transition-colors"
                >
                  {tool.title}
                </Link>
              </h3>
              {!isProUnlocked && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 px-2 py-0.5 text-[9px] font-black tracking-wider uppercase text-amber-700 dark:text-amber-300 shadow-[0_1px_4px_rgba(245,158,11,0.15)] backdrop-blur-xs">
                  <Sparkles className="size-2.5 text-amber-500" />
                  <span>PRO</span>
                </span>
              )}
              {trade && (
                <Badge variant="neutral" className="text-3xs px-2 py-0.2 shrink-0 font-semibold">
                  {trade.shortName}
                </Badge>
              )}
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-3xs font-medium px-1.5 py-0.2 rounded',
                  tool.reliabilityLevel === 'simple' && 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10',
                  tool.reliabilityLevel === 'indicative' && 'text-amber-700 dark:text-amber-400 bg-amber-500/10',
                  tool.reliabilityLevel === 'pro_validation' && 'text-rose-700 dark:text-rose-400 bg-rose-500/10',
                )}
                title={
                  tool.reliabilityLevel === 'simple'
                    ? 'Calcul direct vérifié'
                    : tool.reliabilityLevel === 'indicative'
                      ? 'Calcul technique indicatif'
                      : 'Dimensionnement d’avant-projet (validation BE requise)'
                }
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    tool.reliabilityLevel === 'simple' && 'bg-emerald-500',
                    tool.reliabilityLevel === 'indicative' && 'bg-amber-500',
                    tool.reliabilityLevel === 'pro_validation' && 'bg-rose-500',
                  )}
                />
                <span>{tool.reliabilityLevel === 'simple' ? 'Direct' : tool.reliabilityLevel === 'indicative' ? 'Indicatif' : 'Validation BE'}</span>
              </span>
            </div>
            <p className="text-muted-foreground line-clamp-1 text-xs">
              {tool.shortDescription ?? tool.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative z-20">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(tool.slug)}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite ? `Retirer ${tool.title} des favoris` : `Ajouter ${tool.title} aux favoris`
              }
              className={cn(
                'flex size-8 items-center justify-center rounded-lg transition-colors cursor-pointer',
                'hover:bg-surface-hover',
                isFavorite ? 'text-amber-500 fill-amber-500' : 'text-subtle-foreground',
              )}
            >
              <Star className={cn('size-4', isFavorite && 'fill-amber-500 text-amber-500')} aria-hidden="true" />
            </button>
          )}

          <Link
            to={targetUrl}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-2xs hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
          >
            <span>Lancer</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group bg-surface border-border shadow-2xs relative flex flex-col justify-between rounded-xl border p-3.5 sm:p-4',
        'hover:border-primary/40 hover:shadow-xs transition-all duration-200',
        'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
        className,
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
              trade?.badgeColor ?? 'bg-surface-raised text-muted-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>

          <div className="flex items-center gap-1.5 relative z-20">
            <span
              className={cn(
                'size-2 rounded-full',
                tool.reliabilityLevel === 'simple' && 'bg-emerald-500',
                tool.reliabilityLevel === 'indicative' && 'bg-amber-500',
                tool.reliabilityLevel === 'pro_validation' && 'bg-rose-500',
              )}
              title={
                tool.reliabilityLevel === 'simple'
                  ? '🟢 Calcul direct'
                  : tool.reliabilityLevel === 'indicative'
                    ? '🟠 Calcul technique indicatif'
                    : '🔴 Dimensionnement (validation BE requise)'
              }
            />
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(tool.slug)}
                aria-pressed={isFavorite}
                aria-label={
                  isFavorite ? `Retirer ${tool.title} des favoris` : `Ajouter ${tool.title} aux favoris`
                }
                className={cn(
                  'flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer',
                  'hover:bg-surface-hover',
                  isFavorite ? 'text-amber-500 fill-amber-500' : 'text-subtle-foreground',
                )}
              >
                <Star className={cn('size-3.5', isFavorite && 'fill-amber-500 text-amber-500')} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <h3 className="text-foreground font-bold text-sm leading-snug">
            <Link
              to={targetUrl}
              className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none hover:text-primary transition-colors"
            >
              {tool.title}
            </Link>
          </h3>
          {!isProUnlocked && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 px-2 py-0.5 text-[9px] font-black tracking-wider uppercase text-amber-700 dark:text-amber-300 shadow-[0_1px_4px_rgba(245,158,11,0.15)] backdrop-blur-xs">
              <Sparkles className="size-2.5 text-amber-500" />
              <span>PRO</span>
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-snug">
          {tool.shortDescription ?? tool.description}
        </p>
      </div>

      <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2 text-xs">
        {trade ? (
          <Badge variant="neutral" className="text-3xs px-2 py-0.2">
            {trade.shortName}
          </Badge>
        ) : (
          <span aria-hidden="true" />
        )}

        <Link
          to={targetUrl}
          className="relative z-20 text-primary font-bold flex items-center gap-0.5 text-xs hover:underline cursor-pointer"
        >
          <span>Lancer</span>
          <ChevronRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
