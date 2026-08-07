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
        'border-border flex flex-col items-center justify-center rounded-lg border border-dashed text-center',
        size === 'md' ? 'gap-3 px-6 py-12' : 'gap-2 px-4 py-8',
        className,
      )}
    >
      {Icon ? (
        <div className="bg-surface-hover text-subtle-foreground flex size-10 items-center justify-center rounded-full">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-sm text-xs">{description}</p>
      </div>

      {action}
    </div>
  );
}
