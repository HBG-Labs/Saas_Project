import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { definedProps } from '@/lib/defined-props';

export interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Élément déclencheur. Omettre pour un contrôle entièrement piloté par `open`. */
  trigger?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Masque le titre visuellement tout en le conservant pour les lecteurs d'écran. */
  hideTitle?: boolean;
}

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
} as const;

/**
 * Boîte de dialogue modale.
 *
 * Construite sur Radix Dialog, qui prend en charge le piège de focus, la
 * restauration du focus à la fermeture, `Échap`, le verrouillage du défilement
 * d'arrière-plan et l'inertie ARIA du reste de la page. Réimplémenter cela
 * correctement représente plusieurs centaines de lignes et se révèle presque
 * toujours partiellement faux.
 *
 * `title` est obligatoire : une modale sans nom accessible laisse l'utilisateur
 * de lecteur d'écran sans contexte. Utiliser `hideTitle` si le design ne
 * l'affiche pas.
 */
export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideTitle = false,
}: ModalProps) {
  return (
    <Dialog.Root {...definedProps({ open, onOpenChange })}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}

      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />

        {/*
          Feuille en bas sur téléphone, boîte centrée à partir de `sm`.

          Une boîte centrée sur mobile est le mauvais objet : le clavier occupe
          la moitié basse de l'écran et la pousse hors cadre, et le pouce doit
          remonter au centre pour agir. Ancrée en bas, elle reste sous la main,
          le clavier la comprime au lieu de la déplacer, et le geste de
          fermeture est celui qu'on attend.

          La hauteur est bornée à 90 % de la hauteur *visible* (`dvh`, pas
          `vh` : sur iOS `vh` ignore la barre d'adresse et déborde), et le
          contenu défile à l'intérieur.
        */}
        <Dialog.Content
          className={cn(
            'bg-surface-raised border-border shadow-modal fixed z-50 flex flex-col',
            'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl border-t',
            'sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100vw-2rem)]',
            'sm:max-h-[calc(100dvh-4rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border',
            'data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-bottom',
            'sm:data-[state=open]:zoom-in-95',
            SIZES[size],
          )}
        >
          {/* Poignée : dit que l'objet vient du bas et qu'il s'y renvoie. */}
          <div
            className="bg-border-strong mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full sm:hidden"
            aria-hidden="true"
          />

          <div className="flex shrink-0 items-start justify-between gap-4 p-5 pb-0">
            <div className="min-w-0 space-y-1">
              <Dialog.Title className={cn('text-base font-semibold', hideTitle && 'sr-only')}>
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-muted-foreground text-xs">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>

            <Dialog.Close
              className="text-muted-foreground hover:bg-surface-hover hover:text-foreground -mt-1 -mr-1 flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors sm:size-8"
              aria-label="Fermer"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* Seul le corps défile : titre et pied restent atteignables. */}
          {children ? <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div> : null}

          {footer ? (
            <div className="border-border safe-bottom flex shrink-0 flex-col-reverse gap-2 border-t p-5 sm:flex-row sm:items-center sm:justify-end sm:pb-5">
              {footer}
            </div>
          ) : null}

          {/* Sans pied déclaré, c'est le corps qui doit dégager la barre gestuelle. */}
          {footer ? null : <div className="safe-bottom shrink-0 sm:hidden" aria-hidden="true" />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
