import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { StockConsumable } from '../types/stock.types';
import { ConsumablesTable } from './ConsumablesTable';

const consumable: StockConsumable = {
  id: 'consumable-1',
  organizationId: 'org-1',
  reference: 'CABLE-01',
  name: 'Câble réseau',
  category: 'Câblage & Fibre',
  unit: 'm',
  quantityInStock: 20,
  minThreshold: 5,
  unitPriceEur: 2,
  location: 'Dépôt principal',
  supplier: 'Rexel France',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('ConsumablesTable', () => {
  it('filtre les articles et annonce le nombre de résultats', () => {
    render(
      <ConsumablesTable
        consumables={[consumable]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onQuickAdjust={vi.fn()}
        onRecordMovement={vi.fn()}
        onOrder={vi.fn()}
      />,
    );

    expect(screen.getByText('1 article affiché')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rechercher un article en stock'), {
      target: { value: 'introuvable' },
    });

    expect(screen.getByText('0 articles affichés')).toBeInTheDocument();
    expect(screen.queryByText('Câble réseau')).not.toBeInTheDocument();
  });
});
