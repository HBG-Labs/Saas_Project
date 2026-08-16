import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * Conteneur de contenu.
 *
 * En thème clair l'élévation vient de l'ombre, en thème sombre de la clarté de
 * surface : une ombre noire sur fond sombre est invisible. Les deux traitements
 * cohabitent dans les mêmes classes via les tokens.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface border-border shadow-xs rounded-xl border', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-4 sm:p-5', className)} {...props} />;
}

// `children` est explicite plutôt que noyé dans `...props` : sans cela, ESLint
// ne peut pas garantir que le titre a un contenu accessible.
export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base leading-tight font-semibold', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-muted-foreground text-xs', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-0 sm:p-5 sm:pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-border flex items-center gap-2 border-t p-4 sm:p-5', className)}
      {...props}
    />
  );
}
