import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Vehicle } from '../types';
import { AddVehicleModal } from './AddVehicleModal';
import { EditVehicleModal } from './EditVehicleModal';
import { VehicleMaintenanceHistoryModal } from './VehicleMaintenanceHistoryModal';

vi.mock('@/features/organizations', () => ({
  useMembers: () => ({ data: [] }),
  memberDisplayName: () => 'Technicien test',
}));

const vehicle: Vehicle = {
  id: 'vehicle-1',
  organizationId: 'org-1',
  plate: 'AB-123-CD',
  brand: 'Renault',
  model: 'Trafic',
  type: 'van',
  fuel: 'diesel',
  status: 'available',
  mileage: 25_000,
  assignedMemberId: null,
  assignedMemberName: null,
  nextCtDate: '2027-06-01',
  nextRevisionDate: '2027-02-15',
  maintenanceHistory: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('modales de flotte', () => {
  it('ajoute un véhicule non assigné depuis la modale accessible', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(<AddVehicleModal isOpen onClose={onClose} organizationId="org-1" onAdd={onAdd} />);

    expect(screen.getByRole('dialog', { name: 'Ajouter un véhicule à la flotte' })).toBeVisible();
    fireEvent.change(screen.getByLabelText(/Immatriculation/), {
      target: { value: 'zz-987-yy' },
    });
    fireEvent.change(screen.getByLabelText(/Modèle & Version/), {
      target: { value: 'Master L2H2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le véhicule' }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        plate: 'ZZ-987-YY',
        model: 'Master L2H2',
        assignedMemberId: null,
        assignedMemberName: null,
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('demande une confirmation avant de retirer un véhicule', () => {
    const onDelete = vi.fn();

    render(
      <EditVehicleModal
        vehicle={vehicle}
        isOpen
        onClose={vi.fn()}
        organizationId="org-1"
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retirer de la flotte' }));
    expect(screen.getByText(/suppression définitive/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    expect(onDelete).toHaveBeenCalledWith(vehicle.id);
  });

  it('ajoute une opération au carnet d’entretien', () => {
    const onAddRecord = vi.fn();

    render(
      <VehicleMaintenanceHistoryModal
        vehicle={vehicle}
        isOpen
        onClose={vi.fn()}
        onAddRecord={onAddRecord}
      />,
    );

    expect(screen.getByText('Aucun entretien enregistré')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un entretien' }));
    fireEvent.change(screen.getByLabelText(/Description détaillée des travaux/), {
      target: { value: 'Vidange et remplacement des filtres' },
    });
    fireEvent.click(screen.getByRole('button', { name: "Enregistrer l'opération" }));

    expect(onAddRecord).toHaveBeenCalledWith(
      vehicle.id,
      expect.objectContaining({
        type: 'revision',
        description: 'Vidange et remplacement des filtres',
        mileage: vehicle.mileage,
      }),
    );
  });
});
