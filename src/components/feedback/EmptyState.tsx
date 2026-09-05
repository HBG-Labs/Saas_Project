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
        <div className="relative isolate flex size-20 items-center justify-center" aria-hidden="true">
          <span className="bg-primary/5 absolute inset-1 rotate-6 rounded-[1.75rem]" />
          <span className="bg-primary-subtle/70 border-primary/15 absolute inset-2 rounded-full border" />
          <span className="bg-surface-raised border-primary/20 text-primary relative flex size-12 items-center justify-center rounded-2xl border shadow-sm">
            <Icon className="size-7" strokeWidth={1.7} />
          </span>
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
