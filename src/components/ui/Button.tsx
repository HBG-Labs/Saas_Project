import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * Primitive de bouton.
 *
 * Fondation minimale : le Design System complet fera l'objet d'une phase
 * dédiée. Deux points sont néanmoins traités dès maintenant car ils sont
 * structurels et coûteux à rétro-adapter :
 *   • la hauteur minimale respecte la cible tactile de 44 px (§12) ;
 *   • l'anneau de focus est hérité du style global `:focus-visible`.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ' +
    'transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700',
        secondary: 'bg-surface-muted text-content hover:bg-border',
        ghost: 'text-content hover:bg-surface-muted',
        danger: 'bg-danger-500 text-white hover:opacity-90',
      },
      size: {
        sm: 'min-h-9 px-3',
        md: 'min-h-touch px-4',
        lg: 'min-h-touch px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
