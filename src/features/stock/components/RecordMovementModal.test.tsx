import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RecordMovementModal } from './RecordMovementModal';
import type { StockConsumable } from '../types/stock.types';

const mockConsumables: StockConsumable[] = [
  {
    id: 'c1',
    organizationId: 'org1',
    reference: 'FBR-CAB-4FO',
    name: 'Câble Fibre Optique 4 FO',
    category: 'Câblage & Fibre',
    unit: 'm',
    quantityInStock: 500,
    minThreshold: 100,
    unitPriceEur: 0.5,
    sellingPriceEur: 1.0,
    location: 'Dépôt Central',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

describe('RecordMovementModal', () => {
  it('affiche le formulaire et permet de soumettre une entrée de stock', async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();

    render(
      <RecordMovementModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        consumables={mockConsumables}
        initialConsumable={mockConsumables[0]}
        initialType="in"
      />,
    );

    expect(screen.getByText('Déclarer un mouvement de stock')).toBeInTheDocument();
    expect(screen.getByText(/Impact sur le stock/i)).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /Valider le mouvement/i });
    fireEvent.click(submitButton);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        consumableId: 'c1',
        type: 'in',
        quantity: 1,
      }),
    );
  });

  it('permet de basculer en sortie et d’ajouter un technicien et référence', async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();

    render(
      <RecordMovementModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        consumables={mockConsumables}
        initialConsumable={mockConsumables[0]}
      />,
    );

    // Cliquer sur le bouton Sortie
    const sortieButton = screen.getByRole('button', { name: /Sortie/i });
    fireEvent.click(sortieButton);

    // Renseigner technicien
    const techInput = screen.getByPlaceholderText(/Thomas Martin/i);
    fireEvent.change(techInput, { target: { value: 'Jean Dupont' } });

    // Renseigner réf intervention
    const intInput = screen.getByPlaceholderText(/INT-2026-081/i);
    fireEvent.change(intInput, { target: { value: 'INT-400' } });

    const submitButton = screen.getByRole('button', { name: /Valider le mouvement/i });
    fireEvent.click(submitButton);

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'out',
        technicianName: 'Jean Dupont',
        interventionRef: 'INT-400',
      }),
    );
  });
});
