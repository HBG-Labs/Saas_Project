import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * Conteneur de contenu.
 *
 * La surface et un filet suffisent à regrouper le contenu. L'ombre est réservée
 * aux commandes et aux panneaux superposés, plutôt que répétée sur chaque carte.
 */
export function Card({
  className,
  variant = 'surface',
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: 'surface' | 'section' }) {
  return (
    <div
      className={cn(
        variant === 'section'
          ? 'border-border border-b'
          : 'bg-surface border-border rounded-lg border',
        className,
      )}
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
