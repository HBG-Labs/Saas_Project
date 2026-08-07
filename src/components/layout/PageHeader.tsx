import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Actions alignées à droite sur desktop, sous le titre sur mobile. */
  actions?: ReactNode;
  className?: string;
}

/**
 * En-tête de page applicative.
 *
 * Porte l'unique `<h1>` de la page. Le factoriser garantit qu'il n'y en a qu'un
 * et que la hiérarchie de titres reste correcte pour les lecteurs d'écran.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1 max-w-prose text-sm">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
