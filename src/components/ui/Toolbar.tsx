import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Input } from './Input';

/**
 * La barre d'outils d'une liste : rechercher, filtrer, agir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI LE COMPTE EST ANNONCÉ
 *
 * Taper dans le champ de recherche remplace la liste sans rien dire : à la
 * souris on voit le tableau bouger, au lecteur d'écran il ne se passe
 * strictement rien. Le `aria-live` fait de « 3 fournisseurs affichés » le seul
 * retour que reçoivent certaines personnes — c'est pour cela qu'il est ici, et
 * non laissé à la discrétion de chaque écran.
 *
 * Le libellé du champ est porté mais masqué : un champ de recherche sans
 * étiquette n'est qu'un rectangle, et le texte indicatif disparaît à la frappe.
 * ─────────────────────────────────────────────────────────────────────────────
 */
interface ToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Étiquette accessible du champ. Visuellement masquée, jamais absente. */
  searchLabel: string;
  searchPlaceholder?: string;
  /**
   * Le décompte des résultats, annoncé à chaque changement.
   *
   * L'accord reste à l'appelant : « affiché » et « affichée » ne se devinent
   * pas depuis un nombre, et une primitive qui essaierait produirait du faux
   * français une fois sur deux.
   */
  summary?: ReactNode;
  /** Filtres, tris, sélecteurs de période. */
  children?: ReactNode;
  /** Actions alignées à droite. */
  actions?: ReactNode;
  className?: string;
}

export function Toolbar({
  searchValue,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
  summary,
  children,
  actions,
  className,
}: ToolbarProps) {
  return (
    <div className={cn('border-border border-b p-3 sm:p-4', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input
            label={searchLabel}
            hideLabel
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            leadingIcon={<Search aria-hidden="true" />}
            className="bg-surface-raised"
          />
        </div>

        {children ? (
          <div className="flex flex-wrap items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
            {children}
          </div>
        ) : null}

        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {summary ? (
        <p className="text-muted-foreground text-3xs mt-2" aria-live="polite">
          {summary}
        </p>
      ) : null}
    </div>
  );
}
