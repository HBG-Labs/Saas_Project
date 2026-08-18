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
    <Card className="hover:border-border-strong hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      <CardContent className="p-3.5 pt-3.5 sm:pt-3.5 space-y-2.5 flex-1">
        {/* Top bar : Plaque immatriculation & Statut */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            {/* French-style plate badge */}
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-hover border border-border font-mono font-bold text-xs tracking-wider text-foreground shadow-2xs">
              <span className="text-3xs font-extrabold text-blue-500">F</span>
              <span>{vehicle.plate}</span>
            </div>
            <h3 className="text-xs font-bold text-foreground truncate mt-0.5">
              {vehicle.brand} <span className="font-semibold text-foreground/85">{vehicle.model}</span>
            </h3>
          </div>

          <Badge variant={statusCfg.variant} className="shrink-0 text-3xs px-2 py-0.5">
            {statusCfg.label}
          </Badge>
        </div>

        {/* Détails type & motorisation */}
        <div className="flex flex-wrap items-center gap-1.5 text-3xs text-muted-foreground">
          <span className="flex items-center gap-1 bg-surface-hover px-1.5 py-0.5 rounded-md">
            <Truck className="size-2.5 text-primary" />
            <span>{TYPE_LABELS[vehicle.type] ?? vehicle.type}</span>
          </span>
          <span className="flex items-center gap-1 bg-surface-hover px-1.5 py-0.5 rounded-md">
            {fuelCfg.isElectric ? (
              <Zap className="size-2.5 text-emerald-500" />
            ) : (
              <Fuel className="size-2.5 text-amber-500" />
            )}
            <span>{fuelCfg.label}</span>
          </span>
        </div>

        {/* Assignation & Compteur */}
        <div className="grid grid-cols-2 gap-2 p-2 bg-surface-hover/50 rounded-lg border border-border/50 text-xs">
          <div className="space-y-0.5 min-w-0">
            <span className="text-3xs text-muted-foreground flex items-center gap-1">
              <User className="size-2.5 shrink-0" />
              <span className="truncate">Conducteur assigné</span>
            </span>
            <p className="font-semibold text-foreground truncate text-2xs">
              {vehicle.assignedMemberName ? vehicle.assignedMemberName : 'Pool partagé'}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-3xs text-muted-foreground flex items-center gap-1">
              <Gauge className="size-2.5 shrink-0" />
              <span>Kilométrage</span>
            </span>
            <p className="font-mono font-bold text-foreground text-2xs">
              {vehicle.mileage.toLocaleString('fr-FR')} km
            </p>
          </div>
        </div>

        {/* Rappels d'entretien & Contrôle Technique */}
        <div className="space-y-1 text-3xs bg-surface/80 p-2 rounded-lg border border-border/40">
          {/* CT */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="size-3 text-primary/80" />
              <span>Contrôle Technique :</span>
            </span>
            <span
              className={cn(
                'font-mono font-medium',
                isCtUrgent && 'text-error font-bold flex items-center gap-0.5',
                isCtWarning && 'text-warning font-semibold flex items-center gap-0.5',
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
              <Wrench className="size-3 text-primary/80" />
              <span>Prochaine révision :</span>
            </span>
            <span
              className={cn(
                'font-mono font-medium',
                isRevisionUrgent && 'text-error font-bold flex items-center gap-0.5',
                isRevisionWarning && 'text-warning font-semibold flex items-center gap-0.5',
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
          <p className="text-3xs text-subtle-foreground bg-surface-hover/40 px-2 py-1.5 rounded-md line-clamp-1 border border-border/30">
            {vehicle.notes}
          </p>
        )}
      </CardContent>

      {/* Card actions footer */}
      <div className="px-3.5 py-2 border-t border-border bg-surface-hover/20 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-2xs gap-1.5 h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => onViewHistory(vehicle)}
        >
          <Wrench className="size-3" />
          <span>Carnet ({vehicle.maintenanceHistory?.length ?? 0})</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-2xs gap-1 h-7 px-2.5"
          onClick={() => onEdit(vehicle)}
        >
          <Edit2 className="size-2.5" />
          <span>Gérer</span>
        </Button>
      </div>
    </Card>
  );
}
