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
  /** `underline` allège le contrôle et fait coulisser un trait sous le choix. */
  variant?: 'pill' | 'underline';
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
  variant = 'pill',
  className,
}: SegmentedControlProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex items-center',
        variant === 'pill'
          ? 'border-border bg-surface gap-1 rounded-full border p-1'
          : 'border-border relative gap-0 border-b bg-transparent',
        className,
      )}
    >
      {variant === 'underline' ? (
        <span
          aria-hidden="true"
          className="segmented-underline-indicator pointer-events-none absolute -bottom-px left-0 h-[3px] transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{
            width: `calc(100% / ${options.length})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        >
          <span className="bg-primary mx-3 block h-full rounded-t-full" />
        </span>
      ) : null}

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
              'focus-visible:ring-ring atelier-control min-h-touch relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 px-3 text-xs transition-[color,background-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98] motion-reduce:active:scale-100 sm:min-h-0 sm:flex-none',
              variant === 'pill'
                ? 'atelier-action-tab rounded-full font-semibold sm:py-1.5'
                : 'rounded-none bg-transparent py-2 font-medium shadow-none hover:bg-transparent sm:py-2',
              isActive && variant === 'pill'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : isActive
                  ? 'text-primary'
                  : variant === 'pill'
                    ? 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
                    : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
            <span className={cn(Icon && 'hidden sm:inline')}>{option.label}</span>
            {/* Sous `sm` le libellé est masqué : sans cela le bouton n'aurait
                aucun nom accessible, l'icône étant décorative. */}
            {Icon ? <span className="sr-only sm:hidden">{option.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
