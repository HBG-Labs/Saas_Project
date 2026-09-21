import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  icon?: LucideIcon;
  /** Illustration de premier usage, décorative. Les erreurs et filtres gardent leur icône. */
  illustration?: ReactNode;
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
  illustration,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        illustration
          ? 'bg-surface rounded-xl'
          : 'border-border/80 bg-surface/50 rounded-2xl border border-dashed',
        size === 'md'
          ? 'gap-3 px-4 py-7 sm:gap-4 sm:px-6 sm:py-12 lg:py-16'
          : 'gap-3 px-4 py-6 sm:py-8',
        className,
      )}
    >
      {illustration ??
        (Icon ? (
          <div
            className="relative isolate flex size-20 items-center justify-center"
            aria-hidden="true"
          >
            <span className="bg-primary/5 absolute inset-1 rotate-6 rounded-[1.75rem]" />
            <span className="bg-primary-subtle/70 border-primary/15 absolute inset-2 rounded-full border" />
            <span className="bg-surface-raised border-primary/20 text-primary relative flex size-12 items-center justify-center rounded-2xl border shadow-sm">
              <Icon className="size-7" strokeWidth={1.7} />
            </span>
          </div>
        ) : null)}

      <div className="max-w-md space-y-1.5">
        <p
          className={cn(
            'text-foreground text-base font-bold tracking-tight',
            illustration && 'text-base sm:text-lg',
          )}
        >
          {title}
        </p>
        <p
          className={cn('text-muted-foreground text-xs leading-relaxed', illustration && 'text-sm')}
        >
          {description}
        </p>
      </div>

      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
