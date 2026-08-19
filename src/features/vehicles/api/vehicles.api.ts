import { supabase, unwrap } from '@/services/supabase';
import type { Database } from '@/types/database';

import type { Vehicle, VehicleMaintenanceRecord } from '../types';

/**
 * Le parc roulant, lu et écrit en base.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE REMPLACE
 *
 * Les véhicules vivaient dans `localStorage`, semés au premier accès avec une
 * flotte inventée. Ce qu'un dirigeant saisissait ne quittait pas son navigateur :
 * invisible pour ses collègues, absent de son téléphone, perdu au premier
 * nettoyage de cache, et hors de toute sauvegarde.
 *
 * Le cloisonnement ne se fait PAS ici. Les policies de `vehicles` exigent
 * `equipment.view` ou `equipment.manage` sur l'organisation, et la formule
 * correspondante. Un filtre `.eq('organization_id', …)` sert la lisibilité de la
 * requête, jamais la sécurité — c'est la base qui refuse.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Ce que la base renvoie, avant remise en forme. */
interface VehicleRow {
  id: string;
  organization_id: string;
  plate: string;
  brand: string;
  model: string;
  type: Vehicle['type'];
  fuel: Vehicle['fuel'];
  status: Vehicle['status'];
  mileage: number;
  assigned_member_id: string | null;
  next_ct_date: string | null;
  next_revision_date: string | null;
  next_revision_mileage: number | null;
  insurance_expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle_maintenance_records?: MaintenanceRow[] | null;
}

interface MaintenanceRow {
  id: string;
  performed_on: string;
  type: VehicleMaintenanceRecord['type'];
  description: string;
  mileage: number;
  cost_cents: number | null;
  performed_by: string | null;
}

/**
 * Les montants voyagent en CENTIMES et ne deviennent des euros qu'ici.
 *
 * Un prix en nombre flottant finit par afficher 149,99999 — le reste de ce
 * dépôt suit déjà cette règle pour la facturation.
 */
function toRecord(row: MaintenanceRow): VehicleMaintenanceRecord {
  return {
    id: row.id,
    date: row.performed_on,
    type: row.type,
    description: row.description,
    mileage: row.mileage,
    ...(row.cost_cents === null ? {} : { costEur: row.cost_cents / 100 }),
    ...(row.performed_by === null ? {} : { performedBy: row.performed_by }),
  };
}

