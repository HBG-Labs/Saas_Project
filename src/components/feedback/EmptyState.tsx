import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  /**
   * Explique POURQUOI c'est vide et QUOI FAIRE ensuite.
   * « Aucun favori » est un échec de conception ; « Aucun favori — parcourez le
   * catalogue et cliquez sur l'étoile » est une aide.
   */
  description: string;
  action?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border/80 bg-surface/50 flex flex-col items-center justify-center rounded-2xl border border-dashed text-center',
        size === 'md' ? 'gap-4 px-6 py-12 sm:py-16' : 'gap-3 px-4 py-8',
        className,
      )}
    >
      {Icon ? (
        <div className="bg-primary/10 border border-primary/20 text-primary flex size-12 items-center justify-center rounded-2xl shadow-xs">
          <Icon className="size-6" aria-hidden="true" />
        </div>
      ) : null}

      <div className="space-y-1.5 max-w-md">
        <p className="text-foreground text-base font-bold tracking-tight">{title}</p>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      </div>

      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
