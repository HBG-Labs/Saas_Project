import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConsumableInput, StockConsumable, StockMovement } from '../types/stock.types';

import { useStock } from './useStock';

/**
 * Le stock, désormais lu et écrit en base.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CES CAS VÉRIFIENT — ET CE QU'ILS NE VÉRIFIENT PLUS
 *
 * La version précédente s'appuyait sur les sept articles de démonstration semés
 * par `stock.storage.ts` dans `localStorage` : elle affirmait
 * `consumables.length > 0` sur un stock vide, ce qui ne testait que la présence
 * du seed. Un stock RÉEL commence vide.
 *
 * La couche `stock.api` est simulée : ces cas portent sur le hook — cadrage par
 * organisation, calcul des métriques, invalidation après mutation — pas sur
 * PostgREST. Le cloisonnement multi-tenant, lui, est appliqué par les policies
 * et se vérifie en base, pas ici.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const api = vi.hoisted(() => ({
  consumables: [] as StockConsumable[],
  movements: [] as StockMovement[],
  listConsumables: vi.fn(),
  listMovements: vi.fn(),
  createConsumable: vi.fn(),
  updateConsumable: vi.fn(),
  deleteConsumable: vi.fn(),
  recordMovement: vi.fn(),
}));

vi.mock('../api/stock.api', () => ({
  listConsumables: api.listConsumables,
  listMovements: api.listMovements,
  createConsumable: api.createConsumable,
  updateConsumable: api.updateConsumable,
  deleteConsumable: api.deleteConsumable,
  recordMovement: api.recordMovement,
}));

const ORG = 'org-test-1';

function article(over: Partial<StockConsumable> = {}): StockConsumable {
  return {
    id: 'c1',
    organizationId: ORG,
    reference: 'CAB-FO-001',
    name: 'Câble fibre G.657.A2',
    category: 'Câblage & Fibre',
    unit: 'm',
    quantityInStock: 100,
    minThreshold: 20,
    unitPriceEur: 1.5,
    sellingPriceEur: 3,
    location: 'Dépôt A',
    supplier: undefined,
    notes: undefined,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

function entree(over: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'm1',
    organizationId: ORG,
    consumableId: 'c1',
    consumableName: 'Câble fibre G.657.A2',
    consumableReference: 'CAB-FO-001',
    type: 'in',
    quantity: 50,
    reason: 'Réception',
    technicianId: undefined,
    technicianName: undefined,
    interventionRef: undefined,
    locationFrom: undefined,
    locationTo: undefined,
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...over,
  };
}

const saisie: ConsumableInput = {
  reference: 'PTO-SC-APC',
  name: 'PTO SC/APC',
  category: 'Câblage & Fibre',
  unit: 'pièce',
  quantityInStock: 18,
  minThreshold: 25,
  unitPriceEur: 4,
  sellingPriceEur: 9,
  location: 'Dépôt B',
};

describe('useStock', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    api.consumables = [article()];
    api.movements = [entree()];

    api.listConsumables.mockImplementation(() => Promise.resolve(api.consumables));
    api.listMovements.mockImplementation(() => Promise.resolve(api.movements));

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  function monter(organizationId: string | null = ORG) {
    return renderHook(() => useStock(organizationId), { wrapper });
  }

  it("ne requête rien tant qu'aucune organisation n'est sélectionnée", () => {
    const { result } = monter(null);

    expect(api.listConsumables).not.toHaveBeenCalled();
    expect(api.listMovements).not.toHaveBeenCalled();
    expect(result.current.consumables).toEqual([]);
  });

  it("cadre la lecture sur l'organisation courante", async () => {
    const { result } = monter();

    await waitFor(() => {
      expect(result.current.consumables).toHaveLength(1);
    });

    expect(api.listConsumables).toHaveBeenCalledWith(ORG);
    expect(api.listMovements).toHaveBeenCalledWith(ORG);
  });

  it('calcule les métriques à partir des données du serveur', async () => {
    api.consumables = [
      article({ id: 'c1', quantityInStock: 100, minThreshold: 20, unitPriceEur: 1.5 }),
      article({ id: 'c2', reference: 'R2', quantityInStock: 5, minThreshold: 25, unitPriceEur: 2 }),
    ];

    const { result } = monter();

    await waitFor(() => {
      expect(result.current.consumables).toHaveLength(2);
    });

    expect(result.current.metrics.totalArticles).toBe(2);
    expect(result.current.metrics.totalQuantity).toBe(105);
    // 100 × 1,50 + 5 × 2,00
    expect(result.current.metrics.totalValueEur).toBeCloseTo(160);
    expect(result.current.metrics.movementsCountMonth).toBe(1);
  });

  it('signale les articles sous le seuil', async () => {
    api.consumables = [
      article({ id: 'c1', quantityInStock: 100, minThreshold: 20 }),
      article({ id: 'c2', reference: 'R2', quantityInStock: 18, minThreshold: 25 }),
      // Seuil atteint À L'ÉGALITÉ : c'est déjà une alerte, pas encore un manque.
      article({ id: 'c3', reference: 'R3', quantityInStock: 10, minThreshold: 10 }),
    ];

    const { result } = monter();

    await waitFor(() => {
      expect(result.current.consumables).toHaveLength(3);
    });

    expect(result.current.lowStockArticles.map((a) => a.id)).toEqual(['c2', 'c3']);
    expect(result.current.metrics.lowStockCount).toBe(2);
  });

  it("transmet l'organisation à la création puis relit le serveur", async () => {
    api.createConsumable.mockImplementation((_org: string, input: ConsumableInput) => {
      const cree = article({ id: 'c2', reference: input.reference, name: input.name });
      api.consumables = [...api.consumables, cree];
      return Promise.resolve(cree);
    });

    const { result } = monter();
    await waitFor(() => expect(result.current.consumables).toHaveLength(1));

    await act(async () => {
      await result.current.addConsumable(saisie);
    });

    expect(api.createConsumable).toHaveBeenCalledWith(ORG, saisie);
    await waitFor(() => expect(result.current.consumables).toHaveLength(2));
  });

  it('met à jour un article par son identifiant', async () => {
    api.updateConsumable.mockResolvedValue(article({ name: 'Câble fibre — nouveau libellé' }));

    const { result } = monter();
    await waitFor(() => expect(result.current.consumables).toHaveLength(1));

    await act(async () => {
      await result.current.updateConsumable('c1', { name: 'Câble fibre — nouveau libellé' });
    });

    expect(api.updateConsumable).toHaveBeenCalledWith('c1', {
      name: 'Câble fibre — nouveau libellé',
    });
  });

  it('supprime un article et rafraîchit la liste', async () => {
    api.deleteConsumable.mockImplementation(() => {
      api.consumables = [];
      return Promise.resolve();
    });

    const { result } = monter();
    await waitFor(() => expect(result.current.consumables).toHaveLength(1));

    await act(async () => {
      await result.current.deleteConsumable('c1');
    });

    expect(api.deleteConsumable).toHaveBeenCalledWith('c1');
    await waitFor(() => expect(result.current.consumables).toHaveLength(0));
  });

  it('délègue le calcul de la nouvelle quantité au serveur', async () => {
    api.recordMovement.mockImplementation(() => {
      // Le serveur a décrémenté : le hook ne recalcule rien lui-même.
      api.consumables = [article({ quantityInStock: 90 })];
      return Promise.resolve(entree({ type: 'out', quantity: 10 }));
    });

    const { result } = monter();
    await waitFor(() => expect(result.current.consumables).toHaveLength(1));

    await act(async () => {
      await result.current.recordMovement({
        consumableId: 'c1',
        type: 'out',
        quantity: 10,
        reason: 'Chantier Dupont',
      });
    });

    await waitFor(() => {
      expect(result.current.consumables[0]?.quantityInStock).toBe(90);
    });
  });

  it('traduit un ajustement rapide signé en mouvement d’entrée ou de sortie', async () => {
    api.recordMovement.mockResolvedValue(entree());

    const { result } = monter();
    await waitFor(() => expect(result.current.consumables).toHaveLength(1));

    await act(async () => {
      await result.current.quickAdjust('c1', -4, 'Consommation chantier');
    });

    expect(api.recordMovement).toHaveBeenCalledWith({
      consumableId: 'c1',
      type: 'out',
      quantity: 4,
      reason: 'Consommation chantier',
    });

    await act(async () => {
      await result.current.quickAdjust('c1', 7);
    });

    expect(api.recordMovement).toHaveBeenLastCalledWith({
      consumableId: 'c1',
      type: 'in',
      quantity: 7,
      reason: 'Réapprovisionnement rapide',
    });
  });

  it("remonte l'erreur du serveur au lieu d'afficher un stock vide", async () => {
    const panne = new Error('permission denied for table stock_consumables');
    api.listConsumables.mockRejectedValue(panne);

    const { result } = monter();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(panne);
    expect(result.current.consumables).toEqual([]);
  });
});
