import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-md font-semibold whitespace-nowrap transition-colors border [&_svg]:size-3',
  {
    variants: {
      /*
        Chaque variante sémantique tire ses trois valeurs du même trio de
        jetons : `--x`, `--x-subtle` (fond) et `--x-border` (contour).

        La version précédente composait ces teintes à la main dans les palettes
        brutes de Tailwind (`bg-success/15 text-success
        dark:text-success`), avec une nuance différente par thème pour
        rattraper le contraste — un commentaire de dix lignes expliquait
        pourquoi. Ce rattrapage n'a plus lieu d'être : les jetons sont définis
        séparément dans `:root` et `.dark`, donc le contraste est déjà résolu
        par le thème, une fois, au lieu d'être recalculé dans chaque variante.

        Conséquence pratique : un changement d'identité se fait dans
        `index.css` et traverse tous les badges du produit.
      */
      variant: {
        neutral: 'border-border/60 bg-surface-sunken text-foreground/80',
        primary: 'border-primary/30 bg-primary-subtle text-primary',
        accent: 'border-accent/30 bg-accent-subtle text-accent',
        success: 'border-success-border bg-success-subtle text-success',
        warning: 'border-warning-border bg-warning-subtle text-warning',
        error: 'border-error-border bg-error-subtle text-error',
        info: 'border-info-border bg-info-subtle text-info',
        outline: 'border-border text-muted-foreground bg-transparent',
      },
      size: {
        default: 'px-2.5 py-0.5 text-2xs',
        button: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

// `size` était déclaré dans les variantes mais jamais transmis : tout badge
// tombait sur `default`, y compris `RoleBadge` qui passe la prop
// consciencieusement depuis toujours. La prop existait sans rien faire.
export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
