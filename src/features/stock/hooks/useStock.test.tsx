import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useStock } from './useStock';

describe('useStock hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('charge les consommables par défaut et calcule les métriques', async () => {
    const { result } = renderHook(() => useStock('org-test-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.consumables.length).toBeGreaterThan(0);
    });

    expect(result.current.metrics.totalArticles).toBe(result.current.consumables.length);
    expect(result.current.metrics.totalQuantity).toBeGreaterThan(0);
  });

  it('permet d’ajouter un nouvel article de stock', async () => {
    const { result } = renderHook(() => useStock('org-test-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.consumables.length).toBeGreaterThan(0);
    });

    const initialCount = result.current.consumables.length;

    await act(async () => {
      await result.current.addConsumable({
        reference: 'TEST-SKU-99',
        name: 'Test Câble 100m',
        category: 'Câblage & Fibre',
        unit: 'm',
        quantityInStock: 100,
        minThreshold: 20,
        unitPriceEur: 10,
        sellingPriceEur: 20,
        location: 'Dépôt Test',
      });
    });

    await waitFor(() => {
      expect(result.current.consumables.length).toBe(initialCount + 1);
    });

    const added = result.current.consumables.find((c) => c.reference === 'TEST-SKU-99');
    expect(added).toBeDefined();
    expect(added?.name).toBe('Test Câble 100m');
    expect(added?.quantityInStock).toBe(100);
  });

  it('enregistre un mouvement d’entrée et augmente le stock', async () => {
    const { result } = renderHook(() => useStock('org-test-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.consumables.length).toBeGreaterThan(0);
    });

    const target = result.current.consumables[0];
    if (!target) throw new Error('Target consumable missing');

    const initialQty = target.quantityInStock;

    await act(async () => {
      await result.current.recordMovement({
        consumableId: target.id,
        type: 'in',
        quantity: 50,
        reason: 'Livraison BL-1234',
      });
    });

    await waitFor(() => {
      const updated = result.current.consumables.find((c) => c.id === target.id);
      expect(updated?.quantityInStock).toBe(initialQty + 50);
    });

    expect(result.current.movements.some((m) => m.reason === 'Livraison BL-1234')).toBe(true);
  });

  it('enregistre un mouvement de sortie et diminue le stock', async () => {
    const { result } = renderHook(() => useStock('org-test-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.consumables.length).toBeGreaterThan(0);
    });

    const target = result.current.consumables[0];
    if (!target) throw new Error('Target consumable missing');

    const initialQty = target.quantityInStock;

    await act(async () => {
      await result.current.recordMovement({
        consumableId: target.id,
        type: 'out',
        quantity: 5,
        reason: 'Consommation chantier Dupont',
        technicianName: 'Thomas',
        interventionRef: 'INT-999',
      });
    });

    await waitFor(() => {
      const updated = result.current.consumables.find((c) => c.id === target.id);
      expect(updated?.quantityInStock).toBe(Math.max(0, initialQty - 5));
    });
  });

  it('ajuste rapidement le stock avec quickAdjust', async () => {
    const { result } = renderHook(() => useStock('org-test-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.consumables.length).toBeGreaterThan(0);
    });

    const target = result.current.consumables[0];
    if (!target) throw new Error('Target consumable missing');

    const initialQty = target.quantityInStock;

    await act(async () => {
      await result.current.quickAdjust(target.id, 1, 'Ajout rapide');
    });

    await waitFor(() => {
      const updated = result.current.consumables.find((c) => c.id === target.id);
      expect(updated?.quantityInStock).toBe(initialQty + 1);
    });
  });

  it('supprime un article de stock', async () => {
    const { result } = renderHook(() => useStock('org-test-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.consumables.length).toBeGreaterThan(0);
    });

    const target = result.current.consumables[0];
    if (!target) throw new Error('Target consumable missing');

    const countBefore = result.current.consumables.length;

    await act(async () => {
      await result.current.deleteConsumable(target.id);
    });

    await waitFor(() => {
      expect(result.current.consumables.length).toBe(countBefore - 1);
      expect(result.current.consumables.find((c) => c.id === target.id)).toBeUndefined();
    });
  });
});
