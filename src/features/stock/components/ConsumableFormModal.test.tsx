import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ConsumableFormModal } from './ConsumableFormModal';

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('ConsumableFormModal', () => {
  it('ajoute un article avec une référence normalisée', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(<ConsumableFormModal isOpen onClose={onClose} onSubmit={onSubmit} />);

    expect(screen.getByRole('dialog', { name: 'Ajouter un article / fourniture' })).toBeVisible();

    fireEvent.change(screen.getByLabelText(/Référence \/ SKU/), {
      target: { value: '  cab-001  ' },
    });
    fireEvent.change(screen.getByLabelText(/Désignation de l’article/), {
      target: { value: '  Câble chantier  ' },
    });
    fireEvent.change(screen.getByLabelText('Fournisseur habituel'), {
      target: { value: '  Rexel  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter l’article' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'CAB-001',
          name: 'Câble chantier',
          supplier: 'Rexel',
          quantityInStock: 10,
          minThreshold: 5,
        }),
      );
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
