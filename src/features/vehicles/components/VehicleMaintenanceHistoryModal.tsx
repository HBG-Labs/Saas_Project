import { Gauge, Plus, Wrench } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import type { Vehicle, VehicleMaintenanceRecord } from '../types';

interface VehicleMaintenanceHistoryModalProps {
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
  onAddRecord: (vehicleId: string, record: Omit<VehicleMaintenanceRecord, 'id'>) => void;
}

const TYPE_LABELS: Record<string, string> = {
  revision: 'Révision Périodique',
  controle_technique: 'Contrôle Technique / VGP',
  vidange: 'Vidange & Filtres',
  pneus: 'Pneumatiques',
  freins: 'Freinage & Sécurité',
  reparation: 'Réparation / Mécanique',
  autre: 'Autre intervention',
};

export function VehicleMaintenanceHistoryModal({
  vehicle,
  isOpen,
  onClose,
  onAddRecord,
}: VehicleMaintenanceHistoryModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<VehicleMaintenanceRecord['type']>('revision');
  const [description, setDescription] = useState('');
  const [mileage, setMileage] = useState(vehicle.mileage);
  const [costEur, setCostEur] = useState<number>(150);
  const [performedBy, setPerformedBy] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    onAddRecord(vehicle.id, {
      date,
      type,
      description: description.trim(),
      mileage: Number(mileage) || vehicle.mileage,
      costEur: Number(costEur) || undefined,
      performedBy: performedBy.trim() || undefined,
    });

    setDescription('');
    setShowAddForm(false);
  };

  const history = vehicle.maintenanceHistory ?? [];

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Carnet d’entretien & révisions"
      description={`${vehicle.plate} · ${vehicle.brand} ${vehicle.model}`}
      size="lg"
      footer={
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="min-h-touch w-full sm:min-h-0 sm:w-auto"
        >
          Fermer
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Quick info bar */}
        <div className="border-border bg-surface-sunken/45 flex flex-col justify-between gap-3 rounded-xl border p-3 text-xs sm:flex-row sm:items-center">
          <div className="flex items-center gap-1.5">
            <Gauge className="text-muted-foreground size-4" aria-hidden="true" />
            <span className="text-muted-foreground">Kilométrage actuel :</span>
            <strong className="text-foreground font-mono">
              {vehicle.mileage.toLocaleString('fr-FR')} km
            </strong>
          </div>
          {!showAddForm && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-touch w-full gap-1.5 text-xs sm:h-8 sm:min-h-0 sm:w-auto"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Ajouter un entretien</span>
            </Button>
          )}
        </div>

        {/* Add form */}
        {showAddForm && (
          <form
            onSubmit={handleAddSubmit}
            className="border-primary/30 bg-primary/5 animate-in fade-in space-y-3.5 rounded-2xl border p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-foreground text-xs font-bold">Nouvelle opération d'entretien</h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-muted-foreground hover:bg-surface-hover hover:text-foreground min-h-touch rounded-lg px-3 text-xs sm:min-h-0 sm:py-1"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Date de l'opération"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />

              <Select
                label="Type d'intervention"
                value={type}
                onValueChange={(val) => setType(val as VehicleMaintenanceRecord['type'])}
                options={Object.entries(TYPE_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Kilométrage relevé"
                type="number"
                value={mileage}
                onChange={(e) => setMileage(Number(e.target.value))}
                required
              />

              <Input
                label="Coût TTC (€)"
                type="number"
                value={costEur}
                onChange={(e) => setCostEur(Number(e.target.value))}
              />
            </div>

            <Input
              label="Garage / Prestataire"
              placeholder="Ex: Concession Renault Pro, Point S, Interne..."
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
            />

            <Textarea
              label="Description détaillée des travaux"
              placeholder="Ex: Changement du filtre à huile, purge du liquide de frein, deux pneus avant…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
            />

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(false)}
                className="min-h-touch sm:min-h-0"
              >
                Annuler
              </Button>
              <Button type="submit" variant="primary" size="sm" className="min-h-touch sm:min-h-0">
                Enregistrer l'opération
              </Button>
            </div>
          </form>
        )}

        {/* List of past maintenance */}
        <div className="space-y-2.5">
          <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
            Historique des interventions ({history.length})
          </h3>

          {history.length === 0 ? (
            <div className="border-border text-muted-foreground rounded-2xl border border-dashed px-4 py-10 text-center text-xs">
              <div className="bg-surface-sunken mx-auto flex size-10 items-center justify-center rounded-xl">
                <Wrench className="size-4.5" aria-hidden="true" />
              </div>
              <p className="text-foreground mt-3 font-semibold">Aucun entretien enregistré</p>
              <p className="text-muted-foreground mt-1">Le premier apparaîtra ici.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="border-border bg-surface hover:border-primary/25 space-y-2 rounded-xl border p-3.5 transition-[border-color,box-shadow] hover:shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-2xs font-semibold">
                        {TYPE_LABELS[record.type] ?? record.type}
                      </Badge>
                      <span className="text-2xs text-muted-foreground font-mono">
                        {new Date(record.date).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-muted-foreground">
                        {record.mileage.toLocaleString('fr-FR')} km
                      </span>
                      {record.costEur !== undefined && (
                        <span className="text-foreground font-bold">{record.costEur} €</span>
                      )}
                    </div>
                  </div>

                  <p className="text-foreground text-xs">{record.description}</p>

                  {record.performedBy && (
                    <p className="text-3xs text-muted-foreground flex items-center gap-1">
                      <span>Réalisé par :</span>
                      <strong className="text-foreground/80">{record.performedBy}</strong>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
