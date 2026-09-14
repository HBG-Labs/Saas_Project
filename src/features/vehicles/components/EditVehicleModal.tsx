import { Trash2, Truck } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useMembers, memberDisplayName } from '@/features/organizations';
import type { Vehicle, VehicleFuel, VehicleStatus, VehicleType } from '../types';

interface EditVehicleModalProps {
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onUpdate: (vehicleId: string, updates: Partial<Vehicle>) => void;
  onDelete: (vehicleId: string) => void;
}

const UNASSIGNED_MEMBER = 'unassigned';

export function EditVehicleModal({
  vehicle,
  isOpen,
  onClose,
  organizationId,
  onUpdate,
  onDelete,
}: EditVehicleModalProps) {
  const members = useMembers(organizationId);

  const [plate, setPlate] = useState(vehicle.plate);
  const [brand, setBrand] = useState(vehicle.brand);
  const [model, setModel] = useState(vehicle.model);
  const [type, setType] = useState<VehicleType>(vehicle.type);
  const [fuel, setFuel] = useState<VehicleFuel>(vehicle.fuel);
  const [status, setStatus] = useState<VehicleStatus>(vehicle.status);
  const [mileage, setMileage] = useState<number>(vehicle.mileage);
  const [assignedMemberId, setAssignedMemberId] = useState<string>(
    vehicle.assignedMemberId ?? UNASSIGNED_MEMBER,
  );
  const [nextCtDate, setNextCtDate] = useState<string>(vehicle.nextCtDate);
  const [nextRevisionDate, setNextRevisionDate] = useState<string>(vehicle.nextRevisionDate);
  const [notes, setNotes] = useState(vehicle.notes ?? '');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedMember = (members.data ?? []).find((m) => m.id === assignedMemberId);
    const hasAssignedMember = assignedMemberId !== UNASSIGNED_MEMBER;

    onUpdate(vehicle.id, {
      plate: plate.toUpperCase().trim(),
      brand: brand.trim(),
      model: model.trim(),
      type,
      fuel,
      status,
      mileage: Number(mileage) || 0,
      assignedMemberId: hasAssignedMember ? assignedMemberId : null,
      assignedMemberName: assignedMember ? memberDisplayName(assignedMember) : null,
      nextCtDate,
      nextRevisionDate,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  const handleDelete = () => {
    onDelete(vehicle.id);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={`Modifier le véhicule ${vehicle.plate}`}
      description={`${vehicle.brand} ${vehicle.model} · identité, affectation et entretien.`}
      size="lg"
      footer={
        showConfirmDelete ? (
          <div className="bg-error-subtle border-error-border flex w-full flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-error text-xs font-medium">
              Confirmer la suppression définitive de ce véhicule ?
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmDelete(false)}
                className="min-h-touch flex-1 sm:min-h-0 sm:flex-none"
              >
                Conserver
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDelete}
                className="min-h-touch flex-1 sm:min-h-0 sm:flex-none"
              >
                Supprimer
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-error hover:bg-error-subtle hover:text-error min-h-touch gap-1.5 sm:min-h-0"
              onClick={() => setShowConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Retirer de la flotte
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="min-h-touch flex-1 sm:min-h-0 sm:flex-none"
              >
                Fermer
              </Button>
              <Button
                type="submit"
                form="edit-vehicle-form"
                variant="primary"
                className="min-h-touch flex-[1.35] gap-2 sm:min-h-0 sm:flex-none"
              >
                <Truck className="size-4" aria-hidden="true" />
                Enregistrer
              </Button>
            </div>
          </div>
        )
      }
    >
      <form id="edit-vehicle-form" onSubmit={handleSubmit} className="space-y-5">
        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Identité du véhicule</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Corrigez les informations affichées dans la flotte et les exports.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Immatriculation"
              required
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
            />

            <Select
              label="Marque"
              value={brand}
              onValueChange={setBrand}
              options={[
                { value: 'Renault', label: 'Renault' },
                { value: 'Peugeot', label: 'Peugeot' },
                { value: 'Citroën', label: 'Citroën' },
                { value: 'Mercedes-Benz', label: 'Mercedes-Benz' },
                { value: 'Ford', label: 'Ford' },
                { value: 'Volkswagen', label: 'Volkswagen' },
                { value: 'Iveco', label: 'Iveco' },
                { value: 'Nissan', label: 'Nissan' },
                { value: 'Toyota', label: 'Toyota' },
                { value: 'Autre', label: 'Autre constructeur' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Modèle & Version"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />

            <Select
              label="Type de carrosserie / gabarit"
              value={type}
              onValueChange={(val) => setType(val as VehicleType)}
              options={[
                { value: 'van', label: 'Fourgon / Atelier mobile (L2/L3)' },
                { value: 'utility', label: 'Fourgonnette compacte (Partner/Kangoo)' },
                { value: 'car', label: 'Véhicule Léger (VL Commercial)' },
                { value: 'aerial_lift', label: 'Poids Lourd / Camion Nacelle' },
                { value: 'truck', label: 'Plateau / Benne de chantier' },
              ]}
            />
          </div>
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Usage & affectation</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Mettez à jour son état opérationnel et son conducteur habituel.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select
              label="Motorisation"
              value={fuel}
              onValueChange={(val) => setFuel(val as VehicleFuel)}
              options={[
                { value: 'diesel', label: 'Diesel (Gazole)' },
                { value: 'electric', label: '100% Électrique (EV)' },
                { value: 'hybrid', label: 'Hybride / Rechargeable' },
                { value: 'essence', label: 'Essence (SP95/E10)' },
              ]}
            />

            <Select
              label="Statut opérationnel"
              value={status}
              onValueChange={(val) => setStatus(val as VehicleStatus)}
              options={[
                { value: 'available', label: 'Disponible au dépôt' },
                { value: 'in_service', label: 'En service / Sur le terrain' },
                { value: 'maintenance', label: 'En maintenance / Garage' },
                { value: 'out_of_service', label: 'Hors service / Réformé' },
              ]}
            />

            <Input
              label="Compteur actuel (km)"
              type="number"
              min={0}
              value={mileage}
              onChange={(e) => setMileage(Number(e.target.value))}
            />
          </div>

          <Select
            label="Technicien assigné par défaut"
            value={assignedMemberId}
            onValueChange={setAssignedMemberId}
            options={[
              { value: UNASSIGNED_MEMBER, label: 'Aucun (Véhicule en pool partagé)' },
              ...(members.data ?? []).map((m) => ({
                value: m.id,
                label: `${memberDisplayName(m)}${m.job_title ? ` (${m.job_title})` : ''}`,
              })),
            ]}
          />
        </section>

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Entretien & équipements</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Ajustez les échéances et la description de l’aménagement embarqué.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Prochain Contrôle Technique (CT)"
              type="date"
              value={nextCtDate}
              onChange={(e) => setNextCtDate(e.target.value)}
            />

            <Input
              label="Prochaine Révision / Vidange"
              type="date"
              value={nextRevisionDate}
              onChange={(e) => setNextRevisionDate(e.target.value)}
            />
          </div>

          <Textarea
            label="Aménagements spécifiques & équipements embarqués"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </section>
      </form>
    </Modal>
  );
}
