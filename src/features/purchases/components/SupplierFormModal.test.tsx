import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { SupplierFormModal } from './SupplierFormModal';

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('SupplierFormModal', () => {
  it('enregistre séparément les informations légales et postales', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(<SupplierFormModal isOpen onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.getByRole('dialog', { name: 'Ajouter un fournisseur' })).toBeVisible();

    fireEvent.change(screen.getByLabelText(/Raison sociale/), {
      target: { value: '  Fournitures Terrain  ' },
    });
    fireEvent.change(screen.getByLabelText('SIRET'), {
      target: { value: '12345678901234' },
    });
    fireEvent.change(screen.getByLabelText('Code postal'), {
      target: { value: '75009' },
    });
    fireEvent.change(screen.getByLabelText('Ville'), {
      target: { value: 'Paris' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le fournisseur' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Fournitures Terrain',
          siret: '12345678901234',
          postalCode: '75009',
          city: 'Paris',
        }),
      );
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
