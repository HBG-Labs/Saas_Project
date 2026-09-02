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
          'group bg-surface border-border shadow-2xs relative flex items-center justify-between rounded-xl border p-2.5 sm:p-3 gap-3',
          'hover:border-primary/50 hover:shadow-xs transition-all duration-200',
          'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
          className,
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
              category?.tint ?? 'bg-surface-hover text-muted-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="text-foreground font-bold text-sm tracking-tight">
                <Link
                  to={ROUTES.tool(tool.slug)}
                  className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none hover:text-primary transition-colors"
                >
                  {tool.title}
                </Link>
              </h3>
              {category && <Badge variant="neutral" className="text-3xs px-1.5 py-0 shrink-0">{category.name}</Badge>}
            </div>
            <p className="text-muted-foreground line-clamp-1 text-xs">
              {tool.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative z-20">
          {onToggleFavorite ? (
            <button
              type="button"
              onClick={() => onToggleFavorite(tool.slug)}
              aria-pressed={isFavorite}
              aria-label={
                isFavorite ? `Retirer ${tool.title} des favoris` : `Ajouter ${tool.title} aux favoris`
              }
              className={cn(
                // Voir `MetierToolCard` : cible tactile pleine au doigt,
                // compacte dès qu'un pointeur est disponible.
                'size-touch sm:size-7 flex items-center justify-center rounded-md transition-colors',
                'hover:bg-surface-hover',
                isFavorite ? 'text-warning' : 'text-subtle-foreground',
              )}
            >
              <Star className={cn('size-3.5', isFavorite && 'fill-current')} aria-hidden="true" />
            </button>
          ) : null}

          <Link
            to={ROUTES.tool(tool.slug)}
            className="min-h-touch sm:min-h-0 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-2xs transition-all hover:bg-primary-hover active:scale-95 cursor-pointer"
          >
            <span>Lancer</span>
            <ChevronRight className="size-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group bg-surface border-border shadow-2xs relative flex flex-col justify-between rounded-xl border p-3 sm:p-3.5',
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
                isFavorite ? `Retirer ${tool.title} des favoris` : `Ajouter ${tool.title} aux favoris`
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

        <h3 className="text-foreground mt-2 font-bold text-sm leading-snug">
          <Link
            to={ROUTES.tool(tool.slug)}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none hover:text-primary transition-colors"
          >
            {tool.title}
          </Link>
        </h3>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-snug">
          {tool.description}
        </p>
      </div>

      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between gap-2 text-xs">
        {category ? (
          <Badge variant="neutral" className="text-3xs px-1.5 py-0">
            {category.name}
          </Badge>
        ) : (
          <span aria-hidden="true" />
        )}

        <Link
          to={ROUTES.tool(tool.slug)}
          className="relative z-20 text-primary font-bold flex items-center gap-0.5 text-xs hover:underline cursor-pointer"
        >
          <span>Lancer</span>
          <ChevronRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
