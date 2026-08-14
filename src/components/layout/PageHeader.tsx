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
        'mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1 max-w-prose text-sm">{description}</p>
        ) : null}
      </div>

      {/*
        Les actions se partagent la largeur sur téléphone.

        Un bouton de 90 px aligné à gauche sous un titre pleine largeur se
        cherche ; étiré, il devient la suite naturelle du regard et une cible
        que le pouce ne peut pas manquer.
      */}
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
