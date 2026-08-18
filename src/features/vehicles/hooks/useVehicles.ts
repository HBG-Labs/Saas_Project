import { useState, useCallback } from 'react';
import type { Vehicle, VehicleMaintenanceRecord } from '../types';

const STORAGE_PREFIX = 'nexora_fleet_vehicles_';

function getInitialVehicles(orgId: string): Vehicle[] {
  return [
    {
      id: `veh-${orgId}-001`,
      organizationId: orgId,
      plate: 'GK-482-TZ',
      brand: 'Renault',
      model: 'Trafic L2H1 Grand Confort',
      type: 'van',
      fuel: 'diesel',
      status: 'in_service',
      mileage: 64200,
      assignedMemberId: null,
      assignedMemberName: 'Harry Bergoz',
      nextCtDate: '2027-04-15',
      nextRevisionDate: '2026-11-20',
      nextRevisionMileage: 75000,
      notes: 'Équipé atelier mobile, échelle de toit et convertisseur 230V.',
      maintenanceHistory: [
        {
          id: 'maint-01',
          date: '2026-02-10',
          type: 'vidange',
          description: 'Vidange moteur + remplacement filtre à huile et filtre habitacle',
          mileage: 55000,
          costEur: 240,
          performedBy: 'Garage Renault Pro',
        },
      ],
      createdAt: '2026-01-10T08:00:00.000Z',
      updatedAt: '2026-08-10T14:30:00.000Z',
    },
    {
      id: `veh-${orgId}-002`,
      organizationId: orgId,
      plate: 'FX-891-AA',
      brand: 'Peugeot',
      model: 'Partner Pro L1 Standard',
      type: 'utility',
      fuel: 'electric',
      status: 'available',
      mileage: 28400,
      assignedMemberId: null,
      assignedMemberName: null,
      nextCtDate: '2027-09-01',
      nextRevisionDate: '2027-03-15',
      nextRevisionMileage: 40000,
      notes: '100% Électrique — badge de recharge TotalEnergies & Ionity inclus dans la boîte à gants.',
      maintenanceHistory: [
        {
          id: 'maint-02',
          date: '2026-04-12',
          type: 'revision',
          description: 'Contrôle périodique chaîne de traction électrique & plaquettes de frein',
          mileage: 25000,
          costEur: 180,
          performedBy: 'Concession Peugeot Électrique',
        },
      ],
      createdAt: '2026-01-15T09:00:00.000Z',
      updatedAt: '2026-08-12T10:15:00.000Z',
    },
    {
      id: `veh-${orgId}-003`,
      organizationId: orgId,
      plate: 'EM-314-QP',
      brand: 'Nissan / CTE',
      model: 'Nacelle Articulée ZED 15.2 (VL 3.5T)',
      type: 'aerial_lift',
      fuel: 'diesel',
      status: 'in_service',
      mileage: 41800,
      assignedMemberId: null,
      assignedMemberName: 'Équipe Câblage Haut',
      nextCtDate: '2026-10-18',
      nextRevisionDate: '2026-09-30',
      nextRevisionMileage: 45000,
      notes: 'Hauteur de travail 15m. VGP (Vérification Générale Périodique) semestrielle à jour.',
      maintenanceHistory: [
        {
          id: 'maint-03',
          date: '2026-03-22',
          type: 'controle_technique',
          description: 'VGP nacelle semestrielle + contrôle sécurité hydraulique',
          mileage: 38000,
          costEur: 380,
          performedBy: 'Bureau Veritas / Dekra Pro',
        },
      ],
      createdAt: '2026-02-01T08:00:00.000Z',
      updatedAt: '2026-08-15T11:20:00.000Z',
    },
    {
      id: `veh-${orgId}-004`,
      organizationId: orgId,
      plate: 'HP-902-LK',
      brand: 'Citroën',
      model: 'Berlingo Van M BlueHDi',
      type: 'van',
      fuel: 'diesel',
      status: 'maintenance',
      mileage: 112000,
      assignedMemberId: null,
      assignedMemberName: null,
      nextCtDate: '2026-12-05',
      nextRevisionDate: '2026-08-20',
      nextRevisionMileage: 115000,
      notes: 'Au garage pour remplacement kit courroie de distribution et pneumatiques avant.',
      maintenanceHistory: [
        {
          id: 'maint-04',
          date: '2026-08-16',
          type: 'reparation',
          description: 'Devis remplacement distribution + 2 pneus Michelin Agilis',
          mileage: 112000,
          costEur: 750,
          performedBy: 'Garage Central Point S',
        },
      ],
      createdAt: '2026-03-01T08:00:00.000Z',
      updatedAt: '2026-08-16T16:00:00.000Z',
    },
  ];
}

