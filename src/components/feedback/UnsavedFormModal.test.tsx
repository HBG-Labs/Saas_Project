import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/Button';

import { UnsavedFormModal } from './UnsavedFormModal';

function TestFormModal({ onDiscard = vi.fn() }: { onDiscard?: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ouvrir
      </button>
      <UnsavedFormModal
        open={open}
        onOpenChange={setOpen}
        dirty={value !== ''}
        onDiscard={() => {
          setValue('');
          onDiscard();
        }}
        title="Modifier la fiche"
        renderFooter={(requestClose) => (
          <Button variant="outline" onClick={requestClose}>
            Annuler
          </Button>
        )}
      >
        <label>
          Nom
          <input value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
      </UnsavedFormModal>
    </>
  );
}

describe('UnsavedFormModal', () => {
  it('ferme immédiatement un formulaire intact', async () => {
    const user = userEvent.setup();
    render(<TestFormModal />);

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Modifier la fiche' });
    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('conserve la saisie quand la fermeture est annulée puis la réinitialise si elle est confirmée', async () => {
    const onDiscard = vi.fn();
    const user = userEvent.setup();
    render(<TestFormModal onDiscard={onDiscard} />);

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    await user.type(screen.getByRole('textbox', { name: 'Nom' }), 'Client conservé');
    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('dialog', { name: 'Quitter sans enregistrer ?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continuer à modifier' }));
    expect(screen.getByRole('textbox', { name: 'Nom' })).toHaveValue('Client conservé');

    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    await user.click(screen.getByRole('button', { name: 'Quitter sans enregistrer' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    expect(screen.getByRole('textbox', { name: 'Nom' })).toHaveValue('');
  });
});
