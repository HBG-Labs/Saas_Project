import type { VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { buttonVariants } from './button-variants';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /**
   * Rend l'élément enfant à la place du `<button>`, en lui transmettant styles
   * et comportement. Indispensable pour styler un `<Link>` : imbriquer un lien
   * dans un bouton est invalide en HTML et casse la navigation clavier.
   */
  asChild?: boolean;
  /** Affiche un indicateur et désactive le bouton. La largeur est préservée. */
  isLoading?: boolean;
  /** Libellé annoncé aux lecteurs d'écran pendant le chargement. */
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  loadingLabel = 'Chargement en cours',
  leadingIcon,
  trailingIcon,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  // En mode `asChild`, Radix exige un enfant unique : on ne peut pas y injecter
  // d'icônes ni d'indicateur. L'appelant compose lui-même son contenu.
  if (asChild) {
    return (
      <Slot.Root className={cn(buttonVariants({ variant, size }), className)}>{children}</Slot.Root>
    );
  }

  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled ?? isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          <span className="sr-only">{loadingLabel}</span>
        </>
      ) : (
        leadingIcon
      )}
      {children}
      {!isLoading && trailingIcon}
    </button>
  );
}
