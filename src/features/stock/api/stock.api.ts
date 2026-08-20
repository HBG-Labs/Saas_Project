import { supabase, unwrap } from '@/services/supabase';
import type { Database } from '@/types/database';

import type {
  ConsumableInput,
  StockConsumable,
  StockMovement,
  StockMovementInput,
} from '../types/stock.types';

/**
 * Le stock de consommables, lu et écrit en base.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE REMPLACE
 *
 * `stock.storage.ts` tenait le stock dans `localStorage`, semé au premier accès
 * avec sept articles inventés et trois mouvements nommant de vrais techniciens.
 * Ce qu'un magasinier saisissait ne quittait pas son navigateur : invisible
 * pour l'équipe, absent du téléphone du technicien, perdu au premier nettoyage
 * de cache, et hors de toute sauvegarde. Deux organisations partageaient même
 * les mêmes articles de démonstration.
 *
 * Le cloisonnement ne se fait PAS ici. Les policies de `stock_consumables` et
 * `stock_movements` exigent `stock.view` ou `stock.manage` sur l'organisation,
 * et la formule correspondante. Le filtre `.eq('organization_id', …)` sert la
 * lisibilité de la requête, jamais la sécurité — c'est la base qui refuse.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Aucun `try/catch` : `unwrap()` lève une `AppError` que TanStack Query
 * remonte à l'interface. Renvoyer un tableau vide sur erreur afficherait « stock
 * vide » à un magasinier dont le stock est plein.
 */

type ConsumableRow = Database['public']['Tables']['stock_consumables']['Row'];
type MovementRow = Database['public']['Tables']['stock_movements']['Row'];

const CHAMPS_CONSOMMABLE = `
  id, organization_id, reference, name, category, unit,
  quantity_in_stock, min_threshold, unit_price_eur, selling_price_eur,
  location, supplier, notes, created_at, updated_at
`;

const CHAMPS_MOUVEMENT = `
  id, organization_id, consumable_id, consumable_name, consumable_reference,
  type, quantity, reason, technician_id, technician_name, intervention_ref,
  location_from, location_to, occurred_at, created_at
`;

/**
 * `numeric` revient en `string` depuis PostgREST dès que la précision dépasse
 * celle d'un `double`. Le convertir ici évite que « 12.500 » se compare comme
 * une chaîne dans les tris et les seuils.
 */
function toNumber(value: number | string | null): number {
  if (value === null) return 0;
  return typeof value === 'number' ? value : Number(value);
}

