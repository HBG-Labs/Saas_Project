import { Star } from 'lucide-react';
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

/**
 * Carte d'outil du catalogue.
 *
 * Le bouton favori est un vrai `<button>` posé À CÔTÉ du lien, pas à
 * l'intérieur : imbriquer un bouton dans un lien est invalide en HTML et rend
 * l'un des deux inatteignable au clavier.
 *
 * L'étoile reste visible en permanence sur tactile (`opacity-100`) et n'apparaît
 * au survol que sur pointeur fin : une action accessible uniquement au survol
 * n'existe pas sur mobile.
 */
export function ToolCard({ tool, isFavorite = false, onToggleFavorite, className }: ToolCardProps) {
  const Icon = TOOL_ICONS[tool.icon] ?? FALLBACK_TOOL_ICON;
  const category = getCategoryMetadata(tool.category);

  return (
    <div
      className={cn(
        'group bg-surface border-border shadow-raised relative rounded-lg border p-4',
        'hover:border-border-strong transition-colors duration-[120ms]',
        'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            category?.tint ?? 'bg-surface-hover text-muted-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">
            {/* `after:absolute inset-0` étend la zone cliquable à toute la carte
                sans imbriquer d'éléments interactifs. */}
            <Link
              to={ROUTES.tool(tool.slug)}
              className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
            >
              {tool.title}
            </Link>
          </h3>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{tool.description}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {category ? <Badge variant="neutral">{category.name}</Badge> : <span aria-hidden="true" />}

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
              // Toujours visible au tactile ; révélé au survol sur pointeur fin.
              'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100',
              isFavorite && 'md:opacity-100',
            )}
          >
            <Star className={cn('size-4', isFavorite && 'fill-current')} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
