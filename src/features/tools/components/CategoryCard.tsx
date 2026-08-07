import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { FALLBACK_TOOL_ICON, TOOL_ICONS } from '@/components/ui/icons';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

import type { CategoryMetadata } from '../catalog-metadata';

export interface CategoryCardProps {
  category: CategoryMetadata;
  /** Nombre d'outils disponibles. `0` affiche explicitement « bientôt disponible ». */
  toolCount?: number;
  className?: string;
}

export function CategoryCard({ category, toolCount, className }: CategoryCardProps) {
  const Icon = TOOL_ICONS[category.icon] ?? FALLBACK_TOOL_ICON;

  return (
    <Link
      to={ROUTES.category(category.slug)}
      className={cn(
        'group bg-surface border-border shadow-raised block rounded-lg border p-5',
        'hover:border-border-strong transition-colors duration-[120ms]',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
    >
      <span
        className={cn('flex size-10 items-center justify-center rounded-lg', category.tint)}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>

      <h3 className="mt-3 text-sm font-semibold">{category.name}</h3>
      <p className="text-muted-foreground mt-1 text-xs">{category.description}</p>

      <p className="text-subtle-foreground mt-3 flex items-center gap-1 text-xs font-medium">
        {toolCount === undefined || toolCount === 0
          ? 'Bientôt disponible'
          : `${toolCount} outil${toolCount > 1 ? 's' : ''}`}
        <ArrowRight
          className="size-3.5 transition-transform duration-[120ms] group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </p>
    </Link>
  );
}
