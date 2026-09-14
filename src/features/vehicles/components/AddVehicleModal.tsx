import { Truck } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useMembers, memberDisplayName } from '@/features/organizations';
import type { Vehicle, VehicleFuel, VehicleStatus, VehicleType } from '../types';

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onAdd: (vehicle: Omit<Vehicle, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => void;
}

const UNASSIGNED_MEMBER = 'unassigned';

export function AddVehicleModal({ isOpen, onClose, organizationId, onAdd }: AddVehicleModalProps) {
  const members = useMembers(organizationId);

  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('Renault');
  const [model, setModel] = useState('');
  const [type, setType] = useState<VehicleType>('van');
  const [fuel, setFuel] = useState<VehicleFuel>('diesel');
  const [status, setStatus] = useState<VehicleStatus>('available');
  const [mileage, setMileage] = useState<number>(15000);
  const [assignedMemberId, setAssignedMemberId] = useState<string>(UNASSIGNED_MEMBER);
  const [nextCtDate, setNextCtDate] = useState<string>('2027-06-01');
  const [nextRevisionDate, setNextRevisionDate] = useState<string>('2027-02-15');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim()) {
      setError("L'immatriculation est obligatoire.");
      return;
    }
    if (!model.trim()) {
      setError('Le modèle du véhicule est obligatoire.');
      return;
    }

    const assignedMember = (members.data ?? []).find((m) => m.id === assignedMemberId);
    const hasAssignedMember = assignedMemberId !== UNASSIGNED_MEMBER;

    onAdd({
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

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Ajouter un véhicule à la flotte"
      description="Renseignez son identité, son affectation et ses prochaines échéances."
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-h-touch sm:min-h-0"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="add-vehicle-form"
            variant="primary"
            className="min-h-touch gap-2 sm:min-h-0"
          >
            <Truck className="size-4" aria-hidden="true" />
            Enregistrer le véhicule
          </Button>
        </>
      }
    >
      <form id="add-vehicle-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div
            role="alert"
            className="bg-error-subtle border-error-border text-error rounded-xl border p-3 text-xs"
          >
            {error}
          </div>
        )}

        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4">
          <div>
            <h3 className="text-foreground text-sm font-semibold">Identité du véhicule</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Les informations utilisées dans la flotte et les exports.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Immatriculation"
              placeholder="Ex: AB-123-CD"
              required
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              hint="Format standard ou ancien"
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
              placeholder="Ex: Trafic L2H1, Master III, Partner..."
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
              Situez immédiatement le véhicule dans l’organisation du terrain.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select
              label="Motorisation / Carburant"
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
              Anticipez les contrôles et gardez une trace de l’aménagement embarqué.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Prochain Contrôle Technique (CT)"
              type="date"
              value={nextCtDate}
              onChange={(e) => setNextCtDate(e.target.value)}
              hint="Rappel automatique des échéances"
            />

            <Input
              label="Prochaine Révision / Vidange"
              type="date"
              value={nextRevisionDate}
              onChange={(e) => setNextRevisionDate(e.target.value)}
              hint="Entretien périodique programmé"
            />
          </div>

          <Textarea
            label="Aménagements spécifiques & équipements embarqués"
            placeholder="Ex: Étagères métalliques, échelle de toit, convertisseur 220 V, extincteur…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </section>
      </form>
    </Modal>
  );
}
