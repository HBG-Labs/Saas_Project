import { beforeEach, describe, expect, it } from 'vitest';

import {
  createPurchaseOrderInStorage,
  loadSuppliersFromStorage,
  receivePurchaseOrderInStorage,
  reconcilePurchasesWithStock,
  updatePurchaseOrderInStorage,
} from './api/purchases.storage';
import {
  loadConsumablesFromStorage,
  loadMovementsFromStorage,
} from '@/features/stock/api/stock.storage';

const ORG_ID = 'test-org-audit-purchases-stock';

describe('Audit & Intégration complète : Achats <-> Stock', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Créer une commande en brouillon (draft) ou envoyée (sent) n’impacte PAS le stock', () => {
    const suppliers = loadSuppliersFromStorage(ORG_ID);
    const supplier = suppliers[0]!;
    const initialConsumables = loadConsumablesFromStorage(ORG_ID);
    const targetItem = initialConsumables[0]!;
    const initialStock = targetItem.quantityInStock;
    const initialMovementsCount = loadMovementsFromStorage(ORG_ID).length;

    // Créer une commande en brouillon
    const order = createPurchaseOrderInStorage(ORG_ID, {
      supplierId: supplier.id,
      orderDate: '2026-08-20',
      status: 'draft',
      items: [
        {
          consumableId: targetItem.id,
          reference: targetItem.reference,
          description: targetItem.name,
          unit: targetItem.unit,
          quantityOrdered: 25,
          unitPriceEur: targetItem.unitPriceEur ?? 10,
        },
      ],
    });

    expect(order.status).toBe('draft');
    expect(order.items[0]?.quantityReceived).toBe(0);

    // Vérifier que le stock n'a pas bougé
    const consumablesAfter = loadConsumablesFromStorage(ORG_ID);
    const itemAfter = consumablesAfter.find((c) => c.id === targetItem.id)!;
    expect(itemAfter.quantityInStock).toBe(initialStock);

    const movementsAfter = loadMovementsFromStorage(ORG_ID);
    expect(movementsAfter.length).toBe(initialMovementsCount);
  });

  it('2. Réception partielle d’un bon de commande : incrémente le stock du montant partiel', () => {
    const suppliers = loadSuppliersFromStorage(ORG_ID);
    const supplier = suppliers[0]!;
    const initialConsumables = loadConsumablesFromStorage(ORG_ID);
    const targetItem = initialConsumables[0]!;
    const initialStock = targetItem.quantityInStock;

    const order = createPurchaseOrderInStorage(ORG_ID, {
      supplierId: supplier.id,
      orderDate: '2026-08-20',
      status: 'sent',
      items: [
        {
          consumableId: targetItem.id,
          reference: targetItem.reference,
          description: targetItem.name,
          unit: targetItem.unit,
          quantityOrdered: 20,
          unitPriceEur: 5,
        },
      ],
    });

    const itemId = order.items[0]!.id;

    // Réceptionner 8 unités sur 20
    const receivedOrder = receivePurchaseOrderInStorage(
      ORG_ID,
      order.id,
      { [itemId]: 8 },
      'Livraison partielle 8 colis',
    );

    expect(receivedOrder.status).toBe('partially_received');
    expect(receivedOrder.items[0]?.quantityReceived).toBe(8);

    // Vérifier le stock : initial + 8
    const consumablesAfter = loadConsumablesFromStorage(ORG_ID);
    const itemAfter = consumablesAfter.find((c) => c.id === targetItem.id)!;
    expect(itemAfter.quantityInStock).toBe(initialStock + 8);

    // Vérifier le mouvement de stock
    const movements = loadMovementsFromStorage(ORG_ID);
    const latestMov = movements[0]!;
    expect(latestMov.type).toBe('in');
    expect(latestMov.quantity).toBe(8);
    expect(latestMov.consumableReference).toBe(targetItem.reference);
    expect(latestMov.reason).toContain(order.reference);
  });

  it('3. Réception du solde restant : passe la commande à « Reçue » et complète le stock', () => {
    const suppliers = loadSuppliersFromStorage(ORG_ID);
    const supplier = suppliers[0]!;
    const initialConsumables = loadConsumablesFromStorage(ORG_ID);
    const targetItem = initialConsumables[1]!;
    const initialStock = targetItem.quantityInStock;

    const order = createPurchaseOrderInStorage(ORG_ID, {
      supplierId: supplier.id,
      orderDate: '2026-08-20',
      status: 'sent',
      items: [
        {
          consumableId: targetItem.id,
          reference: targetItem.reference,
          description: targetItem.name,
          unit: targetItem.unit,
          quantityOrdered: 10,
          unitPriceEur: 15,
        },
      ],
    });

    const itemId = order.items[0]!.id;

    // 1ère réception : 4 unités
    receivePurchaseOrderInStorage(ORG_ID, order.id, { [itemId]: 4 });

    // 2ème réception : 6 unités (le solde)
    const finalOrder = receivePurchaseOrderInStorage(ORG_ID, order.id, { [itemId]: 6 });

    expect(finalOrder.status).toBe('received');
    expect(finalOrder.items[0]?.quantityReceived).toBe(10);
    expect(finalOrder.receivedDate).toBeDefined();

    // Vérifier le stock : initial + 10
    const consumablesAfter = loadConsumablesFromStorage(ORG_ID);
    const itemAfter = consumablesAfter.find((c) => c.id === targetItem.id)!;
    expect(itemAfter.quantityInStock).toBe(initialStock + 10);
  });

  it('4. Création directe en statut « Reçue & Soldée » : incrémente immédiatement le stock', () => {
    const suppliers = loadSuppliersFromStorage(ORG_ID);
    const supplier = suppliers[0]!;
    const initialConsumables = loadConsumablesFromStorage(ORG_ID);
    const targetItem = initialConsumables[2]!;
    const initialStock = targetItem.quantityInStock;

    const order = createPurchaseOrderInStorage(ORG_ID, {
      supplierId: supplier.id,
      orderDate: '2026-08-20',
      status: 'received',
      items: [
        {
          consumableId: targetItem.id,
          reference: targetItem.reference,
          description: targetItem.name,
          unit: targetItem.unit,
          quantityOrdered: 15,
          unitPriceEur: 12,
        },
      ],
    });

    expect(order.status).toBe('received');
    expect(order.items[0]?.quantityReceived).toBe(15);

    const consumablesAfter = loadConsumablesFromStorage(ORG_ID);
    const itemAfter = consumablesAfter.find((c) => c.id === targetItem.id)!;
    expect(itemAfter.quantityInStock).toBe(initialStock + 15);

    const movements = loadMovementsFromStorage(ORG_ID);
    expect(movements[0]?.type).toBe('in');
    expect(movements[0]?.quantity).toBe(15);
  });

  it('5. Commande d’un NOUVEL article inexistant dans le stock : crée la fiche stock automatiquement', () => {
    const suppliers = loadSuppliersFromStorage(ORG_ID);
    const supplier = suppliers[0]!;
    const newSku = 'CAPTEUR-IOT-TEMP-5G';
    const newName = 'Sonde de température sans fil LoRa/5G';

    const order = createPurchaseOrderInStorage(ORG_ID, {
      supplierId: supplier.id,
      orderDate: '2026-08-20',
      status: 'received',
      items: [
        {
          reference: newSku,
          description: newName,
          unit: 'pièce',
          quantityOrdered: 12,
          unitPriceEur: 48.5,
        },
      ],
    });

    expect(order.status).toBe('received');

    // Vérifier que la fiche stock a été créée
    const consumables = loadConsumablesFromStorage(ORG_ID);
    const createdItem = consumables.find((c) => c.reference === newSku);
    expect(createdItem).toBeDefined();
    expect(createdItem?.name).toBe(newName);
    expect(createdItem?.quantityInStock).toBe(12);
    expect(createdItem?.unitPriceEur).toBe(48.5);

    // Vérifier le mouvement de stock
    const movements = loadMovementsFromStorage(ORG_ID);
    const mov = movements.find((m) => m.consumableReference === newSku);
    expect(mov).toBeDefined();
    expect(mov?.type).toBe('in');
    expect(mov?.quantity).toBe(12);
  });

  it('6. Modification du statut d’une commande existante vers « Reçue » : met à jour le stock', () => {
    const suppliers = loadSuppliersFromStorage(ORG_ID);
    const supplier = suppliers[0]!;
    const initialConsumables = loadConsumablesFromStorage(ORG_ID);
    const targetItem = initialConsumables[3]!;
    const initialStock = targetItem.quantityInStock;

    // Créer une commande en attente (sent)
    const order = createPurchaseOrderInStorage(ORG_ID, {
      supplierId: supplier.id,
      orderDate: '2026-08-20',
      status: 'sent',
      items: [
        {
          consumableId: targetItem.id,
          reference: targetItem.reference,
          description: targetItem.name,
          unit: targetItem.unit,
          quantityOrdered: 50,
          unitPriceEur: 2,
        },
      ],
    });

    // Passer la commande en 'received' via updatePurchaseOrderInStorage
    const updated = updatePurchaseOrderInStorage(ORG_ID, order.id, {
      status: 'received',
    });

    expect(updated.status).toBe('received');
    expect(updated.items[0]?.quantityReceived).toBe(50);

    const consumablesAfter = loadConsumablesFromStorage(ORG_ID);
    const itemAfter = consumablesAfter.find((c) => c.id === targetItem.id)!;
    expect(itemAfter.quantityInStock).toBe(initialStock + 50);
  });

  it('7. Idempotence de la réconciliation automatique (reconcilePurchasesWithStock)', () => {
    const suppliers = loadSuppliersFromStorage(ORG_ID);
    const supplier = suppliers[0]!;
    const initialConsumables = loadConsumablesFromStorage(ORG_ID);
    const targetItem = initialConsumables[0]!;
    const initialStock = targetItem.quantityInStock;

    // Créer une commande reçue
    createPurchaseOrderInStorage(ORG_ID, {
      supplierId: supplier.id,
      orderDate: '2026-08-20',
      status: 'received',
      items: [
        {
          consumableId: targetItem.id,
          reference: targetItem.reference,
          description: targetItem.name,
          unit: targetItem.unit,
          quantityOrdered: 10,
          unitPriceEur: 5,
        },
      ],
    });

    const stockAfterCreate = loadConsumablesFromStorage(ORG_ID).find(
      (c) => c.id === targetItem.id,
    )!.quantityInStock;
    expect(stockAfterCreate).toBe(initialStock + 10);

    const movementsCount1 = loadMovementsFromStorage(ORG_ID).length;

    // Lancer la réconciliation 3 fois de suite
    reconcilePurchasesWithStock(ORG_ID);
    reconcilePurchasesWithStock(ORG_ID);
    reconcilePurchasesWithStock(ORG_ID);

    // Le stock et le nombre de mouvements ne doivent PAS doubler
    const stockAfterReconcile = loadConsumablesFromStorage(ORG_ID).find(
      (c) => c.id === targetItem.id,
    )!.quantityInStock;
    expect(stockAfterReconcile).toBe(initialStock + 10);

    const movementsCount2 = loadMovementsFromStorage(ORG_ID).length;
    expect(movementsCount2).toBe(movementsCount1);
  });

  it('8. Commande multi-lignes : toutes les lignes sont traitées sans interférence', () => {
    const suppliers = loadSuppliersFromStorage(ORG_ID);
    const supplier = suppliers[0]!;
    const consumables = loadConsumablesFromStorage(ORG_ID);
    const item1 = consumables[0]!;
    const item2 = consumables[1]!;

    const stock1Before = item1.quantityInStock;
    const stock2Before = item2.quantityInStock;

    const order = createPurchaseOrderInStorage(ORG_ID, {
      supplierId: supplier.id,
      orderDate: '2026-08-20',
      status: 'sent',
      items: [
        {
          consumableId: item1.id,
          reference: item1.reference,
          description: item1.name,
          unit: item1.unit,
          quantityOrdered: 20,
          unitPriceEur: 10,
        },
        {
          consumableId: item2.id,
          reference: item2.reference,
          description: item2.name,
          unit: item2.unit,
          quantityOrdered: 15,
          unitPriceEur: 20,
        },
      ],
    });

    // Réceptionner les deux articles en même temps
    const itemId1 = order.items[0]!.id;
    const itemId2 = order.items[1]!.id;

    receivePurchaseOrderInStorage(ORG_ID, order.id, {
      [itemId1]: 20,
      [itemId2]: 15,
    });

    const consumablesAfter = loadConsumablesFromStorage(ORG_ID);
    const item1After = consumablesAfter.find((c) => c.id === item1.id)!;
    const item2After = consumablesAfter.find((c) => c.id === item2.id)!;

    expect(item1After.quantityInStock).toBe(stock1Before + 20);
    expect(item2After.quantityInStock).toBe(stock2Before + 15);
  });

  it('9. Correspondance insensible à la casse pour les références SKU saisies à la main', () => {
    const suppliers = loadSuppliersFromStorage(ORG_ID);
    const supplier = suppliers[0]!;
    const consumables = loadConsumablesFromStorage(ORG_ID);
    const targetItem = consumables[0]!;
    const initialStock = targetItem.quantityInStock;

    // Saisie en minuscules sans consumableId explicite
    const order = createPurchaseOrderInStorage(ORG_ID, {
      supplierId: supplier.id,
      orderDate: '2026-08-20',
      status: 'received',
      items: [
        {
          reference: targetItem.reference.toLowerCase(), // ex: "fbr-cab-4fo"
          description: 'Mon descriptif libre',
          unit: targetItem.unit,
          quantityOrdered: 7,
          unitPriceEur: 10,
        },
      ],
    });

    expect(order.status).toBe('received');

    const consumablesAfter = loadConsumablesFromStorage(ORG_ID);
    const itemAfter = consumablesAfter.find((c) => c.id === targetItem.id)!;
    expect(itemAfter.quantityInStock).toBe(initialStock + 7);
  });

  it('10. Calculs financiers et totaux HT / TVA / TTC exacts', () => {
    const suppliers = loadSuppliersFromStorage(ORG_ID);
    const supplier = suppliers[0]!;

    const order = createPurchaseOrderInStorage(ORG_ID, {
      supplierId: supplier.id,
      orderDate: '2026-08-20',
      taxRate: 0.2, // 20%
      items: [
        {
          reference: 'ART-1',
          description: 'Article 1',
          unit: 'pièce',
          quantityOrdered: 3,
          unitPriceEur: 33.33, // 99.99
        },
        {
          reference: 'ART-2',
          description: 'Article 2',
          unit: 'mètre',
          quantityOrdered: 10,
          unitPriceEur: 10.01, // 100.10
        },
      ],
    });

    // 99.99 + 100.10 = 200.09 HT
    expect(order.subtotalEur).toBe(200.09);
    // 200.09 * 0.20 = 40.018 -> 40.02 TVA
    expect(order.taxEur).toBe(40.02);
    // 200.09 + 40.02 = 240.11 TTC
    expect(order.totalEur).toBe(240.11);
  });
});
