import { cva } from 'class-variance-authority';

/**
 * Variantes du bouton.
 *
 * Dans un fichier distinct de `Button.tsx` : Fast Refresh n'opère que si un
 * module n'exporte que des composants. Exporter les variantes depuis le fichier
 * du composant casserait le rechargement à chaud de toute l'application.
 *
 * Utile aussi pour styler un lien sans passer par `asChild` :
 * `className={buttonVariants({ variant: 'outline' })}`.
 */
export const buttonVariants = cva(
  [
    'atelier-pill-action inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-bold atelier-control whitespace-nowrap cursor-pointer select-none',
    'transition-[color,background-color,border-color,box-shadow,transform] duration-[120ms] ease-out-expo active:scale-[0.98] motion-reduce:transform-none',
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_*]:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-action text-action-foreground hover:bg-action-hover active:bg-action-active shadow-raised',
        secondary:
          'border border-border bg-surface text-action-text shadow-raised hover:bg-surface-hover active:bg-surface-sunken',
        outline:
          'border border-border bg-surface text-action-text shadow-raised hover:bg-surface-hover active:bg-surface-sunken',
        ghost: 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
        danger: 'bg-error text-error-foreground hover:bg-error/90 active:bg-error/80 shadow-xs',
        'danger-outline':
          'border border-error-border bg-error-subtle text-error hover:border-error hover:bg-error/15 active:bg-error/20 shadow-xs font-medium',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      /* Géométrie visible réduite de 20 % ; la zone tactile mobile reste étendue en CSS. */
      size: {
        sm: 'atelier-action-sm min-h-control px-2.5 text-xs [&_svg]:size-3',
        md: 'atelier-action-md min-h-control px-3 text-xs [&_svg]:size-3.5',
        lg: 'atelier-action-lg min-h-touch px-4 text-sm [&_svg]:size-3.5',
        icon: 'atelier-icon-control size-control [&_svg]:size-4',
        'icon-sm': 'atelier-icon-control size-control [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
