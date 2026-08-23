import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReceiveOrderModal } from './ReceiveOrderModal';
import type { PurchaseOrder } from '../types/purchases.types';

const mockOrder: PurchaseOrder = {
  id: 'po-test-1',
  reference: 'CMD-2026-001',
  organizationId: 'org-test',
  supplierId: 'sup-1',
  supplierName: 'Rexel France',
  status: 'sent',
  orderDate: '2026-08-20',
  items: [
    {
      id: 'item-1',
      reference: 'ELEC-DISJ-16A',
      description: 'Disjoncteur 16A',
      unit: 'pièce',
      quantityOrdered: 20,
      quantityReceived: 0,
      unitPriceEur: 5.0,
      totalEur: 100.0,
    },
  ],
  subtotalEur: 100.0,
  taxRate: 0.2,
  taxEur: 20.0,
  totalEur: 120.0,
  createdAt: '2026-08-20T10:00:00Z',
  updatedAt: '2026-08-20T10:00:00Z',
};

describe('ReceiveOrderModal', () => {
  it('affiche les articles à réceptionner et permet de valider la réception', () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();

    render(
      <ReceiveOrderModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        order={mockOrder}
      />,
    );

    expect(screen.getByText(/Pointage BL & Réception — CMD-2026-001/i)).toBeInTheDocument();
    expect(screen.getByText('ELEC-DISJ-16A')).toBeInTheDocument();
    expect(screen.getByText('Disjoncteur 16A')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Valider la réception/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith(
      'po-test-1',
      { 'item-1': 20 },
      undefined,
    );
  });
});
