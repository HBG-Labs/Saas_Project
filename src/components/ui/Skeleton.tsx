import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * Bloc de chargement.
 *
 * Les squelettes doivent reproduire la FORME du contenu attendu, pas remplir
 * l'espace au hasard : sinon l'arrivée du contenu réel provoque un saut de mise
 * en page, ce qui est plus désagréable qu'un simple indicateur.
 *
 * `aria-hidden` : le squelette est purement visuel. C'est le conteneur qui porte
 * `aria-busy`, sans quoi le lecteur d'écran annoncerait une suite de boîtes
 * vides.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('bg-surface-hover animate-pulse rounded-md', className)}
      {...props}
    />
  );
}

/** Squelette de carte d'outil, calqué sur la forme réelle de `ToolCard`. */
export function ToolCardSkeleton() {
  return (
    <div className="border-border bg-surface space-y-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-busy="true" aria-label="Chargement de la liste">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}
