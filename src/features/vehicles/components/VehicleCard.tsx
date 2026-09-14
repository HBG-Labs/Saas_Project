import {
  AlertTriangle,
  Edit2,
  Fuel,
  Gauge,
  ShieldCheck,
  Truck,
  User,
  Wrench,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import type { Vehicle, VehicleFuel, VehicleStatus, VehicleType } from '../types';

interface VehicleCardProps {
  vehicle: Vehicle;
  onEdit: (vehicle: Vehicle) => void;
  onViewHistory: (vehicle: Vehicle) => void;
}

const TYPE_LABELS: Record<VehicleType, string> = {
  van: 'Fourgon / Atelier L2/L3',
  utility: 'Fourgonnette',
  car: 'Véhicule Léger (VL)',
  aerial_lift: 'Camion Nacelle',
  truck: 'Poids Lourd / Benne',
};

const STATUS_CONFIG: Record<
  VehicleStatus,
  { label: string; variant: 'success' | 'info' | 'warning' | 'error' }
> = {
  in_service: { label: 'Sur le terrain', variant: 'success' },
  available: { label: 'Disponible au dépôt', variant: 'info' },
  maintenance: { label: 'En révision / Garage', variant: 'warning' },
  out_of_service: { label: 'Hors service', variant: 'error' },
};

const FUEL_LABELS: Record<VehicleFuel, { label: string; isElectric: boolean }> = {
  diesel: { label: 'Diesel', isElectric: false },
  essence: { label: 'Essence', isElectric: false },
  electric: { label: '100% Électrique', isElectric: true },
  hybrid: { label: 'Hybride', isElectric: true },
};

function getDaysUntil(dateString: string): number {
  const target = new Date(dateString).getTime();
  const now = new Date().getTime();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function VehicleCard({ vehicle, onEdit, onViewHistory }: VehicleCardProps) {
  const statusCfg = STATUS_CONFIG[vehicle.status] ?? {
    label: vehicle.status,
    variant: 'info' as const,
  };
  const fuelCfg = FUEL_LABELS[vehicle.fuel] ?? { label: vehicle.fuel, isElectric: false };

  const daysUntilCt = getDaysUntil(vehicle.nextCtDate);
  const isCtUrgent = daysUntilCt <= 30;
  const isCtWarning = daysUntilCt > 30 && daysUntilCt <= 60;

  const daysUntilRevision = getDaysUntil(vehicle.nextRevisionDate);
  const isRevisionUrgent = daysUntilRevision <= 15;
  const isRevisionWarning = daysUntilRevision > 15 && daysUntilRevision <= 45;

  return (
    <Card className="hover:border-primary/30 hover:shadow-raised group border-border/80 flex flex-col overflow-hidden shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
      <CardContent className="flex-1 space-y-2.5 p-3.5 pt-3.5 sm:pt-3.5">
        {/* Top bar : Plaque immatriculation & Statut */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            {/* French-style plate badge */}
            <div className="bg-surface-hover border-border text-foreground inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider shadow-2xs">
              <span className="text-3xs text-primary font-extrabold">F</span>
              <span>{vehicle.plate}</span>
            </div>
            <h3 className="text-foreground mt-0.5 truncate text-xs font-bold">
              {vehicle.brand}{' '}
              <span className="text-foreground/85 font-semibold">{vehicle.model}</span>
            </h3>
          </div>

          <Badge variant={statusCfg.variant} className="text-3xs shrink-0 px-2 py-0.5">
            {statusCfg.label}
          </Badge>
        </div>

        {/* Détails type & motorisation */}
        <div className="text-3xs text-muted-foreground flex flex-wrap items-center gap-1.5">
          <span className="bg-surface-hover flex items-center gap-1 rounded-md px-1.5 py-0.5">
            <Truck className="text-primary size-2.5" />
            <span>{TYPE_LABELS[vehicle.type] ?? vehicle.type}</span>
          </span>
          <span className="bg-surface-hover flex items-center gap-1 rounded-md px-1.5 py-0.5">
            {fuelCfg.isElectric ? (
              <Zap className="text-success size-2.5" />
            ) : (
              <Fuel className="text-warning size-2.5" />
            )}
            <span>{fuelCfg.label}</span>
          </span>
        </div>

        {/* Assignation & Compteur */}
        <div className="bg-surface-hover/50 border-border/50 grid grid-cols-2 gap-2 rounded-lg border p-2 text-xs">
          <div className="min-w-0 space-y-0.5">
            <span className="text-3xs text-muted-foreground flex items-center gap-1">
              <User className="size-2.5 shrink-0" />
              <span className="truncate">Conducteur assigné</span>
            </span>
            <p className="text-foreground text-2xs truncate font-semibold">
              {vehicle.assignedMemberName ? vehicle.assignedMemberName : 'Pool partagé'}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-3xs text-muted-foreground flex items-center gap-1">
              <Gauge className="size-2.5 shrink-0" />
              <span>Kilométrage</span>
            </span>
            <p className="text-foreground text-2xs font-mono font-bold">
              {vehicle.mileage.toLocaleString('fr-FR')} km
            </p>
          </div>
        </div>

        {/* Rappels d'entretien & Contrôle Technique */}
        <div className="text-3xs bg-surface/80 border-border/40 space-y-1 rounded-lg border p-2">
          {/* CT */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="text-primary/80 size-3" />
              <span>Contrôle Technique :</span>
            </span>
            <span
              className={cn(
                'font-mono font-medium',
                isCtUrgent && 'text-error flex items-center gap-0.5 font-bold',
                isCtWarning && 'text-warning flex items-center gap-0.5 font-semibold',
                !isCtUrgent && !isCtWarning && 'text-foreground',
              )}
            >
              {(isCtUrgent || isCtWarning) && <AlertTriangle className="size-2.5" />}
              {new Date(vehicle.nextCtDate).toLocaleDateString('fr-FR')}
              {isCtUrgent && ` (${daysUntilCt}j)`}
            </span>
          </div>

          {/* Révision */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground flex items-center gap-1">
              <Wrench className="text-primary/80 size-3" />
              <span>Prochaine révision :</span>
            </span>
            <span
              className={cn(
                'font-mono font-medium',
                isRevisionUrgent && 'text-error flex items-center gap-0.5 font-bold',
                isRevisionWarning && 'text-warning flex items-center gap-0.5 font-semibold',
                !isRevisionUrgent && !isRevisionWarning && 'text-foreground',
              )}
            >
              {(isRevisionUrgent || isRevisionWarning) && <AlertTriangle className="size-2.5" />}
              {new Date(vehicle.nextRevisionDate).toLocaleDateString('fr-FR')}
              {isRevisionUrgent && ` (${daysUntilRevision}j)`}
            </span>
          </div>
        </div>

        {vehicle.notes && (
          <p className="text-3xs text-subtle-foreground bg-surface-hover/40 border-border/30 line-clamp-1 rounded-md border px-2 py-1.5">
            {vehicle.notes}
          </p>
        )}
      </CardContent>

      {/* Card actions footer */}
      <div className="border-border bg-surface-sunken/35 flex items-center justify-between gap-2 border-t px-3.5 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-touch text-2xs text-muted-foreground hover:text-foreground gap-1.5 px-2 sm:h-8 sm:min-h-0"
          onClick={() => onViewHistory(vehicle)}
        >
          <Wrench className="size-3" />
          <span>Carnet ({vehicle.maintenanceHistory?.length ?? 0})</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-touch text-2xs gap-1 px-3 sm:h-8 sm:min-h-0"
          onClick={() => onEdit(vehicle)}
        >
          <Edit2 className="size-2.5" />
          <span>Gérer</span>
        </Button>
      </div>
    </Card>
  );
}
