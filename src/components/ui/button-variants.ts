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
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap',
    'transition-colors duration-[120ms] ease-out-expo',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        secondary: 'bg-surface-hover text-foreground hover:bg-border active:bg-border-strong',
        outline:
          'border border-border-strong bg-surface text-foreground hover:bg-surface-hover active:bg-border',
        ghost: 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
        danger: 'bg-error text-white hover:opacity-90 active:opacity-80',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        md: 'h-9 px-4 text-sm [&_svg]:size-4',
        // 44 px : cible tactile minimale, taille par défaut sur mobile.
        lg: 'h-11 px-6 text-sm [&_svg]:size-4',
        icon: 'size-9 [&_svg]:size-4',
        'icon-sm': 'size-8 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
