import {
  createConsumableInStorage,
  loadConsumablesFromStorage,
  loadMovementsFromStorage,
  recordMovementInStorage,
} from '@/features/stock/api/stock.storage';

import type {
  PurchaseMetrics,
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderItem,
  Supplier,
  SupplierInput,
} from '../types/purchases.types';

const STORAGE_PREFIX_SUPPLIERS = 'rezo_purchases_suppliers_';
const STORAGE_PREFIX_ORDERS = 'rezo_purchases_orders_';

function getStorageKeySuppliers(orgId: string): string {
  return `${STORAGE_PREFIX_SUPPLIERS}${orgId}`;
}

function getStorageKeyOrders(orgId: string): string {
  return `${STORAGE_PREFIX_ORDERS}${orgId}`;
}

// -----------------------------------------------------------------------------
// Données initiales réalistes (Multi-métiers)
// -----------------------------------------------------------------------------

const DEFAULT_SEEDED_SUPPLIERS: Omit<Supplier, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Rexel France',
    code: 'SUP-REXEL',
    contactName: 'Marc Delorme',
    email: 'commandes.pro@rexel.fr',
    phone: '01 42 68 50 00',
    address: '13 Boulevard Haussmann',
    city: 'Paris',
    postalCode: '75009',
    siret: '37982548200021',
    vatNumber: 'FR12379825482',
    website: 'https://www.rexel.fr',
    defaultPaymentTerms: '30 jours fin de mois',
    notes: 'Fournisseur principal matériel électrique, disjoncteurs et câbles.',
  },
  {
    name: 'Foliatec Telecom',
    code: 'SUP-FOLIA',
    contactName: 'Claire Vasseur',
    email: 'adv@foliatec-telecom.com',
    phone: '04 78 90 12 34',
    address: '45 Rue de la Soie',
    city: 'Villeurbanne',
    postalCode: '69100',
    siret: '81234567800019',
    vatNumber: 'FR34812345678',
    website: 'https://www.foliatec-telecom.com',
    defaultPaymentTerms: 'Virement 45 jours',
    notes: 'Câbles fibre optique, PTO, jarretières et réflectomètres.',
  },
  {
    name: 'Sonepar France',
    code: 'SUP-SONEPAR',
    contactName: 'Julien Renard',
    email: 'contact@sonepar.fr',
    phone: '01 58 44 20 00',
    address: '12 Place des États-Unis',
    city: 'Montrouge',
    postalCode: '92120',
    siret: '54201783900045',
    vatNumber: 'FR45542017839',
    website: 'https://www.sonepar.fr',
    defaultPaymentTerms: '30 jours net',
    notes: 'Appareillage, connecteurs WAGO et outillage électro-portatif.',
  },
  {
    name: 'CEDEO Distribution',
    code: 'SUP-CEDEO',
    contactName: 'Antoine Laurent',
    email: 'agence.lyon@cedeo.fr',
    phone: '04 72 00 11 22',
    address: '88 Avenue Jean Jaurès',
    city: 'Lyon',
    postalCode: '69007',
    siret: '31049995900214',
    vatNumber: 'FR56310499959',
    website: 'https://www.cedeo.fr',
    defaultPaymentTerms: 'Comptant ou 30 jours',
    notes: 'Raccords cuivre, multicouche, tuyauterie et sanitaire.',
  },
  {
    name: 'Würth France',
    code: 'SUP-WURTH',
    contactName: 'Sophie Mercier',
    email: 'pro@wurth.fr',
    phone: '03 88 64 53 00',
    address: 'Zone Industrielle Ouest',
    city: 'Erstein',
    postalCode: '67150',
    siret: '67588007200034',
    vatNumber: 'FR78675880072',
    website: 'https://www.wurth.fr',
    defaultPaymentTerms: '30 jours fin de mois',
    notes: 'Visserie, chevilles, EPI, gants isolants et consommables atelier.',
  },
];

// -----------------------------------------------------------------------------
// Fournisseurs
// -----------------------------------------------------------------------------

