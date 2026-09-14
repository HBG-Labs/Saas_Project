import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PurchaseOrder, Supplier } from '../types/purchases.types';
import { PurchaseOrdersTable } from './PurchaseOrdersTable';
import { SuppliersTable } from './SuppliersTable';

const supplier: Supplier = {
  id: 'supplier-1',
  organizationId: 'org-1',
  name: 'Rexel France',
  code: 'REX-01',
  contactName: 'Camille Martin',
  email: 'camille@example.test',
  phone: '0102030405',
  city: 'Lyon',
  postalCode: '69000',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const order: PurchaseOrder = {
  id: 'order-1',
  organizationId: 'org-1',
  supplierId: supplier.id,
  supplierName: supplier.name,
  reference: 'PO-2026-001',
  status: 'sent',
  orderDate: '2026-09-01',
  expectedDeliveryDate: '2026-09-18',
  items: [
    {
      id: 'item-1',
      reference: 'CABLE-01',
      description: 'Câble réseau',
      unit: 'm',
      quantityOrdered: 20,
      quantityReceived: 10,
      unitPriceEur: 2,
      totalEur: 40,
    },
  ],
  subtotalEur: 40,
  taxRate: 0.2,
  taxEur: 8,
  totalEur: 48,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
};

describe('listes achats responsive', () => {
  it('filtre les fournisseurs depuis le champ accessible', () => {
    render(
      <SuppliersTable
        suppliers={[supplier]}
        orders={[order]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCreateOrder={vi.fn()}
      />,
    );

    expect(screen.getByText('1 fournisseur affiché')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rechercher un fournisseur'), {
      target: { value: 'introuvable' },
    });

    expect(screen.getByText('0 fournisseurs affichés')).toBeInTheDocument();
    expect(screen.queryByText('Rexel France')).not.toBeInTheDocument();
  });

  it('filtre les commandes depuis la recherche sans perdre le résumé', () => {
    render(
      <PurchaseOrdersTable
        orders={[order]}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReceive={vi.fn()}
        onSend={vi.fn()}
      />,
    );

    expect(screen.getByText('1 commande affichée')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rechercher une commande fournisseur'), {
      target: { value: 'introuvable' },
    });

    expect(screen.getByText('0 commandes affichées')).toBeInTheDocument();
    expect(screen.getByText('Aucun bon de commande trouvé')).toBeInTheDocument();
  });
});
