import { X, Wrench, Plus, Gauge } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-surface border-border w-full max-w-xl rounded-2xl border shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Wrench className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Carnet d'entretien & Révisions</h2>
              <p className="text-2xs text-muted-foreground">{vehicle.plate} • {vehicle.brand} {vehicle.model}</p>
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

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Quick info bar */}
          <div className="flex items-center justify-between p-3 bg-surface-hover/50 rounded-xl border border-border/60 text-xs">
            <div className="flex items-center gap-1.5">
              <Gauge className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Kilométrage actuel :</span>
              <strong className="text-foreground font-mono">{vehicle.mileage.toLocaleString('fr-FR')} km</strong>
            </div>
            {!showAddForm && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7.5"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="size-3.5" />
                <span>Ajouter un entretien</span>
              </Button>
            )}
          </div>

          {/* Add form */}
          {showAddForm && (
            <form onSubmit={handleAddSubmit} className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground">Nouvelle opération d'entretien</h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-2xs text-muted-foreground hover:text-foreground"
                >
                  Fermer
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div>
                <span className="block text-xs font-medium text-foreground mb-1">
                  Description détaillée des travaux
                </span>
                <textarea
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[50px]"
                  placeholder="Ex: Changement filtre à huile, purge liquide de frein, 2 pneus avant neufs..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Enregistrer l'opération
                </Button>
              </div>
            </form>
          )}

          {/* List of past maintenance */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Historique des interventions ({history.length})
            </h3>

            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                Aucun entretien enregistré pour le moment.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="p-3.5 rounded-xl border border-border bg-surface hover:bg-surface-hover/50 transition-colors space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-semibold text-2xs">
                          {TYPE_LABELS[record.type] ?? record.type}
                        </Badge>
                        <span className="text-2xs text-muted-foreground font-mono">
                          {new Date(record.date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-muted-foreground">{record.mileage.toLocaleString('fr-FR')} km</span>
                        {record.costEur !== undefined && (
                          <span className="font-bold text-foreground">{record.costEur} €</span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-foreground">{record.description}</p>

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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface-hover/20 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
