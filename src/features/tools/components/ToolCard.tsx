import { ChevronRight, Star } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/Badge';
import { FALLBACK_TOOL_ICON, TOOL_ICONS } from '@/components/ui/icons';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

import { getCategoryMetadata } from '../catalog-metadata';
import type { ToolDefinition } from '../registry';

export interface ToolCardProps {
  tool: Pick<ToolDefinition, 'slug' | 'title' | 'description' | 'category' | 'icon'>;
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
  const category = getCategoryMetadata(tool.category);

  if (variant === 'list') {
    return (
      <div
        className={cn(
          'group bg-surface border-border/70 shadow-raised relative flex items-center justify-between rounded-xl border p-4 gap-4',
          'hover:border-primary/50 hover:shadow-overlay transition-all duration-200',
          'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
          className,
        )}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
              category?.tint ?? 'bg-surface-hover text-muted-foreground',
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-foreground font-bold text-base tracking-tight">
                <Link
                  to={ROUTES.tool(tool.slug)}
                  className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none hover:text-primary transition-colors"
                >
                  {tool.title}
                </Link>
              </h3>
              {category && <Badge variant="neutral" className="text-2xs shrink-0">{category.name}</Badge>}
            </div>
            <p className="text-muted-foreground line-clamp-1 text-xs">
              {tool.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 relative z-20">
          {onToggleFavorite ? (
            <button
              type="button"
              onClick={() => onToggleFavorite(tool.slug)}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite ? `Retirer ${tool.title} des favoris` : `Ajouter ${tool.title} aux favoris`
              }
              className={cn(
                'flex size-8 items-center justify-center rounded-md transition-colors',
                'hover:bg-surface-hover',
                isFavorite ? 'text-warning' : 'text-subtle-foreground',
              )}
            >
              <Star className={cn('size-4', isFavorite && 'fill-current')} aria-hidden="true" />
            </button>
          ) : null}

          <Link
            to={ROUTES.tool(tool.slug)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
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
        'group bg-surface border-border/70 shadow-raised relative flex flex-col justify-between rounded-xl border p-4 sm:p-5',
        'hover:border-primary/40 hover:shadow-overlay transition-all duration-200',
        'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
        className,
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
              category?.tint ?? 'bg-surface-hover text-muted-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>

          {onToggleFavorite ? (
            <button
              type="button"
              onClick={() => onToggleFavorite(tool.slug)}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite ? `Retirer ${tool.title} des favoris` : `Ajouter ${tool.title} aux favoris`
              }
              className={cn(
                'relative z-20 flex size-8 items-center justify-center rounded-md transition-colors',
                'hover:bg-surface-hover',
                isFavorite ? 'text-warning' : 'text-subtle-foreground',
                'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100',
                isFavorite && 'md:opacity-100',
              )}
            >
              <Star className={cn('size-4', isFavorite && 'fill-current')} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <h3 className="text-foreground mt-3 font-semibold text-base">
          <Link
            to={ROUTES.tool(tool.slug)}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
          >
            {tool.title}
          </Link>
        </h3>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
          {tool.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
        {category ? <Badge variant="neutral" className="text-2xs">{category.name}</Badge> : <span aria-hidden="true" />}

        <Link
          to={ROUTES.tool(tool.slug)}
          className="relative z-20 text-primary font-bold flex items-center gap-1 text-xs hover:underline cursor-pointer"
        >
          <span>Lancer</span>
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
