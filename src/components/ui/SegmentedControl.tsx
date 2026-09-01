import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  /** Libellé lisible. Masqué sous `sm`, où l'icône suffit. */
  label: string;
  icon?: LucideIcon;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Nom du groupe pour les lecteurs d'écran, ex. « Mode d'affichage ». */
  label: string;
  className?: string;
}

/**
 * Sélecteur segmenté — un choix parmi deux ou trois, tous visibles.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE COMPOSANT EXISTE
 *
 * Quatre écrans (`ToolsPage`, `FavoritesPage`, `MetiersHomePage`,
 * `MetierTradePage`) portaient la même bascule liste/grille recopiée mot pour
 * mot : même conteneur, mêmes vingt classes par bouton, même `title`. Une
 * correction devait être appliquée quatre fois — et l'a rarement été.
 *
 * DEUX CHOSES SONT CORRIGÉES AU PASSAGE
 *
 * La cible tactile : les copies utilisaient `px-3 py-1.5`, soit environ 30 px
 * de haut. Un doigt fait 9 mm et la norme demande 44 px (WCAG 2.5.5). Le
 * segment part donc de `min-h-touch` et ne se comprime qu'à partir de `sm`, où
 * l'entrée est presque toujours un pointeur.
 *
 * La sémantique : c'était une rangée de `<button>` sans lien entre eux. Un
 * lecteur d'écran annonçait deux boutons quelconques, sans dire qu'ils forment
 * un choix ni lequel est actif. `role="radiogroup"` et `aria-checked` le
 * disent.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'border-border bg-surface shadow-xs flex items-center gap-1 rounded-lg border p-1',
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => {
              onValueChange(option.value);
            }}
            className={cn(
              'min-h-touch flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors sm:min-h-0 sm:flex-none sm:py-1.5',
              isActive
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover',
            )}
          >
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
            <span className="hidden sm:inline">{option.label}</span>
            {/* Sous `sm` le libellé est masqué : sans cela le bouton n'aurait
                aucun nom accessible, l'icône étant décorative. */}
            <span className="sr-only sm:hidden">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