export function loadSuppliersFromStorage(orgId: string): Supplier[] {
  try {
    const raw = localStorage.getItem(getStorageKeySuppliers(orgId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Erreur de lecture
  }

  const now = new Date().toISOString();
  const seeded: Supplier[] = DEFAULT_SEEDED_SUPPLIERS.map((s, idx) => ({
    ...s,
    id: `sup-${idx + 1}-${Date.now()}`,
    organizationId: orgId,
    createdAt: now,
    updatedAt: now,
  }));

  try {
    localStorage.setItem(getStorageKeySuppliers(orgId), JSON.stringify(seeded));
  } catch {
    // Quota
  }

  return seeded;
}

export function saveSuppliersToStorage(orgId: string, suppliers: Supplier[]): void {
  try {
    localStorage.setItem(getStorageKeySuppliers(orgId), JSON.stringify(suppliers));
  } catch (err) {
    console.error('Failed to save suppliers to storage', err);
  }
}

export function createSupplierInStorage(orgId: string, input: SupplierInput): Supplier {
  const current = loadSuppliersFromStorage(orgId);
  const now = new Date().toISOString();

  const newSupplier: Supplier = {
    ...input,
    id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    organizationId: orgId,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newSupplier, ...current];
  saveSuppliersToStorage(orgId, updated);
  return newSupplier;
}

export function updateSupplierInStorage(
  orgId: string,
  supplierId: string,
  patch: Partial<SupplierInput>,
): Supplier {
  const current = loadSuppliersFromStorage(orgId);
  const index = current.findIndex((s) => s.id === supplierId);

  if (index === -1) {
    throw new Error(`Fournisseur introuvable (${supplierId})`);
  }

  const existing = current[index];
  if (!existing) {
    throw new Error(`Fournisseur introuvable (${supplierId})`);
  }

  const updated: Supplier = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  current[index] = updated;
  saveSuppliersToStorage(orgId, current);
  return updated;
}

export function deleteSupplierInStorage(orgId: string, supplierId: string): void {
  const current = loadSuppliersFromStorage(orgId);
  const filtered = current.filter((s) => s.id !== supplierId);
  saveSuppliersToStorage(orgId, filtered);
}

// -----------------------------------------------------------------------------
// Commandes Fournisseurs (Purchase Orders)
// -----------------------------------------------------------------------------

export function loadPurchaseOrdersFromStorage(orgId: string): PurchaseOrder[] {
  try {
    const raw = localStorage.getItem(getStorageKeyOrders(orgId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Erreur de lecture
  }

  const suppliers = loadSuppliersFromStorage(orgId);
  const supFoliatec = suppliers.find((s) => s.name.includes('Foliatec')) || suppliers[0];
  const supRexel = suppliers.find((s) => s.name.includes('Rexel')) || suppliers[1] || suppliers[0];

  const now = new Date();
  const d1 = new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const d2 = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const dNext = new Date(now.getTime() + 4 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const initialOrders: PurchaseOrder[] = [
    {
      id: `po-1-${Date.now()}`,
      reference: 'CMD-2026-042',
      organizationId: orgId,
      supplierId: supFoliatec?.id ?? 'sup-1',
      supplierName: supFoliatec?.name ?? 'Foliatec Telecom',
      supplierEmail: supFoliatec?.email,
      supplierPhone: supFoliatec?.phone,
      status: 'received',
      orderDate: d1,
      expectedDeliveryDate: d1,
      receivedDate: d1,
      items: [
        {
          id: 'item-1',
          reference: 'FBR-CAB-4FO',
          description: 'Câble Fibre Optique 4 FO G.657.A2 (500m)',
          unit: 'm',
          quantityOrdered: 500,
          quantityReceived: 500,
          unitPriceEur: 0.45,
          totalEur: 225.0,
        },
      ],
      subtotalEur: 225.0,
      taxRate: 0.2,
      taxEur: 45.0,
      totalEur: 270.0,
      notes: 'Livraison au dépôt central effectuée sans réserve.',
      createdAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 8 * 24 * 3600 * 1000).toISOString(),
    },
    {
      id: `po-2-${Date.now()}`,
      reference: 'CMD-2026-058',
      organizationId: orgId,
      supplierId: supRexel?.id ?? 'sup-2',
      supplierName: supRexel?.name ?? 'Rexel France',
      supplierEmail: supRexel?.email,
      supplierPhone: supRexel?.phone,
      status: 'sent',
      orderDate: d2,
      expectedDeliveryDate: dNext,
      missionRef: 'INT-2026-081',
      items: [
        {
          id: 'item-2',
          reference: 'ELEC-DISJ-16A',
          description: 'Disjoncteur Ph+N 16A Courbe C 4.5kA',
          unit: 'pièce',
          quantityOrdered: 30,
          quantityReceived: 0,
          unitPriceEur: 4.8,
          totalEur: 144.0,
        },
        {
          id: 'item-3',
          reference: 'ELEC-WAGO-3P',
          description: 'Bornes de connexion rapide 3 conducteurs (Boîte de 100)',
          unit: 'boîte',
          quantityOrdered: 5,
          quantityReceived: 0,
          unitPriceEur: 14.5,
          totalEur: 72.5,
        },
      ],
      subtotalEur: 216.5,
      taxRate: 0.2,
      taxEur: 43.3,
      totalEur: 259.8,
      notes: 'Matériel commandé pour réapprovisionnement et chantier tertiaire.',
      createdAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
    },
  ];

  try {
    localStorage.setItem(getStorageKeyOrders(orgId), JSON.stringify(initialOrders));
  } catch {
    // Quota
  }

  return initialOrders;
}

export function savePurchaseOrdersToStorage(orgId: string, orders: PurchaseOrder[]): void {
  try {
    localStorage.setItem(getStorageKeyOrders(orgId), JSON.stringify(orders));
  } catch (err) {
    console.error('Failed to save purchase orders to storage', err);
  }
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function calculateOrderTotals(items: PurchaseOrderItem[], taxRate = 0.2) {
  const subtotalEur = round2(
    items.reduce(
      (sum, item) =>
        sum +
        round2(
          (Number(item.quantityOrdered) || 0) * (Number(item.unitPriceEur) || 0),
        ),
      0,
    ),
  );
  const taxEur = round2(subtotalEur * taxRate);
  const totalEur = round2(subtotalEur + taxEur);
  return { subtotalEur, taxRate, taxEur, totalEur };
}

function findMatchingConsumable(
  consumables: ReturnType<typeof loadConsumablesFromStorage>,
  item: {
    consumableId?: string | undefined;
    reference?: string | undefined;
    description?: string | undefined;
  },
) {
  if (item.consumableId) {
    const found = consumables.find((c) => c.id === item.consumableId);
    if (found) return found;
  }
  const ref = item.reference?.trim().toUpperCase();
  if (ref) {
    const found = consumables.find((c) => c.reference.trim().toUpperCase() === ref);
    if (found) return found;
  }
  const desc = item.description?.trim().toLowerCase();
  if (desc) {
    const found = consumables.find(
      (c) =>
        c.name.trim().toLowerCase() === desc ||
        c.reference.trim().toLowerCase() === desc,
    );
    if (found) return found;
  }
  return null;
}

export function createPurchaseOrderInStorage(
  orgId: string,
  input: PurchaseOrderInput,
): PurchaseOrder {
  const current = loadPurchaseOrdersFromStorage(orgId);
  const suppliers = loadSuppliersFromStorage(orgId);
  const supplier = suppliers.find((s) => s.id === input.supplierId);

  if (!supplier) {
    throw new Error('Fournisseur sélectionné introuvable.');
  }

  const now = new Date().toISOString();
  const taxRate = input.taxRate ?? 0.2;
  const isDirectlyReceived = input.status === 'received';
  const consumables = loadConsumablesFromStorage(orgId);
  const year = new Date().getFullYear();
  const orderCount = current.length + 1;
  const ref = input.reference?.trim() || `CMD-${year}-${String(orderCount).padStart(3, '0')}`;

  // Calcul des lignes d'articles
  const items: PurchaseOrderItem[] = input.items.map((item, idx) => {
    const qty = Number(item.quantityOrdered) || 0;
    const price = Number(item.unitPriceEur) || 0;
    const totalEur = round2(qty * price);
    const qtyReceived = isDirectlyReceived ? qty : (Number(item.quantityReceived) || 0);

    let targetConsumable = findMatchingConsumable(consumables, item);

    if (isDirectlyReceived && qty > 0) {
      if (!targetConsumable) {
        try {
          targetConsumable = createConsumableInStorage(orgId, {
            reference: item.reference.trim().toUpperCase() || `ART-${Date.now().toString().slice(-4)}`,
            name: item.description.trim() || item.reference || 'Article reçu',
            category: 'Général & Divers',
            unit: item.unit || 'pièce',
            quantityInStock: 0,
            minThreshold: 5,
            unitPriceEur: price,
            location: 'Dépôt Central',
            supplier: supplier.name,
            notes: `Créé automatiquement depuis la commande fournisseur ${ref} (${supplier.name})`,
          });
          consumables.unshift(targetConsumable);
        } catch (err) {
          console.warn('Impossible de créer le consommable en stock', err);
        }
      }

      if (targetConsumable) {
        try {
          recordMovementInStorage(orgId, {
            consumableId: targetConsumable.id,
            type: 'in',
            quantity: qty,
            reason: `Réception directe Commande Fournisseur ${ref} (${supplier.name})`,
            locationTo: targetConsumable.location,
          });
        } catch (err) {
          console.warn('Impossible d’incrémenter le stock pour cet article', err);
        }
      }
    }

    return {
      id: item.id || `item-${Date.now()}-${idx}`,
      consumableId: targetConsumable ? targetConsumable.id : item.consumableId,
      reference: item.reference.trim().toUpperCase(),
      description: item.description.trim(),
      unit: item.unit || 'pièce',
      quantityOrdered: qty > 0 ? qty : 1,
      quantityReceived: qtyReceived,
      unitPriceEur: price,
      totalEur,
    };
  });

  const totals = calculateOrderTotals(items, taxRate);

  const newOrder: PurchaseOrder = {
    id: `po-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    reference: ref,
    organizationId: orgId,
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierEmail: supplier.email,
    supplierPhone: supplier.phone,
    supplierAddress: supplier.address
      ? `${supplier.address}, ${supplier.postalCode || ''} ${supplier.city || ''}`.trim()
      : undefined,
    status: input.status || 'draft',
    orderDate: input.orderDate,
    expectedDeliveryDate: input.expectedDeliveryDate,
    receivedDate: isDirectlyReceived ? now.slice(0, 10) : undefined,
    missionId: input.missionId,
    missionRef: input.missionRef?.trim(),
    items,
    ...totals,
    notes: input.notes?.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newOrder, ...current];
  savePurchaseOrdersToStorage(orgId, updated);
  return newOrder;
}

export function updatePurchaseOrderInStorage(
  orgId: string,
  orderId: string,
  input: Partial<PurchaseOrderInput>,
): PurchaseOrder {
  const current = loadPurchaseOrdersFromStorage(orgId);
  const index = current.findIndex((o) => o.id === orderId);

  if (index === -1) {
    throw new Error(`Bon de commande introuvable (${orderId})`);
  }

  const existing = current[index];
  if (!existing) {
    throw new Error(`Bon de commande introuvable (${orderId})`);
  }

  const suppliers = loadSuppliersFromStorage(orgId);
  const supplier = input.supplierId ? suppliers.find((s) => s.id === input.supplierId) : undefined;
  const consumables = loadConsumablesFromStorage(orgId);

  const willBeReceived = input.status === 'received' && existing.status !== 'received';

  let items = existing.items;
  if (input.items) {
    items = input.items.map((item, idx) => {
      const qty = Number(item.quantityOrdered) || 0;
      const price = Number(item.unitPriceEur) || 0;
      const totalEur = round2(qty * price);
      let targetConsumable = findMatchingConsumable(consumables, item);

      let qtyReceived = Number(item.quantityReceived) || 0;
      if (willBeReceived) {
        const delta = Math.max(0, qty - qtyReceived);
        qtyReceived = qty;
        if (delta > 0) {
          if (!targetConsumable) {
            try {
              targetConsumable = createConsumableInStorage(orgId, {
                reference: item.reference.trim().toUpperCase() || `ART-${Date.now().toString().slice(-4)}`,
                name: item.description.trim() || item.reference || 'Article reçu',
                category: 'Général & Divers',
                unit: item.unit || 'pièce',
                quantityInStock: 0,
                minThreshold: 5,
                unitPriceEur: price,
                location: 'Dépôt Central',
                supplier: existing.supplierName,
                notes: `Créé automatiquement depuis la commande fournisseur ${existing.reference}`,
              });
              consumables.unshift(targetConsumable);
            } catch (err) {
              console.warn('Impossible de créer le consommable en stock', err);
            }
          }

          if (targetConsumable) {
            try {
              recordMovementInStorage(orgId, {
                consumableId: targetConsumable.id,
                type: 'in',
                quantity: delta,
                reason: `Réception Commande Fournisseur ${existing.reference} (${existing.supplierName})`,
                locationTo: targetConsumable.location,
              });
            } catch (err) {
              console.warn('Impossible d’incrémenter le stock', err);
            }
          }
        }
      }

      return {
        id: item.id || `item-${Date.now()}-${idx}`,
        consumableId: targetConsumable ? targetConsumable.id : item.consumableId,
        reference: item.reference.trim().toUpperCase(),
        description: item.description.trim(),
        unit: item.unit || 'pièce',
        quantityOrdered: qty > 0 ? qty : 1,
        quantityReceived: qtyReceived,
        unitPriceEur: price,
        totalEur,
      };
    });
  } else if (willBeReceived) {
    items = items.map((item) => {
      const delta = Math.max(0, item.quantityOrdered - item.quantityReceived);
      let targetConsumable = findMatchingConsumable(consumables, item);
      if (delta > 0) {
        if (!targetConsumable) {
          try {
            targetConsumable = createConsumableInStorage(orgId, {
              reference: item.reference.trim().toUpperCase() || `ART-${Date.now().toString().slice(-4)}`,
              name: item.description.trim() || item.reference || 'Article reçu',
              category: 'Général & Divers',
              unit: item.unit || 'pièce',
              quantityInStock: 0,
              minThreshold: 5,
              unitPriceEur: item.unitPriceEur,
              location: 'Dépôt Central',
              supplier: existing.supplierName,
              notes: `Créé automatiquement depuis la commande fournisseur ${existing.reference}`,
            });
            consumables.unshift(targetConsumable);
          } catch (err) {
            console.warn('Impossible de créer le consommable en stock', err);
          }
        }

        if (targetConsumable) {
          try {
            recordMovementInStorage(orgId, {
              consumableId: targetConsumable.id,
              type: 'in',
              quantity: delta,
              reason: `Réception Commande Fournisseur ${existing.reference} (${existing.supplierName})`,
              locationTo: targetConsumable.location,
            });
          } catch (err) {
            console.warn('Impossible d’incrémenter le stock', err);
          }
        }
      }
      return {
        ...item,
        quantityReceived: item.quantityOrdered,
      };
    });
  }

  const taxRate = input.taxRate !== undefined ? input.taxRate : existing.taxRate;
  const totals = calculateOrderTotals(items, taxRate);

  const updated: PurchaseOrder = {
    ...existing,
    supplierId: supplier ? supplier.id : existing.supplierId,
    supplierName: supplier ? supplier.name : existing.supplierName,
    supplierEmail: supplier ? supplier.email : existing.supplierEmail,
    supplierPhone: supplier ? supplier.phone : existing.supplierPhone,
    supplierAddress: supplier
      ? `${supplier.address}, ${supplier.postalCode || ''} ${supplier.city || ''}`.trim()
      : existing.supplierAddress,
    reference: input.reference?.trim() || existing.reference,
    orderDate: input.orderDate || existing.orderDate,
    expectedDeliveryDate: input.expectedDeliveryDate ?? existing.expectedDeliveryDate,
    receivedDate: willBeReceived ? new Date().toISOString().slice(0, 10) : existing.receivedDate,
    missionId: input.missionId ?? existing.missionId,
    missionRef: input.missionRef?.trim() ?? existing.missionRef,
    status: input.status || existing.status,
    notes: input.notes !== undefined ? input.notes.trim() : existing.notes,
    items,
    ...totals,
    updatedAt: new Date().toISOString(),
  };

  current[index] = updated;
  savePurchaseOrdersToStorage(orgId, current);
  return updated;
}

export function deletePurchaseOrderInStorage(orgId: string, orderId: string): void {
  const current = loadPurchaseOrdersFromStorage(orgId);
  const filtered = current.filter((o) => o.id !== orderId);
  savePurchaseOrdersToStorage(orgId, filtered);
}

// -----------------------------------------------------------------------------
// Réception de marchandise (BL) et Synchronisation Stock
// -----------------------------------------------------------------------------

export function receivePurchaseOrderInStorage(
  orgId: string,
  orderId: string,
  receivedQuantities: Record<string, number>, // itemId -> quantityReceivedNow
  deliveryNotes?: string,
): PurchaseOrder {
  const orders = loadPurchaseOrdersFromStorage(orgId);
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    throw new Error(`Bon de commande introuvable (${orderId})`);
  }

  const consumables = loadConsumablesFromStorage(orgId);
  const now = new Date().toISOString();

  let allCompleted = true;
  let hasAnyReception = false;

  const updatedItems = order.items.map((item) => {
    const qtyNow = Number(receivedQuantities[item.id]) || 0;
    const newQtyReceived = Math.min(item.quantityOrdered, item.quantityReceived + qtyNow);

    if (qtyNow > 0) {
      hasAnyReception = true;

      // 1. Chercher si l'article est lié à un consommable de stock
      let targetConsumable = findMatchingConsumable(consumables, item);

      // Si l'article n'existe pas dans le stock, le créer automatiquement
      if (!targetConsumable && qtyNow > 0) {
        try {
          targetConsumable = createConsumableInStorage(orgId, {
            reference: item.reference.trim().toUpperCase() || `ART-${Date.now().toString().slice(-4)}`,
            name: item.description.trim() || item.reference || 'Article reçu',
            category: 'Général & Divers',
            unit: item.unit || 'pièce',
            quantityInStock: 0,
            minThreshold: 5,
            unitPriceEur: item.unitPriceEur || 0,
            location: 'Dépôt Central',
            supplier: order.supplierName,
            notes: `Créé automatiquement depuis la commande fournisseur ${order.reference}`,
          });
          consumables.unshift(targetConsumable);
        } catch (err) {
          console.warn('Impossible de créer le consommable en stock', err);
        }
      }

      // 2. Si le consommable existe, enregistrer l'entrée de stock
      if (targetConsumable) {
        try {
          recordMovementInStorage(orgId, {
            consumableId: targetConsumable.id,
            type: 'in',
            quantity: qtyNow,
            reason: `Réception Commande Fournisseur ${order.reference} (${order.supplierName})`,
            locationTo: targetConsumable.location,
          });
        } catch (err) {
          console.warn('Impossible d’incrémenter le stock pour cet article', err);
        }
      }
    }

    if (newQtyReceived < item.quantityOrdered) {
      allCompleted = false;
    }

    return {
      ...item,
      quantityReceived: newQtyReceived,
    };
  });

  const newStatus = allCompleted
    ? 'received'
    : hasAnyReception || order.status === 'partially_received'
      ? 'partially_received'
      : order.status;

  const updatedOrder: PurchaseOrder = {
    ...order,
    items: updatedItems,
    status: newStatus,
    receivedDate: allCompleted ? now.slice(0, 10) : order.receivedDate,
    deliveryNotes: deliveryNotes?.trim() || order.deliveryNotes,
    updatedAt: now,
  };

  const updatedOrders = orders.map((o) => (o.id === order.id ? updatedOrder : o));
  savePurchaseOrdersToStorage(orgId, updatedOrders);
  return updatedOrder;
}

// -----------------------------------------------------------------------------
// Réconciliation Automatique Achats <-> Stock
// -----------------------------------------------------------------------------

export function reconcilePurchasesWithStock(orgId: string): void {
  try {
    const orders = loadPurchaseOrdersFromStorage(orgId);
    if (!orders || orders.length === 0) return;

    const consumables = loadConsumablesFromStorage(orgId);
    const movements = loadMovementsFromStorage(orgId);

    for (const order of orders) {
      if (order.status === 'cancelled' || order.status === 'draft') continue;

      for (const item of order.items) {
        const qtyReceived =
          order.status === 'received'
            ? item.quantityOrdered
            : Number(item.quantityReceived) || 0;

        if (qtyReceived <= 0) continue;

        // Vérifier si ce mouvement a déjà été tracé dans l'historique
        const alreadyRecorded = movements.some(
          (m) =>
            m.reason?.includes(order.reference) &&
            (m.consumableReference.trim().toUpperCase() === item.reference.trim().toUpperCase() ||
              m.consumableName.trim().toLowerCase() === item.description.trim().toLowerCase() ||
              (item.consumableId && m.consumableId === item.consumableId)),
        );

        if (!alreadyRecorded) {
          let target = findMatchingConsumable(consumables, item);

          // Si non trouvé dans le stock, le créer automatiquement
          if (!target) {
            target = createConsumableInStorage(orgId, {
              reference:
                item.reference.trim().toUpperCase() || `ART-${Date.now().toString().slice(-4)}`,
              name: item.description.trim() || item.reference || 'Article fournisseur',
              category: 'Général & Divers',
              unit: item.unit || 'pièce',
              quantityInStock: 0,
              minThreshold: 5,
              unitPriceEur: item.unitPriceEur || 0,
              location: 'Dépôt Central',
              supplier: order.supplierName,
              notes: `Créé automatiquement depuis la commande ${order.reference}`,
            });
            consumables.unshift(target);
          }

          const newMov = recordMovementInStorage(orgId, {
            consumableId: target.id,
            type: 'in',
            quantity: qtyReceived,
            reason: `Réception Commande Fournisseur ${order.reference} (${order.supplierName})`,
            locationTo: target.location,
          });
          movements.unshift(newMov.movement);
        }
      }
    }
  } catch (err) {
    console.warn('Erreur lors de la réconciliation stock/achats', err);
  }
}

// -----------------------------------------------------------------------------
// Calcul des Métriques
// -----------------------------------------------------------------------------

export function calculatePurchaseMetrics(
  orders: PurchaseOrder[],
  suppliers: Supplier[],
): PurchaseMetrics {
  const totalOrders = orders.length;
  const ordersDraft = orders.filter((o) => o.status === 'draft').length;
  const ordersPendingDelivery = orders.filter(
    (o) => o.status === 'sent' || o.status === 'partially_received',
  ).length;
  const ordersCompleted = orders.filter((o) => o.status === 'received').length;

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;
  const totalSpendMonthEur = orders
    .filter(
      (o) =>
        o.status !== 'cancelled' &&
        new Date(o.orderDate).getTime() >= thirtyDaysAgo,
    )
    .reduce((sum, o) => sum + o.subtotalEur, 0);

  const activeSuppliersCount = suppliers.length;

  return {
    totalOrders,
    ordersDraft,
    ordersPendingDelivery,
    ordersCompleted,
    totalSpendMonthEur,
    activeSuppliersCount,
  };
}
