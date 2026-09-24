import { useCallback, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal, type ModalProps } from '@/components/ui/Modal';

interface UnsavedFormModalProps extends Omit<ModalProps, 'footer' | 'onOpenChange'> {
  open: boolean;
  dirty: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard?: () => void;
  renderFooter?: (requestClose: () => void) => ReactNode;
  closeConfirmationTitle?: string;
  closeConfirmationDescription?: string;
  closeConfirmationContinueAction?: string;
  closeConfirmationAction?: string;
}

/**
 * Variante de `Modal` pour les formulaires locaux.
 *
 * La confirmation remplace temporairement le contenu du même panneau : le
 * formulaire reste monté et conserve donc ses valeurs si l'utilisateur choisit
 * de poursuivre. Une fermeture validée peut, elle, réinitialiser explicitement
 * le formulaire grâce à `onDiscard`.
 */
export function UnsavedFormModal({
  open,
  dirty,
  onOpenChange,
  onDiscard,
  renderFooter,
  closeConfirmationTitle = 'Quitter sans enregistrer ?',
  closeConfirmationDescription = 'Vos modifications non enregistrées seront perdues.',
  closeConfirmationContinueAction = 'Continuer à modifier',
  closeConfirmationAction = 'Quitter sans enregistrer',
  title,
  description,
  children,
  ...modalProps
}: UnsavedFormModalProps) {
  const [confirmingClose, setConfirmingClose] = useState(false);

  const requestClose = useCallback(() => {
    if (dirty) {
      setConfirmingClose(true);
      return;
    }
    onOpenChange(false);
  }, [dirty, onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setConfirmingClose(false);
        onOpenChange(true);
        return;
      }
      requestClose();
    },
    [onOpenChange, requestClose],
  );

  const discard = () => {
    onDiscard?.();
    setConfirmingClose(false);
    onOpenChange(false);
  };

  return (
    <Modal
      {...modalProps}
      open={open}
      onOpenChange={handleOpenChange}
      title={confirmingClose ? closeConfirmationTitle : title}
      {...(!confirmingClose && description !== undefined ? { description } : {})}
      footer={
        confirmingClose ? (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setConfirmingClose(false);
              }}
            >
              {closeConfirmationContinueAction}
            </Button>
            <Button type="button" variant="danger" className="w-full sm:w-auto" onClick={discard}>
              {closeConfirmationAction}
            </Button>
          </div>
        ) : (
          renderFooter?.(requestClose)
        )
      }
    >
      <div hidden={confirmingClose}>{children}</div>
      {confirmingClose ? (
        <p className="text-muted-foreground text-sm">{closeConfirmationDescription}</p>
      ) : null}
    </Modal>
  );
}
