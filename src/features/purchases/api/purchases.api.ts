import { supabase, unwrap } from '@/services/supabase';
import type { Database } from '@/types/database';

import type {
  PurchaseMetrics,
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderItem,
  PurchaseOrderItemInput,
  Supplier,
  SupplierInput,
} from '../types/purchases.types';

/**
 * Les achats, lus et écrits en base.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE REMPLACE
 *
 * `purchases.storage.ts` tenait fournisseurs et commandes dans `localStorage`,
 * semés au premier accès avec cinq sociétés RÉELLES — Rexel, Sonepar, Würth,
 * CEDEO, Foliatec — SIRET et numéros de TVA compris, plus deux bons de commande
 * de démonstration. Chaque organisation recevait les mêmes.
 *
 * Il importait surtout quatre fonctions de `stock.storage.ts` pour alimenter le
 * stock à la réception. Depuis que le Stock lit PostgreSQL, plus aucun écran ne
 * lisait ce stock local : pointer une livraison écrivait dans le vide.
 *
 * Le cloisonnement ne se fait PAS ici. Les policies exigent `purchase.view` ou
 * `purchase.manage` sur l'organisation, et la formule correspondante. Le filtre
 * `.eq('organization_id', …)` sert la lisibilité de la requête, jamais la
 * sécurité — c'est la base qui refuse.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Aucun `try/catch` : `unwrap()` lève une `AppError` que TanStack Query remonte
 * à l'interface.
 */

type SupplierRow = Database['public']['Tables']['suppliers']['Row'];
type OrderRow = Database['public']['Tables']['purchase_orders']['Row'];
type ItemRow = Database['public']['Tables']['purchase_order_items']['Row'];

type OrderRowWithItems = OrderRow & { purchase_order_items: ItemRow[] | null };

const CHAMPS_FOURNISSEUR = `
  id, organization_id, name, code, contact_name, email, phone, address, city,
  postal_code, siret, vat_number, website, default_payment_terms, notes,
  created_at, updated_at
`;

const CHAMPS_LIGNE = `
  id, purchase_order_id, consumable_id, reference, description, unit,
  quantity_ordered, quantity_received, unit_price_eur, position, created_at
`;

const CHAMPS_COMMANDE = `
  id, organization_id, reference, supplier_id, supplier_name, supplier_email,
  supplier_phone, supplier_address, status, order_date, expected_delivery_date,
  received_date, mission_id, mission_ref, tax_rate, notes, delivery_notes,
  created_at, updated_at,
  purchase_order_items ( ${CHAMPS_LIGNE} )
`;

/**
 * `numeric` revient en `string` depuis PostgREST dès que la précision dépasse
 * celle d'un `double`. Le convertir ici évite que « 12.500 » se compare comme
 * une chaîne dans les tris et les seuils.
 */
function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

/** `null` en base, `undefined` côté interface : un champ absent n'est pas vide. */
function toOptionalText(value: string | null): string | undefined {
  return value ?? undefined;
}

/**
 * Arrondi au centime.
 *
 * `Number.EPSILON` corrige les cas où la représentation binaire place la valeur
 * juste sous la limite d'arrondi — sans lui, `1.005` s'arrondit à `1.00`.
 */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// -----------------------------------------------------------------------------
// Fournisseurs
// -----------------------------------------------------------------------------

function toSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    code: toOptionalText(row.code),
    contactName: toOptionalText(row.contact_name),
    email: toOptionalText(row.email),
    phone: toOptionalText(row.phone),
    address: toOptionalText(row.address),
    city: toOptionalText(row.city),
    postalCode: toOptionalText(row.postal_code),
    siret: toOptionalText(row.siret),
    vatNumber: toOptionalText(row.vat_number),
    website: toOptionalText(row.website),
    defaultPaymentTerms: toOptionalText(row.default_payment_terms),
    notes: toOptionalText(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSuppliers(organizationId: string): Promise<Supplier[]> {
  const rows = await unwrap(
    supabase
      .from('suppliers')
      .select(CHAMPS_FOURNISSEUR)
      .eq('organization_id', organizationId)
      .order('name', { ascending: true })
      .returns<SupplierRow[]>(),
  );

  return rows.map(toSupplier);
}

export async function createSupplier(
  organizationId: string,
  input: SupplierInput,
): Promise<Supplier> {
  const row = await unwrap(
    supabase
      .from('suppliers')
      .insert({
        organization_id: organizationId,
        name: input.name.trim(),
        code: input.code ?? null,
        contact_name: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        postal_code: input.postalCode ?? null,
        siret: input.siret ?? null,
        vat_number: input.vatNumber ?? null,
        website: input.website ?? null,
        default_payment_terms: input.defaultPaymentTerms ?? null,
        notes: input.notes ?? null,
      })
      // Sans `select`, PostgREST ne renvoie rien et `unwrap` conclurait à un
      // échec sur une insertion pourtant réussie.
      .select(CHAMPS_FOURNISSEUR)
      .single<SupplierRow>(),
  );

  return toSupplier(row);
}

export async function updateSupplier(
  supplierId: string,
  patch: Partial<SupplierInput>,
): Promise<Supplier> {
  const champs: Database['public']['Tables']['suppliers']['Update'] = {};

  if (patch.name !== undefined) champs.name = patch.name.trim();
  if (patch.code !== undefined) champs.code = patch.code ?? null;
  if (patch.contactName !== undefined) champs.contact_name = patch.contactName ?? null;
  if (patch.email !== undefined) champs.email = patch.email ?? null;
  if (patch.phone !== undefined) champs.phone = patch.phone ?? null;
  if (patch.address !== undefined) champs.address = patch.address ?? null;
  if (patch.city !== undefined) champs.city = patch.city ?? null;
  if (patch.postalCode !== undefined) champs.postal_code = patch.postalCode ?? null;
  if (patch.siret !== undefined) champs.siret = patch.siret ?? null;
  if (patch.vatNumber !== undefined) champs.vat_number = patch.vatNumber ?? null;
  if (patch.website !== undefined) champs.website = patch.website ?? null;
  if (patch.defaultPaymentTerms !== undefined) {
    champs.default_payment_terms = patch.defaultPaymentTerms ?? null;
  }
  if (patch.notes !== undefined) champs.notes = patch.notes ?? null;

  if (Object.keys(champs).length === 0) {
    // PostgREST refuse un UPDATE sans colonne. Relire coûte moins qu'une erreur
    // à interpréter côté appelant.
    const row = await unwrap(
      supabase
        .from('suppliers')
        .select(CHAMPS_FOURNISSEUR)
        .eq('id', supplierId)
        .single<SupplierRow>(),
    );
    return toSupplier(row);
  }

  const row = await unwrap(
    supabase
      .from('suppliers')
      .update(champs)
      .eq('id', supplierId)
      .select(CHAMPS_FOURNISSEUR)
      .single<SupplierRow>(),
  );

  return toSupplier(row);
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  await unwrap(
    supabase
      .from('suppliers')
      .delete()
      .eq('id', supplierId)
      .select('id')
      .single<{ id: string }>(),
  );
}

// -----------------------------------------------------------------------------
// Commandes
// -----------------------------------------------------------------------------

function toItem(row: ItemRow): PurchaseOrderItem {
  const quantityOrdered = toNumber(row.quantity_ordered);
  const unitPriceEur = toNumber(row.unit_price_eur);

  return {
    id: row.id,
    consumableId: row.consumable_id ?? undefined,
    reference: row.reference,
    description: row.description,
    unit: row.unit,
    quantityOrdered,
    quantityReceived: toNumber(row.quantity_received),
    unitPriceEur,
    // Dérivé, jamais stocké — voir `toOrder`.
    totalEur: round2(quantityOrdered * unitPriceEur),
  };
}

/**
 * Les totaux se calculent, ils ne se stockent pas.
 *
 * L'ordre des arrondis est celui du module d'origine et doit le rester : chaque
 * ligne est arrondie au centime AVANT la somme, puis la somme est ré-arrondie,
 * et la TVA porte sur le sous-total HT — jamais ligne à ligne. Additionner les
 * lignes non arrondies donnerait un centime d'écart avec ce que le fournisseur
 * facture.
 *
 * Exporté pour rester vérifiable : le cas `3 × 33,33 + 10 × 10,01` doit donner
 * `200,09` HT · `40,02` de TVA · `240,11` TTC.
 */
export function computeOrderTotals(
  items: readonly Pick<PurchaseOrderItem, 'totalEur'>[],
  taxRate: number,
): { subtotalEur: number; taxEur: number; totalEur: number } {
  const subtotalEur = round2(items.reduce((sum, item) => sum + item.totalEur, 0));
  const taxEur = round2(subtotalEur * taxRate);

  return { subtotalEur, taxEur, totalEur: round2(subtotalEur + taxEur) };
}

function toOrder(row: OrderRowWithItems): PurchaseOrder {
  const items = [...(row.purchase_order_items ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(toItem);

  const taxRate = toNumber(row.tax_rate);
  const { subtotalEur, taxEur, totalEur } = computeOrderTotals(items, taxRate);

  return {
    id: row.id,
    organizationId: row.organization_id,
    reference: row.reference,
    supplierId: row.supplier_id ?? '',
    supplierName: row.supplier_name,
    supplierEmail: toOptionalText(row.supplier_email),
    supplierPhone: toOptionalText(row.supplier_phone),
    supplierAddress: toOptionalText(row.supplier_address),
    status: row.status,
    orderDate: row.order_date,
    expectedDeliveryDate: toOptionalText(row.expected_delivery_date),
    receivedDate: toOptionalText(row.received_date),
    missionId: toOptionalText(row.mission_id),
    missionRef: toOptionalText(row.mission_ref),
    items,
    subtotalEur,
    taxRate,
    taxEur,
    totalEur,
    notes: toOptionalText(row.notes),
    deliveryNotes: toOptionalText(row.delivery_notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPurchaseOrders(organizationId: string): Promise<PurchaseOrder[]> {
  const rows = await unwrap(
    supabase
      .from('purchase_orders')
      .select(CHAMPS_COMMANDE)
      .eq('organization_id', organizationId)
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<OrderRowWithItems[]>(),
  );

  return rows.map(toOrder);
}

async function getOrder(orderId: string): Promise<PurchaseOrder> {
  const row = await unwrap(
    supabase
      .from('purchase_orders')
      .select(CHAMPS_COMMANDE)
      .eq('id', orderId)
      .single<OrderRowWithItems>(),
  );

  return toOrder(row);
}

/**
 * Normalisation d'une ligne saisie.
 *
 * Une quantité nulle ou négative devient 1 : c'est le comportement d'origine, et
 * une ligne à zéro n'a pas de sens sur un bon de commande.
 */
function toItemInsert(item: PurchaseOrderItemInput, position: number) {
  const quantity = Number(item.quantityOrdered) || 0;

  return {
    consumable_id: item.consumableId ?? null,
    reference: item.reference.trim().toUpperCase(),
    description: item.description.trim(),
    unit: item.unit || 'pièce',
    quantity_ordered: quantity > 0 ? quantity : 1,
    quantity_received: Number(item.quantityReceived) || 0,
    unit_price_eur: Number(item.unitPriceEur) || 0,
    position,
  };
}

/** Adresse postale composée, telle qu'elle est figée sur la commande. */
function composeAddress(supplier: Supplier): string | null {
  if (!supplier.address) return null;
  return `${supplier.address}, ${supplier.postalCode ?? ''} ${supplier.city ?? ''}`.trim();
}

async function getSupplier(supplierId: string): Promise<Supplier> {
  const row = await unwrap(
    supabase
      .from('suppliers')
      .select(CHAMPS_FOURNISSEUR)
      .eq('id', supplierId)
      .single<SupplierRow>(),
  );

  return toSupplier(row);
}

export async function createPurchaseOrder(
  organizationId: string,
  input: PurchaseOrderInput,
): Promise<PurchaseOrder> {
  const supplier = await getSupplier(input.supplierId);

  const order = await unwrap(
    supabase
      .from('purchase_orders')
      .insert({
        organization_id: organizationId,
        // Laissée vide, la référence est générée par le serveur au format
        // `CMD-AAAA-NNN`. La fabriquer côté navigateur produisait des doublons.
        ...(input.reference?.trim() ? { reference: input.reference.trim() } : {}),
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        supplier_email: supplier.email ?? null,
        supplier_phone: supplier.phone ?? null,
        supplier_address: composeAddress(supplier),
        status: input.status ?? 'draft',
        order_date: input.orderDate,
        expected_delivery_date: input.expectedDeliveryDate ?? null,
        mission_id: input.missionId ?? null,
        mission_ref: input.missionRef ?? null,
        tax_rate: input.taxRate ?? 0.2,
        notes: input.notes ?? null,
      })
      .select('id')
      .single<{ id: string }>(),
  );

  if (input.items.length > 0) {
    await unwrap(
      supabase
        .from('purchase_order_items')
        .insert(input.items.map((item, index) => ({ purchase_order_id: order.id, ...toItemInsert(item, index) })))
        .select('id')
        .returns<{ id: string }[]>(),
    );
  }

  // Une commande créée déjà soldée fait entrer la marchandise immédiatement.
  if (input.status === 'received') {
    return receiveFully(order.id);
  }

  return getOrder(order.id);
}

export async function updatePurchaseOrder(
  orderId: string,
  patch: Partial<PurchaseOrderInput>,
): Promise<PurchaseOrder> {
  const actuelle = await getOrder(orderId);

  const champs: Database['public']['Tables']['purchase_orders']['Update'] = {};

  if (patch.reference !== undefined && patch.reference.trim() !== '') {
    champs.reference = patch.reference.trim();
  }
  if (patch.orderDate !== undefined) champs.order_date = patch.orderDate;
  if (patch.expectedDeliveryDate !== undefined) {
    champs.expected_delivery_date = patch.expectedDeliveryDate ?? null;
  }
  if (patch.missionId !== undefined) champs.mission_id = patch.missionId ?? null;
  if (patch.missionRef !== undefined) champs.mission_ref = patch.missionRef ?? null;
  if (patch.taxRate !== undefined) champs.tax_rate = patch.taxRate;
  if (patch.notes !== undefined) champs.notes = patch.notes ?? null;

  // Le statut `received` ne s'écrit pas directement : il découle de la réception.
  if (patch.status !== undefined && patch.status !== 'received') {
    champs.status = patch.status;
  }

  if (patch.supplierId !== undefined && patch.supplierId !== actuelle.supplierId) {
    const supplier = await getSupplier(patch.supplierId);
    champs.supplier_id = supplier.id;
    champs.supplier_name = supplier.name;
    champs.supplier_email = supplier.email ?? null;
    champs.supplier_phone = supplier.phone ?? null;
    // La version précédente n'testait pas l'adresse ici — un fournisseur sans
    // adresse produisait la chaîne « undefined, 75009 Paris », affichée telle
    // quelle sur le bon de commande imprimé.
    champs.supplier_address = composeAddress(supplier);
  }

  if (Object.keys(champs).length > 0) {
    await unwrap(
      supabase
        .from('purchase_orders')
        .update(champs)
        .eq('id', orderId)
        .select('id')
        .single<{ id: string }>(),
    );
  }

  // Les lignes sont remplacées en bloc : le formulaire renvoie toujours l'état
  // complet du tableau, et un rapprochement ligne à ligne coûterait plus qu'il
  // ne rapporte.
  if (patch.items !== undefined) {
    await unwrap(
      supabase
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', orderId)
        .select('id')
        .returns<{ id: string }[]>(),
    );

    if (patch.items.length > 0) {
      await unwrap(
        supabase
          .from('purchase_order_items')
          .insert(patch.items.map((item, index) => ({ purchase_order_id: orderId, ...toItemInsert(item, index) })))
          .select('id')
          .returns<{ id: string }[]>(),
      );
    }
  }

  if (patch.status === 'received' && actuelle.status !== 'received') {
    return receiveFully(orderId);
  }

  return getOrder(orderId);
}

export async function deletePurchaseOrder(orderId: string): Promise<void> {
  await unwrap(
    supabase
      .from('purchase_orders')
      .delete()
      .eq('id', orderId)
      .select('id')
      .single<{ id: string }>(),
  );
}

/**
 * Pointe une livraison.
 *
 * `receivedQuantities` associe un identifiant de LIGNE à la quantité reçue
 * MAINTENANT — un incrément, pas un cumul. Le plafonnement à ce qui reste dû,
 * l'entrée en stock et le recalcul du statut appartiennent à la base : les faire
 * ici en plusieurs requêtes rouvrirait la fenêtre pendant laquelle le bon de
 * commande et le stock divergent.
 */
export async function receivePurchaseOrder(
  orderId: string,
  receivedQuantities: Record<string, number>,
  deliveryNotes?: string,
): Promise<PurchaseOrder> {
  await unwrap(
    supabase
      .rpc('receive_purchase_order', {
        p_order_id: orderId,
        p_lines: receivedQuantities,
        p_delivery_notes: deliveryNotes ?? null,
      })
      .select('id')
      .single<{ id: string }>(),
  );

  return getOrder(orderId);
}

/** Solde toutes les lignes restantes — création ou passage direct à « reçue ». */
async function receiveFully(orderId: string): Promise<PurchaseOrder> {
  await unwrap(
    supabase
      .rpc('receive_purchase_order_fully', { p_order_id: orderId })
      .select('id')
      .single<{ id: string }>(),
  );

  return getOrder(orderId);
}

// -----------------------------------------------------------------------------
// Indicateurs
// -----------------------------------------------------------------------------

/**
 * Indicateurs de la page Achats.
 *
 * Définitions reprises telles quelles du module d'origine, y compris leurs
 * particularités : `totalOrders` compte TOUTES les commandes, annulées et
 * brouillons compris ; `totalSpendMonthEur` est une fenêtre GLISSANTE de 30
 * jours en HT, pas un mois calendaire ; `activeSuppliersCount` compte tous les
 * fournisseurs, sans notion d'activité.
 *
 * `maintenant` est passé en paramètre plutôt que lu ici : appeler `Date.now()`
 * pendant un rendu React est impur et fait varier l'indicateur d'un rendu à
 * l'autre sans que les données aient bougé.
 */
export function calculatePurchaseMetrics(
  orders: PurchaseOrder[],
  suppliers: Supplier[],
  maintenant: number,
): PurchaseMetrics {
  const depuis = maintenant - 30 * 24 * 3600 * 1000;

  return {
    totalOrders: orders.length,
    ordersDraft: orders.filter((o) => o.status === 'draft').length,
    ordersPendingDelivery: orders.filter(
      (o) => o.status === 'sent' || o.status === 'partially_received',
    ).length,
    ordersCompleted: orders.filter((o) => o.status === 'received').length,
    totalSpendMonthEur: orders
      .filter((o) => o.status !== 'cancelled' && new Date(o.orderDate).getTime() >= depuis)
      .reduce((sum, o) => sum + o.subtotalEur, 0),
    activeSuppliersCount: suppliers.length,
  };
}