function toOptionalNumber(value: number | string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** `null` en base, `undefined` côté interface : un champ absent n'est pas vide. */
function toOptionalText(value: string | null): string | undefined {
  return value ?? undefined;
}

function toConsumable(row: ConsumableRow): StockConsumable {
  return {
    id: row.id,
    organizationId: row.organization_id,
    reference: row.reference,
    name: row.name,
    category: row.category,
    unit: row.unit,
    quantityInStock: toNumber(row.quantity_in_stock),
    minThreshold: toNumber(row.min_threshold),
    unitPriceEur: toOptionalNumber(row.unit_price_eur),
    sellingPriceEur: toOptionalNumber(row.selling_price_eur),
    location: row.location,
    supplier: toOptionalText(row.supplier),
    notes: toOptionalText(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    organizationId: row.organization_id,
    // L'article a pu être supprimé depuis : la clé étrangère est
    // `on delete set null`, mais les instantanés de nom et de référence, eux,
    // restent lisibles.
    consumableId: row.consumable_id ?? '',
    consumableName: row.consumable_name,
    consumableReference: row.consumable_reference,
    type: row.type,
    quantity: toNumber(row.quantity),
    reason: row.reason,
    technicianId: toOptionalText(row.technician_id),
    technicianName: toOptionalText(row.technician_name),
    interventionRef: toOptionalText(row.intervention_ref),
    locationFrom: toOptionalText(row.location_from),
    locationTo: toOptionalText(row.location_to),
    date: row.occurred_at,
    createdAt: row.created_at,
  };
}

// -----------------------------------------------------------------------------
// Consommables
// -----------------------------------------------------------------------------

export async function listConsumables(organizationId: string): Promise<StockConsumable[]> {
  const rows = await unwrap(
    supabase
      .from('stock_consumables')
      .select(CHAMPS_CONSOMMABLE)
      .eq('organization_id', organizationId)
      .order('name', { ascending: true })
      .returns<ConsumableRow[]>(),
  );

  return rows.map(toConsumable);
}

export async function createConsumable(
  organizationId: string,
  input: ConsumableInput,
): Promise<StockConsumable> {
  const row = await unwrap(
    supabase
      .from('stock_consumables')
      .insert({
        organization_id: organizationId,
        reference: input.reference.trim(),
        name: input.name.trim(),
        category: input.category,
        unit: input.unit,
        quantity_in_stock: input.quantityInStock,
        min_threshold: input.minThreshold,
        unit_price_eur: input.unitPriceEur ?? null,
        selling_price_eur: input.sellingPriceEur ?? null,
        location: input.location,
        supplier: input.supplier ?? null,
        notes: input.notes ?? null,
      })
      // Sans `select`, PostgREST ne renvoie rien et `unwrap` conclurait à un
      // échec sur une insertion pourtant réussie.
      .select(CHAMPS_CONSOMMABLE)
      .single<ConsumableRow>(),
  );

  return toConsumable(row);
}

export async function updateConsumable(
  consumableId: string,
  patch: Partial<ConsumableInput>,
): Promise<StockConsumable> {
  const champs: Database['public']['Tables']['stock_consumables']['Update'] = {};

  if (patch.reference !== undefined) champs.reference = patch.reference.trim();
  if (patch.name !== undefined) champs.name = patch.name.trim();
  if (patch.category !== undefined) champs.category = patch.category;
  if (patch.unit !== undefined) champs.unit = patch.unit;
  if (patch.quantityInStock !== undefined) champs.quantity_in_stock = patch.quantityInStock;
  if (patch.minThreshold !== undefined) champs.min_threshold = patch.minThreshold;
  if (patch.unitPriceEur !== undefined) champs.unit_price_eur = patch.unitPriceEur ?? null;
  if (patch.sellingPriceEur !== undefined) champs.selling_price_eur = patch.sellingPriceEur ?? null;
  if (patch.location !== undefined) champs.location = patch.location;
  if (patch.supplier !== undefined) champs.supplier = patch.supplier ?? null;
  if (patch.notes !== undefined) champs.notes = patch.notes ?? null;

  if (Object.keys(champs).length === 0) {
    // PostgREST refuse un UPDATE sans colonne. Relire coûte moins qu'une erreur
    // à interpréter côté appelant.
    const row = await unwrap(
      supabase
        .from('stock_consumables')
        .select(CHAMPS_CONSOMMABLE)
        .eq('id', consumableId)
        .single<ConsumableRow>(),
    );
    return toConsumable(row);
  }

  const row = await unwrap(
    supabase
      .from('stock_consumables')
      .update(champs)
      .eq('id', consumableId)
      .select(CHAMPS_CONSOMMABLE)
      .single<ConsumableRow>(),
  );

  return toConsumable(row);
}

export async function deleteConsumable(consumableId: string): Promise<void> {
  await unwrap(
    supabase
      .from('stock_consumables')
      .delete()
      .eq('id', consumableId)
      .select('id')
      .single<{ id: string }>(),
  );
}

// -----------------------------------------------------------------------------
// Mouvements
// -----------------------------------------------------------------------------

export async function listMovements(organizationId: string): Promise<StockMovement[]> {
  const rows = await unwrap(
    supabase
      .from('stock_movements')
      .select(CHAMPS_MOUVEMENT)
      .eq('organization_id', organizationId)
      .order('occurred_at', { ascending: false })
      .returns<MovementRow[]>(),
  );

  return rows.map(toMovement);
}

/**
 * Enregistre un mouvement ET met à jour la quantité, indissociablement.
 *
 * Le calcul de la nouvelle quantité appartient à la base, pas au navigateur :
 * fait ici, deux techniciens servant le même article au même instant liraient
 * la même quantité de départ et l'un des deux mouvements serait perdu. La
 * fonction verrouille la ligne d'article le temps de la transaction.
 */
export async function recordMovement(input: StockMovementInput): Promise<StockMovement> {
  const row = await unwrap(
    supabase
      .rpc('record_stock_movement', {
        p_consumable_id: input.consumableId,
        p_type: input.type,
        p_quantity: input.quantity,
        p_reason: input.reason,
        p_technician_id: input.technicianId ?? null,
        p_technician_name: input.technicianName ?? null,
        p_intervention_ref: input.interventionRef ?? null,
        p_location_from: input.locationFrom ?? null,
        p_location_to: input.locationTo ?? null,
      })
      .single<MovementRow>(),
  );

  return toMovement(row);
}
