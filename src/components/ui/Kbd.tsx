import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * Touche de clavier.
 *
 * Rendre les raccourcis visibles dans l'interface est ce qui les fait
 * découvrir : un raccourci que personne ne connaît n'existe pas.
 */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'bg-surface-sunken border-border text-subtle-foreground',
        'inline-flex h-5 min-w-5 items-center justify-center rounded border px-1.5',
        'text-2xs font-sans font-medium',
        className,
      )}
      {...props}
    />
  );
}
