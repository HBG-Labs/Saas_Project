import { Star, ChevronRight } from 'lucide-react';
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
  className?: string;
}

export function ToolCard({ tool, isFavorite = false, onToggleFavorite, className }: ToolCardProps) {
  const Icon = TOOL_ICONS[tool.icon] ?? FALLBACK_TOOL_ICON;
  const category = getCategoryMetadata(tool.category);

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
                'relative z-10 flex size-8 items-center justify-center rounded-md transition-colors',
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

        <span className="text-primary font-medium flex items-center gap-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100">
          Lancer <ChevronRight className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