/** Flotte enregistrée pour une organisation, semée au premier accès. */
function readStoredVehicles(organizationId: string): Vehicle[] {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${organizationId}`);
    if (stored) return JSON.parse(stored) as Vehicle[];

    const initial = getInitialVehicles(organizationId);
    localStorage.setItem(`${STORAGE_PREFIX}${organizationId}`, JSON.stringify(initial));
    return initial;
  } catch {
    return getInitialVehicles(organizationId);
  }
}

export function useVehicles(organizationId: string | null) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() =>
    organizationId ? readStoredVehicles(organizationId) : [],
  );

  // Relecture du stockage quand l'organisation change — ajustée au RENDU.
  //
  // L'effet posait `setVehicles` de façon synchrone : le composant affichait un
  // instant la flotte de l'organisation précédente avant de la remplacer. Le
  // motif « ajuster l'état quand une prop change » évite ce rendu intermédiaire.
  const [loadedFor, setLoadedFor] = useState<string | null>(organizationId);
  if (organizationId !== loadedFor) {
    setLoadedFor(organizationId);
    setVehicles(organizationId ? readStoredVehicles(organizationId) : []);
  }

  const saveVehicles = useCallback(
    (newVehicles: Vehicle[]) => {
      setVehicles(newVehicles);
      if (organizationId) {
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${organizationId}`, JSON.stringify(newVehicles));
        } catch {
          // Ignore write errors
        }
      }
    },
    [organizationId],
  );

  const addVehicle = useCallback(
    (newVehicle: Omit<Vehicle, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => {
      if (!organizationId) return;
      const vehicle: Vehicle = {
        ...newVehicle,
        id: `veh-${organizationId}-${Date.now()}`,
        organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveVehicles([vehicle, ...vehicles]);
      return vehicle;
    },
    [organizationId, vehicles, saveVehicles],
  );

  const updateVehicle = useCallback(
    (vehicleId: string, updates: Partial<Vehicle>) => {
      const updated = vehicles.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : v,
      );
      saveVehicles(updated);
    },
    [vehicles, saveVehicles],
  );

  const deleteVehicle = useCallback(
    (vehicleId: string) => {
      const filtered = vehicles.filter((v) => v.id !== vehicleId);
      saveVehicles(filtered);
    },
    [vehicles, saveVehicles],
  );

  const addMaintenanceRecord = useCallback(
    (vehicleId: string, record: Omit<VehicleMaintenanceRecord, 'id'>) => {
      const updated = vehicles.map((v) => {
        if (v.id !== vehicleId) return v;
        const newRecord: VehicleMaintenanceRecord = {
          ...record,
          id: `maint-${Date.now()}`,
        };
        return {
          ...v,
          mileage: Math.max(v.mileage, record.mileage),
          maintenanceHistory: [newRecord, ...(v.maintenanceHistory ?? [])],
          updatedAt: new Date().toISOString(),
        };
      });
      saveVehicles(updated);
    },
    [vehicles, saveVehicles],
  );

  return {
    vehicles,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    addMaintenanceRecord,
  };
}
