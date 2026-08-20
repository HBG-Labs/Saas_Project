import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { qk } from '@/lib/query-keys';

import {
  createConsumableInStorage,
  deleteConsumableInStorage,
  loadConsumablesFromStorage,
  loadMovementsFromStorage,
  recordMovementInStorage,
  updateConsumableInStorage,
} from '../api/stock.storage';
import { reconcilePurchasesWithStock } from '@/features/purchases/api/purchases.storage';
import type {
  ConsumableInput,
  StockConsumable,
  StockMetrics,
  StockMovement,
  StockMovementInput,
} from '../types/stock.types';

export function useStock(organizationId: string | null) {
  const queryClient = useQueryClient();
  const orgId = organizationId ?? 'demo';

  // 1. Requête des consommables
  const consumablesQuery = useQuery({
    queryKey: qk.stock.consumables(orgId),
    queryFn: () => {
      reconcilePurchasesWithStock(orgId);
      return loadConsumablesFromStorage(orgId);
    },
    enabled: Boolean(organizationId),
  });

  // 2. Requête des mouvements
  const movementsQuery = useQuery({
    queryKey: qk.stock.movements(orgId),
    queryFn: () => {
      reconcilePurchasesWithStock(orgId);
      return loadMovementsFromStorage(orgId);
    },
    enabled: Boolean(organizationId),
  });

  const refreshAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.stock.all });
  }, [queryClient]);

  // Mutations
  const createConsumableMutation = useMutation({
    mutationFn: async (input: ConsumableInput) => {
      return createConsumableInStorage(orgId, input);
    },
    onSuccess: refreshAll,
  });

  const updateConsumableMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ConsumableInput> }) => {
      return updateConsumableInStorage(orgId, id, patch);
    },
    onSuccess: refreshAll,
  });

  const deleteConsumableMutation = useMutation({
    mutationFn: async (id: string) => {
      deleteConsumableInStorage(orgId, id);
    },
    onSuccess: refreshAll,
  });

  const recordMovementMutation = useMutation({
    mutationFn: async (input: StockMovementInput) => {
      return recordMovementInStorage(orgId, input);
    },
    onSuccess: refreshAll,
  });

  const consumables: StockConsumable[] = useMemo(
    () => consumablesQuery.data ?? [],
    [consumablesQuery.data],
  );

  const movements: StockMovement[] = useMemo(
    () => movementsQuery.data ?? [],
    [movementsQuery.data],
  );

  // Calcul des métriques & alertes
  const lowStockArticles = useMemo(
    () => consumables.filter((c) => c.quantityInStock <= c.minThreshold),
    [consumables],
  );

  const metrics: StockMetrics = useMemo(() => {
    const totalArticles = consumables.length;
    const totalQuantity = consumables.reduce((acc, c) => acc + c.quantityInStock, 0);
    const totalValueEur = consumables.reduce(
      (acc, c) => acc + c.quantityInStock * (c.unitPriceEur ?? 0),
      0,
    );
    const lowStockCount = lowStockArticles.length;

    // Mouvements sur les 30 derniers jours
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;
    const movementsCountMonth = movements.filter(
      (m) => new Date(m.date).getTime() >= thirtyDaysAgo,
    ).length;

    return {
      totalArticles,
      totalQuantity,
      totalValueEur,
      lowStockCount,
      movementsCountMonth,
    };
  }, [consumables, lowStockArticles, movements]);

  const addConsumable = useCallback(
    async (input: ConsumableInput) => {
      return createConsumableMutation.mutateAsync(input);
    },
    [createConsumableMutation],
  );

  const updateConsumable = useCallback(
    async (id: string, patch: Partial<ConsumableInput>) => {
      return updateConsumableMutation.mutateAsync({ id, patch });
    },
    [updateConsumableMutation],
  );

  const deleteConsumable = useCallback(
    async (id: string) => {
      return deleteConsumableMutation.mutateAsync(id);
    },
    [deleteConsumableMutation],
  );

  const recordMovement = useCallback(
    async (input: StockMovementInput) => {
      return recordMovementMutation.mutateAsync(input);
    },
    [recordMovementMutation],
  );

  const quickAdjust = useCallback(
    async (consumableId: string, delta: number, reason?: string) => {
      const consumable = consumables.find((c) => c.id === consumableId);
      if (!consumable) return;

      const type = delta >= 0 ? 'in' : 'out';
      const absQty = Math.abs(delta);

      return recordMovementMutation.mutateAsync({
        consumableId,
        type,
        quantity: absQty,
        reason: reason || (delta >= 0 ? 'Réapprovisionnement rapide' : 'Consommation rapide'),
      });
    },
    [consumables, recordMovementMutation],
  );

  return {
    consumables,
    movements,
    lowStockArticles,
    metrics,
    isLoading: consumablesQuery.isLoading || movementsQuery.isLoading,
    isError: consumablesQuery.isError || movementsQuery.isError,
    addConsumable,
    updateConsumable,
    deleteConsumable,
    recordMovement,
    quickAdjust,
    refreshAll,
  };
}
