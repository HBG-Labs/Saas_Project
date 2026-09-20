import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * Le conteneur d'une page applicative.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QU'IL REMPLACE
 *
 * Vingt-neuf pages ouvrent sur `<div className="mx-auto max-w-Nxl space-y-N
 * pb-N">`. La largeur est un choix légitime — une fiche ne se lit pas comme un
 * tableau de bord — mais le reste a dérivé : `space-y-4` contre `space-y-6`,
 * `pb-6` contre `pb-10` contre `pb-12` contre `pb-16`, sans qu'aucune de ces
 * variations ne corresponde à une décision.
 *
 * La largeur reste donc réglable, le rythme vertical ne l'est plus.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE TABLE ET NON UNE CHAÎNE CONSTRUITE
 *
 * `max-w-${width}xl` ne marcherait pas : Tailwind lit le code source pour
 * savoir quelles classes produire, et ne voit pas une chaîne assemblée à
 * l'exécution. La classe doit exister littéralement quelque part.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const LARGEURS = {
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
} as const;

export type PageShellWidth = keyof typeof LARGEURS;

interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Largeur maximale du contenu.
   *
   * `6xl` par défaut : c'est la valeur des listes et des tableaux, la plus
   * fréquente. Une fiche ou un formulaire descend à `4xl` ou `3xl`, où une
   * ligne de texte reste lisible d'un bout à l'autre.
   */
  width?: PageShellWidth;
}

export function PageShell({ width = '6xl', className, ...props }: PageShellProps) {
  return <div className={cn('mx-auto space-y-6 pb-12', LARGEURS[width], className)} {...props} />;
}
