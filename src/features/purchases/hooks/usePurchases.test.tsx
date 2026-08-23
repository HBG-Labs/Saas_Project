import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as PurchasesApi from '../api/purchases.api';
import type {
  PurchaseOrder,
  PurchaseOrderInput,
  Supplier,
  SupplierInput,
} from '../types/purchases.types';

import { usePurchases } from './usePurchases';

/**
 * Les achats, désormais lus et écrits en base.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CES CAS VÉRIFIENT — ET CE QU'ILS NE VÉRIFIENT PLUS
 *
 * La version précédente affirmait `suppliers.length > 0` sur une organisation
 * neuve : elle ne testait que la présence des cinq fournisseurs de démonstration
 * semés dans `localStorage`. Une organisation réelle commence vide.
 *
 * Elle attendait aussi par `setTimeout(50)` plutôt que par `waitFor`, ce qui
 * rendait le résultat dépendant de la charge de la machine.
 *
 * La couche `purchases.api` est simulée : ces cas portent sur le hook — cadrage
 * par organisation, indicateurs, invalidation croisée avec le stock — pas sur
 * PostgREST. L'enchaînement réception → stock est vérifié en base.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const api = vi.hoisted(() => ({
  suppliers: [] as Supplier[],
  orders: [] as PurchaseOrder[],
  listSuppliers: vi.fn(),
  listPurchaseOrders: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
  deleteSupplier: vi.fn(),
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
  deletePurchaseOrder: vi.fn(),
  receivePurchaseOrder: vi.fn(),
}));

vi.mock('../api/purchases.api', async (importOriginal) => {
  // `calculatePurchaseMetrics` est une fonction pure : la simuler priverait ces
  // cas de ce qu'ils veulent justement observer.
  const reel = await importOriginal<typeof PurchasesApi>();

  return {
    calculatePurchaseMetrics: reel.calculatePurchaseMetrics,
    listSuppliers: api.listSuppliers,
    listPurchaseOrders: api.listPurchaseOrders,
    createSupplier: api.createSupplier,
    updateSupplier: api.updateSupplier,
    deleteSupplier: api.deleteSupplier,
    createPurchaseOrder: api.createPurchaseOrder,
    updatePurchaseOrder: api.updatePurchaseOrder,
    deletePurchaseOrder: api.deletePurchaseOrder,
    receivePurchaseOrder: api.receivePurchaseOrder,
  };
});

const ORG = 'org-test-achats';

function fournisseur(over: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup-1',
    organizationId: ORG,
    name: 'Rexel France',
    code: 'REX',
    email: 'commandes@rexel.test',
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
    ...over,
  };
}

function commande(over: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 'po-1',
    organizationId: ORG,
    reference: 'CMD-2026-001',
    supplierId: 'sup-1',
    supplierName: 'Rexel France',
    status: 'draft',
    orderDate: new Date().toISOString().slice(0, 10),
    items: [
      {
        id: 'item-1',
        reference: 'CAB-FO-001',
        description: 'Câble fibre',
        unit: 'm',
        quantityOrdered: 100,
        quantityReceived: 0,
        unitPriceEur: 1,
        totalEur: 100,
      },
    ],
    subtotalEur: 100,
    taxRate: 0.2,
    taxEur: 20,
    totalEur: 120,
    createdAt: '2026-08-21T00:00:00.000Z',
    updatedAt: '2026-08-21T00:00:00.000Z',
    ...over,
  };
}

const saisieFournisseur: SupplierInput = {
  name: 'Sonepar',
  code: 'SON',
  email: 'contact@sonepar.test',
};

const saisieCommande: PurchaseOrderInput = {
  supplierId: 'sup-1',
  orderDate: '2026-08-21',
  items: [
    {
      reference: 'CAB-FO-001',
      description: 'Câble fibre',
      unit: 'm',
      quantityOrdered: 50,
      unitPriceEur: 2,
    },
  ],
};

describe('usePurchases', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    api.suppliers = [fournisseur()];
    api.orders = [commande()];

    api.listSuppliers.mockImplementation(() => Promise.resolve(api.suppliers));
    api.listPurchaseOrders.mockImplementation(() => Promise.resolve(api.orders));

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  function monter(organizationId: string | null = ORG) {
    return renderHook(() => usePurchases(organizationId), { wrapper });
  }

  it("ne requête rien tant qu'aucune organisation n'est sélectionnée", () => {
    const { result } = monter(null);

    expect(api.listSuppliers).not.toHaveBeenCalled();
    expect(api.listPurchaseOrders).not.toHaveBeenCalled();
    expect(result.current.suppliers).toEqual([]);
    expect(result.current.orders).toEqual([]);
  });

  it("refuse de muter sans organisation plutôt que d'écrire ailleurs", async () => {
    // Le repli `?? 'demo'` faisait écrire les mutations dans une organisation
    // fantôme, sans que rien ne le signale.
    const { result } = monter(null);

    await expect(result.current.createSupplier(saisieFournisseur)).rejects.toThrow(
      /organisation/i,
    );
    expect(api.createSupplier).not.toHaveBeenCalled();
  });

  it("cadre la lecture sur l'organisation courante", async () => {
    const { result } = monter();

    await waitFor(() => {
      expect(result.current.suppliers).toHaveLength(1);
    });

    expect(api.listSuppliers).toHaveBeenCalledWith(ORG);
    expect(api.listPurchaseOrders).toHaveBeenCalledWith(ORG);
  });

  it('calcule les indicateurs à partir des données du serveur', async () => {
    api.orders = [
      commande({ id: 'po-1', status: 'draft' }),
      commande({ id: 'po-2', status: 'sent' }),
      commande({ id: 'po-3', status: 'partially_received' }),
      commande({ id: 'po-4', status: 'received' }),
    ];

    const { result } = monter();

    await waitFor(() => {
      expect(result.current.orders).toHaveLength(4);
    });

    expect(result.current.metrics.totalOrders).toBe(4);
    expect(result.current.metrics.ordersDraft).toBe(1);
    expect(result.current.metrics.ordersPendingDelivery).toBe(2);
    expect(result.current.metrics.ordersCompleted).toBe(1);
    expect(result.current.metrics.activeSuppliersCount).toBe(1);
  });

  it("transmet l'organisation à la création d'un fournisseur puis relit le serveur", async () => {
    api.createSupplier.mockImplementation((_org: string, input: SupplierInput) => {
      const cree = fournisseur({ id: 'sup-2', name: input.name });
      api.suppliers = [...api.suppliers, cree];
      return Promise.resolve(cree);
    });

    const { result } = monter();
    await waitFor(() => expect(result.current.suppliers).toHaveLength(1));

    await act(async () => {
      await result.current.createSupplier(saisieFournisseur);
    });

    expect(api.createSupplier).toHaveBeenCalledWith(ORG, saisieFournisseur);
    await waitFor(() => expect(result.current.suppliers).toHaveLength(2));
  });

  it('met à jour un fournisseur par son identifiant, arguments aplatis', async () => {
    api.updateSupplier.mockResolvedValue(fournisseur({ name: 'Rexel — nouveau nom' }));

    const { result } = monter();
    await waitFor(() => expect(result.current.suppliers).toHaveLength(1));

    await act(async () => {
      await result.current.updateSupplier('sup-1', { name: 'Rexel — nouveau nom' });
    });

    expect(api.updateSupplier).toHaveBeenCalledWith('sup-1', { name: 'Rexel — nouveau nom' });
  });

  it('supprime un fournisseur et rafraîchit la liste', async () => {
    api.deleteSupplier.mockImplementation(() => {
      api.suppliers = [];
      return Promise.resolve();
    });

    const { result } = monter();
    await waitFor(() => expect(result.current.suppliers).toHaveLength(1));

    await act(async () => {
      await result.current.deleteSupplier('sup-1');
    });

    await waitFor(() => expect(result.current.suppliers).toHaveLength(0));
  });

  it('crée une commande et relit le serveur', async () => {
    api.createPurchaseOrder.mockImplementation(() => {
      const creee = commande({ id: 'po-2', reference: 'CMD-2026-002' });
      api.orders = [...api.orders, creee];
      return Promise.resolve(creee);
    });

    const { result } = monter();
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    await act(async () => {
      await result.current.createOrder(saisieCommande);
    });

    expect(api.createPurchaseOrder).toHaveBeenCalledWith(ORG, saisieCommande);
    await waitFor(() => expect(result.current.orders).toHaveLength(2));
  });

  it('accepte un changement de statut sans renvoyer les lignes', async () => {
    // C'est le geste « Envoyer la commande » : un patch d'un seul champ.
    api.updatePurchaseOrder.mockResolvedValue(commande({ status: 'sent' }));

    const { result } = monter();
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    await act(async () => {
      await result.current.updateOrder('po-1', { status: 'sent' });
    });

    expect(api.updatePurchaseOrder).toHaveBeenCalledWith('po-1', { status: 'sent' });
  });

  it('transmet le pointage de réception ligne par ligne', async () => {
    api.receivePurchaseOrder.mockImplementation(() => {
      api.orders = [
        commande({
          status: 'partially_received',
          items: [{ ...commande().items[0]!, quantityReceived: 40 }],
        }),
      ];
      return Promise.resolve(api.orders[0]!);
    });

    const { result } = monter();
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    await act(async () => {
      await result.current.receiveOrder('po-1', { 'item-1': 40 }, 'BL n°4471');
    });

    expect(api.receivePurchaseOrder).toHaveBeenCalledWith('po-1', { 'item-1': 40 }, 'BL n°4471');
    await waitFor(() => {
      expect(result.current.orders[0]?.status).toBe('partially_received');
      expect(result.current.orders[0]?.items[0]?.quantityReceived).toBe(40);
    });
  });

  it('invalide aussi le stock après une réception', async () => {
    // Réceptionner incrémente des quantités : ne rafraîchir que les achats
    // laisserait la page Stock afficher l'état d'avant la livraison.
    const invalider = vi.spyOn(queryClient, 'invalidateQueries');
    api.receivePurchaseOrder.mockResolvedValue(commande({ status: 'received' }));

    const { result } = monter();
    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    invalider.mockClear();

    await act(async () => {
      await result.current.receiveOrder('po-1', { 'item-1': 100 });
    });

    const cles = invalider.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
    expect(cles).toContain(JSON.stringify(['purchases']));
    expect(cles).toContain(JSON.stringify(['stock']));
  });

  it("remonte l'erreur du serveur au lieu d'afficher une liste vide", async () => {
    const panne = new Error('permission denied for table purchase_orders');
    api.listPurchaseOrders.mockRejectedValue(panne);

    const { result } = monter();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(panne);
    expect(result.current.orders).toEqual([]);
  });
});
