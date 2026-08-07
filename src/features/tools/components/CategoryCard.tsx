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
      to={`${ROUTES.tools}?category=${category.slug}`}
      className={cn(
        'group bg-surface border-border/70 shadow-raised relative block rounded-xl border p-5',
        'hover:border-primary/40 hover:shadow-overlay transition-all duration-200',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
    >
      <span
        className={cn('flex size-11 items-center justify-center rounded-lg transition-transform group-hover:scale-105', category.tint)}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>

      <h3 className="text-foreground mt-4 text-base font-semibold">{category.name}</h3>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{category.description}</p>

      <p className="text-primary mt-4 flex items-center gap-1.5 text-xs font-semibold">
        {toolCount === undefined || toolCount === 0
          ? 'Explorer la catégorie'
          : `${toolCount} outil${toolCount > 1 ? 's' : ''} disponibles`}
        <ArrowRight
          className="size-3.5 transition-transform duration-200 group-hover:translate-x-1"
          aria-hidden="true"
        />
      </p>
    </Link>
  );
}
