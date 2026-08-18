import { X, Truck, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
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
  const [assignedMemberId, setAssignedMemberId] = useState<string>(vehicle.assignedMemberId ?? '');
  const [nextCtDate, setNextCtDate] = useState<string>(vehicle.nextCtDate);
  const [nextRevisionDate, setNextRevisionDate] = useState<string>(vehicle.nextRevisionDate);
  const [notes, setNotes] = useState(vehicle.notes ?? '');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedMember = (members.data ?? []).find((m) => m.id === assignedMemberId);

    onUpdate(vehicle.id, {
      plate: plate.toUpperCase().trim(),
      brand: brand.trim(),
      model: model.trim(),
      type,
      fuel,
      status,
      mileage: Number(mileage) || 0,
      assignedMemberId: assignedMemberId || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-surface border-border w-full max-w-xl rounded-2xl border shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Truck className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Modifier le véhicule {vehicle.plate}</h2>
              <p className="text-2xs text-muted-foreground">{vehicle.brand} {vehicle.model}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Immatriculation (Plaque)"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          <div>
            <Select
              label="Technicien assigné par défaut"
              value={assignedMemberId}
              onValueChange={setAssignedMemberId}
              options={[
                { value: '', label: 'Aucun (Véhicule en pool partagé)' },
                ...(members.data ?? []).map((m) => ({
                  value: m.id,
                  label: `${memberDisplayName(m)}${m.job_title ? ` (${m.job_title})` : ''}`,
                })),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div>
            <span className="block text-xs font-medium text-foreground mb-1.5">
              Aménagements spécifiques & Équipements embarqués
            </span>
            <textarea
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Delete confirmation section */}
          {showConfirmDelete ? (
            <div className="p-3 bg-error-subtle border border-error/30 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
              <span className="text-xs text-error font-medium">
                Confirmer la suppression définitive de ce véhicule ?
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmDelete(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                >
                  Supprimer
                </Button>
              </div>
            </div>
          ) : null}

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
            {!showConfirmDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-error hover:bg-error-subtle hover:text-error gap-1.5"
                onClick={() => setShowConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" />
                <span>Retirer de la flotte</span>
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Fermer
              </Button>
              <Button type="submit" variant="primary">
                Enregistrer les modifications
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
