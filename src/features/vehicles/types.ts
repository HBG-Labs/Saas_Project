export type VehicleType = 'van' | 'truck' | 'car' | 'aerial_lift' | 'utility';
export type VehicleFuel = 'diesel' | 'essence' | 'electric' | 'hybrid';
export type VehicleStatus = 'in_service' | 'available' | 'maintenance' | 'out_of_service';

export interface VehicleMaintenanceRecord {
  id: string;
  date: string;
  type: 'revision' | 'controle_technique' | 'pneus' | 'freins' | 'vidange' | 'reparation' | 'autre';
  description: string;
  mileage: number;
  costEur?: number | undefined;
  performedBy?: string | undefined;
}

export interface Vehicle {
  id: string;
  organizationId: string;
  plate: string; // Ex: AB-123-CD
  brand: string; // Ex: Renault, Peugeot, Citroën, Mercedes, Ford, Iveco
  model: string; // Ex: Trafic L2H1, Master III, Kangoo E-Tech, Sprinter, Nacelle 14m
  type: VehicleType;
  fuel: VehicleFuel;
  status: VehicleStatus;
  mileage: number; // en km
  assignedMemberId: string | null; // ID du membre/technicien assigné
  assignedMemberName?: string | null | undefined;
  nextCtDate: string; // Contrôle technique (YYYY-MM-DD)
  nextRevisionDate: string; // Date révision périodique (YYYY-MM-DD)
  nextRevisionMileage?: number | undefined;
  insuranceExpiryDate?: string | undefined;
  notes?: string | undefined;
  maintenanceHistory?: VehicleMaintenanceRecord[] | undefined;
  createdAt: string;
  updatedAt: string;
}
