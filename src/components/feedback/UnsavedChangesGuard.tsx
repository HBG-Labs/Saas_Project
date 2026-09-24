import { useCallback } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface UnsavedChangesGuardProps {
  when: boolean;
  title?: string;
  description?: string;
}

/**
 * Protège une saisie locale contre les navigations internes et la fermeture
 * du navigateur. La boîte REZO360 remplace `window.confirm` dans l'application ;
 * le navigateur conserve son propre message lors d'une fermeture d'onglet.
 */
export function UnsavedChangesGuard({
  when,
  title = 'Quitter sans enregistrer ?',
  description = 'Vos modifications non enregistrées seront perdues.',
}: UnsavedChangesGuardProps) {
  const shouldBlock = useCallback(
    ({
      currentLocation,
      nextLocation,
    }: {
      currentLocation: { pathname: string; search: string };
      nextLocation: { pathname: string; search: string };
    }) =>
      when &&
      `${currentLocation.pathname}${currentLocation.search}` !==
        `${nextLocation.pathname}${nextLocation.search}`,
    [when],
  );
  const blocker = useBlocker(shouldBlock);

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!when) return;
        event.preventDefault();
        event.returnValue = '';
      },
      [when],
    ),
  );

  return (
    <Modal
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset();
      }}
      title={title}
      description={description}
      size="sm"
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => {
            if (blocker.state === 'blocked') blocker.reset();
          }}
        >
          Continuer à modifier
        </Button>
        <Button
          type="button"
          variant="danger"
          className="w-full sm:w-auto"
          onClick={() => {
            if (blocker.state === 'blocked') blocker.proceed();
          }}
        >
          Quitter sans enregistrer
        </Button>
      </div>
    </Modal>
  );
}
