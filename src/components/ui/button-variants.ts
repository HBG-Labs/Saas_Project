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
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap cursor-pointer select-none',
    'transition-[color,background-color,border-color,box-shadow,transform] duration-[120ms] ease-out-expo active:scale-[0.98] motion-reduce:transform-none',
    'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_*]:pointer-events-none',
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
        danger: 'bg-error text-error-foreground hover:bg-error/90 active:bg-error/80 shadow-xs',
        'danger-outline':
          'border border-error-border bg-error-subtle text-error hover:border-error hover:bg-error/15 active:bg-error/20 shadow-xs font-medium',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      /*
        Deux hauteurs par taille : 40 px sur les écrans étroits pour alléger
        l'interface sans rendre les commandes délicates à viser, puis une
        densité adaptée au pointeur à partir de `sm`. Les actions `lg` restent
        à 44 px pour conserver une hiérarchie claire.
      */
      size: {
        sm: 'h-11 px-3 text-xs sm:h-8 [&_svg]:size-3.5',
        md: 'h-11 px-3.5 text-sm sm:h-9 sm:px-4 [&_svg]:size-4',
        lg: 'h-11 px-5 text-sm [&_svg]:size-4',
        icon: 'size-11 sm:size-9 [&_svg]:size-4',
        'icon-sm': 'size-11 sm:size-8 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
