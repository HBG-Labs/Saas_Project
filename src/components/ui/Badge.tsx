import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-md font-semibold whitespace-nowrap transition-colors border [&_svg]:size-3',
  {
    variants: {
      /*
        Deux teintes par variante, et non une.

        Les couleurs vives à 300/400 sont lisibles sur fond sombre ; sur le
        blanc du thème clair, adossées à un fond teinté à 15 %, elles tombent
        sous 2,5:1 — un texte qu'on devine plutôt qu'on ne lit. La nuance à 700
        rétablit le contraste en clair, la nuance d'origine reste en sombre.

        `neutral` portait `bg-secondary`, un jeton qui n'existe nulle part dans
        le thème : la variante par défaut n'avait donc aucun fond.
      */
      variant: {
        neutral: 'border-border/50 bg-surface-sunken text-foreground/80',
        primary: 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400 font-semibold',
        accent:
          'border-purple-500/35 bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold',
        success:
          'border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold',
        warning:
          'border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold',
        error: 'border-rose-500/35 bg-rose-500/15 text-rose-700 dark:text-rose-400 font-semibold',
        info: 'border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold',
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

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
