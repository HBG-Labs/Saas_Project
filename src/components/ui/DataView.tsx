import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/cn';

import { Card } from './Card';
import { Table, TableBody, TableEmpty, TableHead, TableHeaderRow, TableRow } from './Table';

/**
 * Une liste de données, en tableau sur grand écran et en cartes sur téléphone.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI LES DEUX RENDUS VIVENT ENSEMBLE
 *
 * Les écrans qui affichent une liste écrivent aujourd'hui deux fois la même
 * chose : une pile de cartes en `md:hidden`, puis un tableau en `hidden
 * md:table`. Séparés, les deux divergent — une colonne ajoutée au tableau
 * n'apparaît pas sur téléphone, et l'état vide finit rédigé différemment de
 * part et d'autre. C'est arrivé : plusieurs écrans portent deux textes vides
 * distincts pour la même situation.
 *
 * Les réunir ne fusionne pas les deux mises en page — elles répondent à des
 * contraintes différentes et doivent rester distinctes. Cela garantit qu'elles
 * parlent des mêmes données, du même vide, et du même nombre de colonnes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE LE COMPOSANT NE FAIT PAS
 *
 * Ni tri, ni pagination, ni filtrage : les écrans qui existent filtrent déjà
 * eux-mêmes, avec leurs propres règles métier. Reprendre ce travail ici
 * demanderait de les réécrire tous en même temps — c'est l'étape suivante, pas
 * celle-ci.
 * ─────────────────────────────────────────────────────────────────────────────
 */
interface DataViewProps<T> {
  items: readonly T[];
  /** Identifiant stable d'une ligne. React en a besoin, et les tests aussi. */
  getKey: (item: T) => string;

  /** Nom du tableau, annoncé sur la zone défilante. */
  label: string;
  /** Les `<TableHeaderCell>` de l'en-tête. */
  head: ReactNode;
  /**
   * Nombre de colonnes.
   *
   * Sert au `colSpan` de l'état vide. Le déduire de `head` supposerait de
   * compter des enfants React, ce qui casse dès qu'un en-tête est produit par
   * une boucle ou un fragment.
   */
  columnCount: number;
  /** Les `<TableCell>` d'une ligne. L'enveloppe `<tr>` est posée ici. */
  renderRow: (item: T) => ReactNode;

  /** Le contenu d'une carte, sur téléphone. */
  renderCard: (item: T) => ReactNode;

  empty: {
    icon?: LucideIcon;
    illustration?: ReactNode;
    title: string;
    description: string;
    action?: ReactNode;
  };

  /** Recherche et filtres. Un `<Toolbar>`, en général. */
  toolbar?: ReactNode;
  className?: string;
  /** Point de bascule entre cartes et tableau. */
  breakpoint?: 'md' | 'lg';
}

const BASCULE = {
  md: { cartes: 'md:hidden', tableau: 'hidden md:block' },
  lg: { cartes: 'lg:hidden', tableau: 'hidden lg:block' },
} as const;

export function DataView<T>({
  items,
  getKey,
  label,
  head,
  columnCount,
  renderRow,
  renderCard,
  empty,
  toolbar,
  className,
  breakpoint = 'md',
}: DataViewProps<T>) {
  const bascule = BASCULE[breakpoint];
  const vide = items.length === 0;

  /*
    Le même état vide des deux côtés. C'est tout l'intérêt de l'avoir monté une
    seule fois : deux rédactions pour une même situation, c'est une incohérence
    que personne ne voit puisqu'on ne regarde jamais les deux tailles d'écran en
    même temps.
  */
  const etatVide = (
    <EmptyState
      // `exactOptionalPropertyTypes` distingue « absent » de « présent et
      // indéfini » : passer `icon={undefined}` n'est pas la même chose que ne
      // pas passer `icon`. D'où l'étalement conditionnel.
      {...(empty.icon ? { icon: empty.icon } : {})}
      {...(empty.illustration ? { illustration: empty.illustration } : {})}
      {...(empty.action ? { action: empty.action } : {})}
      title={empty.title}
      description={empty.description}
      size="sm"
      className="border-0 bg-transparent"
    />
  );

  return (
    <Card className={cn('overflow-hidden', className)}>
      {toolbar}

      {/* Téléphone : une carte par élément. */}
      <div className={bascule.cartes}>
        {vide ? (
          <div className="p-4">{etatVide}</div>
        ) : (
          <div className="divide-border divide-y">
            {items.map((item) => (
              <article key={getKey(item)} className="space-y-3 p-4">
                {renderCard(item)}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Grand écran : le tableau. */}
      <div className={bascule.tableau}>
        <Table label={label}>
          <TableHead>
            <TableHeaderRow>{head}</TableHeaderRow>
          </TableHead>
          <TableBody>
            {vide ? (
              <TableEmpty colSpan={columnCount}>{etatVide}</TableEmpty>
            ) : (
              items.map((item) => <TableRow key={getKey(item)}>{renderRow(item)}</TableRow>)
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
