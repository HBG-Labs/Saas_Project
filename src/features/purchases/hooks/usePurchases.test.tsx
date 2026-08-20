import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { loadConsumablesFromStorage } from '@/features/stock/api/stock.storage';

import { usePurchases } from './usePurchases';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('usePurchases', () => {
  const orgId = 'test-purchases-org';

  beforeEach(() => {
    localStorage.clear();
  });

  it('initialise avec des fournisseurs et commandes par défaut', async () => {
    const { result } = renderHook(() => usePurchases(orgId), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current.suppliers.length).toBeGreaterThan(0);
    expect(result.current.orders.length).toBeGreaterThan(0);
    expect(result.current.metrics.totalOrders).toBe(result.current.orders.length);
  });

  it('permet de créer un nouveau fournisseur', async () => {
    const { result } = renderHook(() => usePurchases(orgId), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createSupplier({
        name: 'Test Fournisseur Fibre',
        email: 'contact@testfibre.fr',
        phone: '01 99 88 77 66',
        city: 'Nantes',
        defaultPaymentTerms: '30 jours',
      });
    });

    expect(result.current.suppliers.some((s) => s.name === 'Test Fournisseur Fibre')).toBe(true);
  });

  it('permet de créer un bon de commande et de modifier son statut', async () => {
    const { result } = renderHook(() => usePurchases(orgId), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const supplier = result.current.suppliers[0];
    if (!supplier) throw new Error('Supplier needed');

    let orderId = '';
    await act(async () => {
      const order = await result.current.createOrder({
        supplierId: supplier.id,
        reference: 'CMD-TEST-999',
        orderDate: '2026-08-20',
        items: [
          {
            reference: 'FBR-CAB-4FO',
            description: 'Câble Fibre 4 FO',
            unit: 'm',
            quantityOrdered: 200,
            unitPriceEur: 0.5,
          },
        ],
      });
      orderId = order.id;
    });

    const created = result.current.orders.find((o) => o.id === orderId);
    expect(created).toBeDefined();
    expect(created?.subtotalEur).toBe(100);
    expect(created?.totalEur).toBe(120); // 100 + 20% TVA
    expect(created?.status).toBe('draft');

    // Passer en statut envoyé
    await act(async () => {
      await result.current.updateOrder(orderId, { status: 'sent' });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const updated = result.current.orders.find((o) => o.id === orderId);
    expect(updated?.status).toBe('sent');
  });

  it('synchronise automatiquement le stock lors de la réception d’une commande', async () => {
    const { result } = renderHook(() => usePurchases(orgId), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Charger le stock initial
    const initialConsumables = loadConsumablesFromStorage(orgId);
    const targetArticle = initialConsumables.find((c) => c.reference === 'FBR-CAB-4FO');
    const initialStockQty = targetArticle?.quantityInStock ?? 0;

    const supplier = result.current.suppliers[0];
    if (!supplier) throw new Error('Supplier needed');

    let orderId = '';
    let itemId = '';
    await act(async () => {
      const order = await result.current.createOrder({
        supplierId: supplier.id,
        reference: 'CMD-SYNC-STOCK',
        orderDate: '2026-08-20',
        items: [
          {
            consumableId: targetArticle?.id,
            reference: 'FBR-CAB-4FO',
            description: 'Câble Fibre 4 FO',
            unit: 'm',
            quantityOrdered: 150,
            unitPriceEur: 0.45,
          },
        ],
      });
      orderId = order.id;
      itemId = order.items[0]?.id ?? '';
    });

    // Réceptionner 150 unités
    await act(async () => {
      await result.current.receiveOrder(orderId, { [itemId]: 150 }, 'BL-12345');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Vérifier que la commande est maintenant reçue
    const updatedOrder = result.current.orders.find((o) => o.id === orderId);
    expect(updatedOrder?.status).toBe('received');
    expect(updatedOrder?.items[0]?.quantityReceived).toBe(150);

    // Vérifier que le stock a bien été augmenté de +150
    const updatedConsumables = loadConsumablesFromStorage(orgId);
    const updatedArticle = updatedConsumables.find((c) => c.reference === 'FBR-CAB-4FO');
    expect(updatedArticle?.quantityInStock).toBe(initialStockQty + 150);
  });
});
