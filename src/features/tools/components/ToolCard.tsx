import { ChevronRight, Star } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { FALLBACK_TOOL_ICON, TOOL_ICONS } from '@/components/ui/icons';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

import { getCategoryMetadata } from '../catalog-metadata';

export interface ToolCardProps {
  tool: {
    slug: string;
    title: string;
    description: string;
    category: string;
    icon: string;
  };
  isFavorite?: boolean;
  onToggleFavorite?: (slug: string) => void;
  variant?: 'grid' | 'list';
  className?: string;
}

export function ToolCard({
  tool,
  isFavorite = false,
  onToggleFavorite,
  variant = 'grid',
  className,
}: ToolCardProps) {
  const Icon = TOOL_ICONS[tool.icon] ?? FALLBACK_TOOL_ICON;
  const category =
    getCategoryMetadata(tool.category) ??
    (tool.category === 'universal'
      ? { name: 'Universel', tint: 'bg-primary-subtle text-primary' }
      : undefined);

  if (variant === 'list') {
    return (
      <div
        className={cn(
          'group bg-surface border-border relative flex min-h-[4.75rem] items-center gap-3 border-b px-1 py-2.5 last:border-b-0 sm:min-h-20 sm:px-2',
          'hover:bg-surface-hover/60 transition-colors duration-150',
          'focus-within:bg-surface-hover/60 focus-within:ring-ring focus-within:ring-2 focus-within:ring-inset',
          className,
        )}
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
            category?.tint ?? 'bg-surface-hover text-muted-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-foreground text-sm leading-snug font-bold tracking-tight">
            <Link
              to={ROUTES.tool(tool.slug)}
              className="hover:text-primary transition-colors after:absolute after:inset-0 focus-visible:outline-none"
            >
              {tool.title}
            </Link>
          </h3>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            {category ? (
              <Badge variant="neutral" className="text-3xs shrink-0 px-1.5 py-0">
                {category.name}
              </Badge>
            ) : null}
            <p className="text-muted-foreground min-w-0 truncate text-xs">{tool.description}</p>
          </div>
        </div>

        <div className="relative z-20 flex shrink-0 items-center gap-0.5">
          {onToggleFavorite ? (
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
                'focus-visible:ring-ring size-touch flex cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none sm:size-9',
                'hover:bg-surface-hover',
                isFavorite ? 'text-warning' : 'text-subtle-foreground',
              )}
            >
              <Star className={cn('size-4', isFavorite && 'fill-current')} aria-hidden="true" />
            </button>
          ) : null}

          <ChevronRight
            className="text-subtle-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group bg-surface border-border relative flex flex-col justify-between rounded-xl border p-3 shadow-2xs sm:p-3.5',
        'hover:border-primary/40 transition-all duration-200 hover:shadow-xs',
        'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
        className,
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
              category?.tint ?? 'bg-surface-hover text-muted-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>

          {onToggleFavorite ? (
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
                'relative z-20 flex size-7 items-center justify-center rounded-md transition-colors',
                'hover:bg-surface-hover',
                isFavorite ? 'text-warning' : 'text-subtle-foreground',
                'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100',
                isFavorite && 'md:opacity-100',
              )}
            >
              <Star className={cn('size-3.5', isFavorite && 'fill-current')} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <h3 className="text-foreground mt-2 text-sm leading-snug font-bold">
          <Link
            to={ROUTES.tool(tool.slug)}
            className="hover:text-primary transition-colors after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
          >
            {tool.title}
          </Link>
        </h3>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-snug">
          {tool.description}
        </p>
      </div>

      <div className="border-border/50 mt-3 flex items-center justify-between gap-2 border-t pt-2 text-xs">
        {category ? (
          <Badge variant="neutral" className="text-3xs px-1.5 py-0">
            {category.name}
          </Badge>
        ) : (
          <span aria-hidden="true" />
        )}

        <ChevronRight
          className="text-subtle-foreground size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
