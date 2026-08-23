import { describe, expect, it } from 'vitest';

import { calculatePurchaseMetrics, computeOrderTotals } from './api/purchases.api';
import type { PurchaseOrder, PurchaseOrderStatus, Supplier } from './types/purchases.types';

/**
 * Règles de gestion des achats restées côté TypeScript.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI A CHANGÉ DE CAMP
 *
 * La version précédente de ce fichier éprouvait l'enchaînement « je pointe une
 * livraison → le stock augmente » en rejouant les fonctions `localStorage` des
 * deux modules. Cet enchaînement vit désormais dans une transaction
 * PostgreSQL — `receive_purchase_order`, `20260821100000_purchases.sql` — et ne
 * peut donc plus être éprouvé sans base. Il l'est par le script de vérification
 * de bout en bout, connecté au vrai serveur : réception partielle, solde,
 * plafonnement au-delà du commandé, création de l'article manquant.
 *
 * Le simuler ici en réimplémentant la même logique en TypeScript donnerait un
 * test qui ne prouve plus rien : il vérifierait sa propre copie, pas le code qui
 * s'exécute.
 *
 * Restent les règles qui n'ont PAS bougé de langage — les calculs financiers et
 * les indicateurs. Ce sont elles que ce fichier verrouille.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function ligne(quantityOrdered: number, unitPriceEur: number) {
  // Le total de ligne est arrondi au centime AVANT d'entrer dans la somme,
  // exactement comme le fait le mapper.
  return { totalEur: Math.round((quantityOrdered * unitPriceEur + Number.EPSILON) * 100) / 100 };
}

function commande(over: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 'po-1',
    organizationId: 'org-1',
    reference: 'CMD-2026-001',
    supplierId: 'sup-1',
    supplierName: 'Fournisseur A',
    status: 'draft',
    orderDate: new Date().toISOString().slice(0, 10),
    items: [],
    subtotalEur: 0,
    taxRate: 0.2,
    taxEur: 0,
    totalEur: 0,
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
    ...over,
  };
}

function fournisseur(id: string): Supplier {
  return {
    id,
    organizationId: 'org-1',
    name: `Fournisseur ${id}`,
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
  };
}

describe('calculs financiers d’un bon de commande', () => {
  it('arrondit chaque ligne au centime avant de sommer', () => {
    // Le cas historique du module : 3 × 33,33 = 99,99 et 10 × 10,01 = 100,10.
    // Sommer les valeurs non arrondies donnerait 200,0900000000000⁠2 puis un
    // centime d'écart sur la TVA.
    const totaux = computeOrderTotals([ligne(3, 33.33), ligne(10, 10.01)], 0.2);

    expect(totaux.subtotalEur).toBe(200.09);
    expect(totaux.taxEur).toBe(40.02);
    expect(totaux.totalEur).toBe(240.11);
  });

  it('applique la TVA au sous-total HT, jamais ligne à ligne', () => {
    // Trois lignes à 0,10 € : ligne à ligne, la TVA de chacune s'arrondirait à
    // 0,02 € (soit 0,06 €) au lieu des 0,06 € du sous-total. Le cas ne diverge
    // que sur des montants plus retors, d'où le contrôle explicite du chemin.
    const totaux = computeOrderTotals([ligne(1, 0.1), ligne(1, 0.1), ligne(1, 0.1)], 0.2);

    expect(totaux.subtotalEur).toBe(0.3);
    expect(totaux.taxEur).toBe(0.06);
    expect(totaux.totalEur).toBe(0.36);
  });

  it('accepte un taux de TVA nul sans le confondre avec une absence de taux', () => {
    const totaux = computeOrderTotals([ligne(2, 50)], 0);

    expect(totaux.subtotalEur).toBe(100);
    expect(totaux.taxEur).toBe(0);
    expect(totaux.totalEur).toBe(100);
  });

  it('renvoie zéro pour une commande sans ligne', () => {
    expect(computeOrderTotals([], 0.2)).toEqual({ subtotalEur: 0, taxEur: 0, totalEur: 0 });
  });
});

describe('indicateurs de la page Achats', () => {
  const maintenant = Date.parse('2026-08-21T12:00:00.000Z');
  const jours = (n: number) => new Date(maintenant - n * 24 * 3600 * 1000).toISOString().slice(0, 10);

  function jeu(statuts: PurchaseOrderStatus[]): PurchaseOrder[] {
    return statuts.map((status, index) =>
      commande({ id: `po-${index}`, status, orderDate: jours(1), subtotalEur: 100 }),
    );
  }

  it('compte toutes les commandes, brouillons et annulées compris', () => {
    const metrics = calculatePurchaseMetrics(
      jeu(['draft', 'sent', 'received', 'cancelled']),
      [],
      maintenant,
    );

    expect(metrics.totalOrders).toBe(4);
    expect(metrics.ordersDraft).toBe(1);
    expect(metrics.ordersCompleted).toBe(1);
  });

  it('range « envoyée » et « partiellement reçue » parmi les livraisons attendues', () => {
    // C'est ce compteur qui alimente le badge de l'onglet : une commande
    // partiellement reçue attend toujours du monde.
    const metrics = calculatePurchaseMetrics(
      jeu(['sent', 'partially_received', 'received', 'draft']),
      [],
      maintenant,
    );

    expect(metrics.ordersPendingDelivery).toBe(2);
  });

  it('exclut les commandes annulées de la dépense', () => {
    const metrics = calculatePurchaseMetrics(
      [
        commande({ id: 'a', status: 'sent', orderDate: jours(1), subtotalEur: 100 }),
        commande({ id: 'b', status: 'cancelled', orderDate: jours(1), subtotalEur: 500 }),
      ],
      [],
      maintenant,
    );

    expect(metrics.totalSpendMonthEur).toBe(100);
  });

  it('retient une fenêtre glissante de trente jours, pas le mois calendaire', () => {
    const metrics = calculatePurchaseMetrics(
      [
        commande({ id: 'a', status: 'sent', orderDate: jours(29), subtotalEur: 100 }),
        commande({ id: 'b', status: 'sent', orderDate: jours(45), subtotalEur: 900 }),
      ],
      [],
      maintenant,
    );

    expect(metrics.totalSpendMonthEur).toBe(100);
  });

  it('somme la dépense en HT', () => {
    // `subtotalEur`, pas `totalEur` : ce que l'entreprise engage hors taxe.
    const metrics = calculatePurchaseMetrics(
      [
        commande({
          id: 'a',
          status: 'sent',
          orderDate: jours(1),
          subtotalEur: 200,
          totalEur: 240,
        }),
      ],
      [],
      maintenant,
    );

    expect(metrics.totalSpendMonthEur).toBe(200);
  });

  it('compte les fournisseurs enregistrés', () => {
    const metrics = calculatePurchaseMetrics([], [fournisseur('a'), fournisseur('b')], maintenant);

    expect(metrics.activeSuppliersCount).toBe(2);
  });

  it('ne se plaint pas d’une organisation vide', () => {
    const metrics = calculatePurchaseMetrics([], [], maintenant);

    expect(metrics).toEqual({
      totalOrders: 0,
      ordersDraft: 0,
      ordersPendingDelivery: 0,
      ordersCompleted: 0,
      totalSpendMonthEur: 0,
      activeSuppliersCount: 0,
    });
  });
});
