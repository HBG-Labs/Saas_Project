import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * Le tableau de données.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * D'OÙ VIENNENT CES CLASSES
 *
 * Elles ne sont pas choisies ici : elles sont relevées. Vingt-trois écrans
 * écrivent leur propre `<table>`, et quatre d'entre eux portent exactement la
 * même chaîne de classes, au caractère près. Les autres en dérivent d'un
 * réglage ou deux — une densité qui change d'un écran à l'autre sans que
 * personne ne l'ait décidé.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI LE CONTENEUR DÉFILANT EST DANS LA PRIMITIVE
 *
 * Un tableau à `min-w-[760px]` posé nu dans une page fait glisser l'écran
 * entier sur un téléphone. C'est la panne que `08-responsive.spec.ts` guette,
 * et la seule parade fiable est que le défilement appartienne au tableau, pas
 * à la page.
 *
 * Ce conteneur est atteignable au clavier (`tabIndex`), sans quoi le contenu
 * qui dépasse à droite n'est accessible qu'à la souris. C'est ce qui rend
 * `label` obligatoire : une zone focalisable sans nom n'est annoncée par rien.
 * ─────────────────────────────────────────────────────────────────────────────
 */
interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Nom de la zone défilante, annoncé aux lecteurs d'écran. */
  label: string;
  /** Largeur en deçà de laquelle le tableau défile plutôt que de se tasser. */
  minWidth?: string;
  containerClassName?: string;
}

export function Table({
  label,
  minWidth = '760px',
  className,
  containerClassName,
  ...props
}: TableProps) {
  return (
    <div
      role="region"
      aria-label={label}
      /*
        La règle vise les `tabIndex` posés sur du décor, qui créent des arrêts
        de tabulation sans objet. Ici l'arrêt EST l'objet : une zone défilante
        qu'on ne peut pas atteindre au clavier cache définitivement ce qui
        dépasse à droite. C'est le motif recommandé par WCAG 2.1.13, et il
        exige les trois attributs ensemble — rôle, nom, tabulation.
      */
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={cn(
        'focus-visible:ring-ring w-full overflow-x-auto focus-visible:ring-2 focus-visible:outline-none',
        containerClassName,
      )}
    >
      <table
        className={cn('w-full border-collapse text-left text-xs', className)}
        style={{ minWidth }}
        {...props}
      />
    </div>
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />;
}

/** La ligne d'en-tête. Porte le fond et la casse, pour ne pas les répéter par cellule. */
export function TableHeaderRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-border bg-surface-raised/50 text-muted-foreground text-3xs border-b font-bold tracking-wider uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function TableHeaderCell({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn('px-3 py-2.5 sm:px-4', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-border divide-y', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('hover:bg-surface-hover/50 group transition-colors', className)} {...props} />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-3 sm:px-4', className)} {...props} />;
}

/**
 * Cellule de montant.
 *
 * `tabular-nums` aligne les chiffres en colonne : sans lui, une colonne d'euros
 * ondule et deux totaux ne se comparent plus à l'œil.
 */
export function TableAmountCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <TableCell className={cn('text-right font-medium tabular-nums', className)} {...props} />;
}

interface TableEmptyProps {
  /** Nombre de colonnes à couvrir. Sans lui, la cellule casse la grille. */
  colSpan: number;
  children: ReactNode;
}

/**
 * La ligne qui remplace le corps quand il n'y a rien à montrer.
 *
 * Elle ne dessine rien : elle fournit le `<tr><td colSpan>` sans lequel le
 * contenu sortirait de la grille du tableau. Le visuel reste celui d'
 * `EmptyState`, pour qu'une liste vide ait la même allure qu'elle soit rendue
 * en tableau ou en cartes.
 */
export function TableEmpty({ colSpan, children }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-4">
        {children}
      </td>
    </tr>
  );
}
