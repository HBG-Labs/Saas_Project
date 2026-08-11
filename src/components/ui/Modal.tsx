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
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
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
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />

        <Dialog.Content
          className={cn(
            'bg-surface-raised border-border fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)]',
            'shadow-modal -translate-x-1/2 -translate-y-1/2 rounded-xl border',
            'max-h-[calc(100dvh-4rem)] overflow-y-auto',
            SIZES[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 p-5 pb-0">
            <div className="space-y-1">
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
              className="text-muted-foreground hover:bg-surface-hover hover:text-foreground -mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors cursor-pointer"
              aria-label="Fermer"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {children ? <div className="p-5">{children}</div> : null}

          {footer ? (
            <div className="border-border flex items-center justify-end gap-2 border-t p-5">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