function toVehicle(row: VehicleRow): Vehicle {
  const historique = (row.vehicle_maintenance_records ?? []).map(toRecord);

  return {
    id: row.id,
    organizationId: row.organization_id,
    plate: row.plate,
    brand: row.brand,
    model: row.model,
    type: row.type,
    fuel: row.fuel,
    status: row.status,
    mileage: row.mileage,
    assignedMemberId: row.assigned_member_id,
    nextCtDate: row.next_ct_date ?? '',
    nextRevisionDate: row.next_revision_date ?? '',
    ...(row.next_revision_mileage === null
      ? {}
      : { nextRevisionMileage: row.next_revision_mileage }),
    ...(row.insurance_expiry_date === null
      ? {}
      : { insuranceExpiryDate: row.insurance_expiry_date }),
    ...(row.notes === null ? {} : { notes: row.notes }),
    maintenanceHistory: historique,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CHAMPS = `
  id, organization_id, plate, brand, model, type, fuel, status, mileage,
  assigned_member_id, next_ct_date, next_revision_date, next_revision_mileage,
  insurance_expiry_date, notes, created_at, updated_at,
  vehicle_maintenance_records (
    id, performed_on, type, description, mileage, cost_cents, performed_by
  )
`;

export async function listVehicles(organizationId: string): Promise<Vehicle[]> {
  const rows = await unwrap(
    supabase
      .from('vehicles')
      .select(CHAMPS)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),
  );

  return (rows as unknown as VehicleRow[]).map(toVehicle);
}

/** Champs qu'un formulaire fournit — les autres sont posés par la base. */
export type VehicleInput = Omit<
  Vehicle,
  'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'maintenanceHistory' | 'assignedMemberName'
>;

/** `''` plutôt que `null` sur une date vide : c'est ce que rendent les formulaires. */
function dateOuNull(valeur: string | undefined): string | null {
  return valeur === undefined || valeur === '' ? null : valeur;
}

export async function createVehicle(
  organizationId: string,
  input: VehicleInput,
): Promise<Vehicle> {
  const rows = await unwrap(
    supabase
      .from('vehicles')
      .insert({
        organization_id: organizationId,
        plate: input.plate.trim().toUpperCase(),
        brand: input.brand.trim(),
        model: input.model.trim(),
        type: input.type,
        fuel: input.fuel,
        status: input.status,
        mileage: input.mileage,
        assigned_member_id: input.assignedMemberId,
        next_ct_date: dateOuNull(input.nextCtDate),
        next_revision_date: dateOuNull(input.nextRevisionDate),
        next_revision_mileage: input.nextRevisionMileage ?? null,
        insurance_expiry_date: dateOuNull(input.insuranceExpiryDate),
        notes: input.notes ?? null,
      })
      .select(CHAMPS),
  );

  return toVehicle((rows as unknown as VehicleRow[])[0]!);
}

export async function updateVehicle(
  vehicleId: string,
  updates: Partial<VehicleInput>,
): Promise<void> {
  // Typé d'après la base plutôt que `Record<string, unknown>` : PostgREST
  // refuse une colonne inconnue à l'exécution, et le compilateur doit la
  // refuser avant.
  const champs: Database['public']['Tables']['vehicles']['Update'] = {};

  if (updates.plate !== undefined) champs.plate = updates.plate.trim().toUpperCase();
  if (updates.brand !== undefined) champs.brand = updates.brand.trim();
  if (updates.model !== undefined) champs.model = updates.model.trim();
  if (updates.type !== undefined) champs.type = updates.type;
  if (updates.fuel !== undefined) champs.fuel = updates.fuel;
  if (updates.status !== undefined) champs.status = updates.status;
  if (updates.mileage !== undefined) champs.mileage = updates.mileage;
  if (updates.assignedMemberId !== undefined) {
    champs.assigned_member_id = updates.assignedMemberId;
  }
  if (updates.nextCtDate !== undefined) champs.next_ct_date = dateOuNull(updates.nextCtDate);
  if (updates.nextRevisionDate !== undefined) {
    champs.next_revision_date = dateOuNull(updates.nextRevisionDate);
  }
  if (updates.nextRevisionMileage !== undefined) {
    champs.next_revision_mileage = updates.nextRevisionMileage;
  }
  if (updates.insuranceExpiryDate !== undefined) {
    champs.insurance_expiry_date = dateOuNull(updates.insuranceExpiryDate);
  }
  if (updates.notes !== undefined) champs.notes = updates.notes;

  // Rien à écrire : on n'envoie pas un UPDATE vide, que PostgREST refuserait.
  if (Object.keys(champs).length === 0) return;

  await unwrap(supabase.from('vehicles').update(champs).eq('id', vehicleId).select('id'));
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  await unwrap(supabase.from('vehicles').delete().eq('id', vehicleId).select('id'));
}

/**
 * Ajoute un entretien, et relève le compteur si l'intervention l'a dépassé.
 *
 * Le kilométrage du véhicule ne recule jamais : un entretien saisi après coup,
 * avec un relevé plus ancien, ne doit pas rajeunir la fiche.
 */
export async function addMaintenanceRecord(
  vehicleId: string,
  record: Omit<VehicleMaintenanceRecord, 'id'>,
  mileageActuel: number,
): Promise<void> {
  await unwrap(
    supabase
      .from('vehicle_maintenance_records')
      .insert({
        vehicle_id: vehicleId,
        performed_on: record.date,
        type: record.type,
        description: record.description.trim(),
        mileage: record.mileage,
        cost_cents: record.costEur === undefined ? null : Math.round(record.costEur * 100),
        performed_by: record.performedBy ?? null,
      })
      .select('id'),
  );

  if (record.mileage > mileageActuel) {
    await unwrap(
      supabase
        .from('vehicles')
        .update({ mileage: record.mileage })
        .eq('id', vehicleId)
        .select('id'),
    );
  }
}
