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
  const Icon: LucideIcon =
    NAV_ICONS[tool.icon] ?? (trade ? NAV_ICONS[trade.icon] : undefined) ?? FALLBACK_NAV_ICON;
  const targetUrl = `/metiers/${tool.tradeSlug}/${tool.slug}`;

  if (variant === 'list') {
    return (
      <div
        className={cn(
          'group bg-surface border-border relative flex items-center justify-between gap-3 rounded-lg border p-3 sm:p-3.5',
          'hover:border-primary/50 transition-colors duration-200',
          'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg',
              trade?.badgeColor ?? 'bg-surface-raised text-muted-foreground',
            )}
          >
            <Icon className="size-4.5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <h3 className="text-foreground text-sm font-bold tracking-tight">
                <Link
                  to={targetUrl}
                  className="hover:text-primary transition-colors after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
                >
                  {tool.title}
                </Link>
              </h3>
              {!isProUnlocked && (
                <span className="border-primary/25 bg-primary-subtle text-primary text-3xs inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-bold tracking-wider uppercase">
                  <Sparkles className="text-primary size-2.5" />
                  <span>PRO</span>
                </span>
              )}
              {trade && (
                <Badge variant="neutral" className="text-3xs py-0.2 shrink-0 px-2 font-semibold">
                  {trade.shortName}
                </Badge>
              )}
              <span
                className={cn(
                  'text-3xs py-0.2 inline-flex items-center gap-1 rounded px-1.5 font-medium',
                  tool.reliabilityLevel === 'simple' && 'text-success bg-success/10',
                  tool.reliabilityLevel === 'indicative' && 'text-warning bg-warning/10',
                  tool.reliabilityLevel === 'pro_validation' && 'text-error bg-error/10',
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
                    tool.reliabilityLevel === 'simple' && 'bg-success',
                    tool.reliabilityLevel === 'indicative' && 'bg-warning',
                    tool.reliabilityLevel === 'pro_validation' && 'bg-error',
                  )}
                />
                <span>
                  {tool.reliabilityLevel === 'simple'
                    ? 'Direct'
                    : tool.reliabilityLevel === 'indicative'
                      ? 'Indicatif'
                      : 'Validation BE'}
                </span>
              </span>
            </div>
            <p className="text-muted-foreground line-clamp-1 text-xs">
              {tool.shortDescription ?? tool.description}
            </p>
          </div>
        </div>

        <div className="relative z-20 flex shrink-0 items-center gap-2">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(tool.slug)}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite
                  ? `Retirer ${tool.title} des favoris`
                  : `Ajouter ${tool.title} aux favoris`
              }
              className={cn(
                // 44 px au doigt (WCAG 2.5.5), 32 px au pointeur : l'étoile
                // faisait 32 px partout, soit une cible ratée une fois sur
                // trois avec un gant.
                'size-touch flex cursor-pointer items-center justify-center rounded-lg transition-colors sm:size-8',
                'hover:bg-surface-hover',
                isFavorite ? 'text-warning' : 'text-subtle-foreground',
              )}
            >
              <Star
                className={cn('size-4', isFavorite && 'text-warning fill-current')}
                aria-hidden="true"
              />
            </button>
          )}

          <Link
            to={targetUrl}
            className="min-h-touch bg-primary text-primary-foreground hover:bg-primary-hover inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 sm:min-h-0"
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
        'group bg-surface border-border relative flex flex-col justify-between rounded-lg border p-3.5 sm:p-4',
        'hover:border-primary/40 transition-colors duration-200',
        'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
        className,
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              trade?.badgeColor ?? 'bg-surface-raised text-muted-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>

          <div className="relative z-20 flex items-center gap-1.5">
            <span
              className={cn(
                'size-2 rounded-full',
                tool.reliabilityLevel === 'simple' && 'bg-success',
                tool.reliabilityLevel === 'indicative' && 'bg-warning',
                tool.reliabilityLevel === 'pro_validation' && 'bg-error',
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
                  isFavorite
                    ? `Retirer ${tool.title} des favoris`
                    : `Ajouter ${tool.title} aux favoris`
                }
                className={cn(
                  'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
                  'hover:bg-surface-hover',
                  isFavorite ? 'text-warning' : 'text-subtle-foreground',
                )}
              >
                <Star
                  className={cn('size-3.5', isFavorite && 'text-warning fill-current')}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h3 className="text-foreground text-sm leading-snug font-bold">
            <Link
              to={targetUrl}
              className="hover:text-primary transition-colors after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
            >
              {tool.title}
            </Link>
          </h3>
          {!isProUnlocked && (
            <span className="border-primary/25 bg-primary-subtle text-primary text-3xs inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-bold tracking-wider uppercase">
              <Sparkles className="text-primary size-2.5" />
              <span>PRO</span>
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-snug">
          {tool.shortDescription ?? tool.description}
        </p>
      </div>

      <div className="border-border/50 mt-3.5 flex items-center justify-between gap-2 border-t pt-2.5 text-xs">
        {trade ? (
          <Badge variant="neutral" className="text-3xs py-0.2 px-2">
            {trade.shortName}
          </Badge>
        ) : (
          <span aria-hidden="true" />
        )}

        <Link
          to={targetUrl}
          className="text-primary relative z-20 flex cursor-pointer items-center gap-0.5 text-xs font-bold hover:underline"
        >
          <span>Lancer</span>
          <ChevronRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
