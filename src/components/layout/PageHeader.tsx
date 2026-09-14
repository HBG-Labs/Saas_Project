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
        'mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-foreground text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>

      {/*
        Les actions se partagent la largeur sur téléphone.

        Un bouton de 90 px aligné à gauche sous un titre pleine largeur se
        cherche ; étiré, il devient la suite naturelle du regard et une cible
        que le pouce ne peut pas manquer.
      */}
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
