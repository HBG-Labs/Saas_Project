import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { qk } from '@/lib/query-keys';

import {
  calculatePurchaseMetrics,
  createPurchaseOrderInStorage,
  createSupplierInStorage,
  deletePurchaseOrderInStorage,
  deleteSupplierInStorage,
  loadPurchaseOrdersFromStorage,
  loadSuppliersFromStorage,
  receivePurchaseOrderInStorage,
  reconcilePurchasesWithStock,
  updatePurchaseOrderInStorage,
  updateSupplierInStorage,
} from '../api/purchases.storage';
import type {
  PurchaseMetrics,
  PurchaseOrder,
  PurchaseOrderInput,
  Supplier,
  SupplierInput,
} from '../types/purchases.types';

export function usePurchases(organizationId: string | null) {
  const queryClient = useQueryClient();
  const orgId = organizationId ?? 'demo';

  // 1. Requête des fournisseurs
  const suppliersQuery = useQuery({
    queryKey: qk.purchases.suppliers(orgId),
    queryFn: () => loadSuppliersFromStorage(orgId),
    enabled: Boolean(organizationId),
  });

  // 2. Requête des commandes
  const ordersQuery = useQuery({
    queryKey: qk.purchases.orders(orgId),
    queryFn: () => {
      reconcilePurchasesWithStock(orgId);
      return loadPurchaseOrdersFromStorage(orgId);
    },
    enabled: Boolean(organizationId),
  });

  const refreshPurchases = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.purchases.all });
  }, [queryClient]);

  // Mutations Fournisseurs
  const createSupplierMutation = useMutation({
    mutationFn: async (input: SupplierInput) => createSupplierInStorage(orgId, input),
    onSuccess: refreshPurchases,
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SupplierInput> }) =>
      updateSupplierInStorage(orgId, id, patch),
    onSuccess: refreshPurchases,
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => deleteSupplierInStorage(orgId, id),
    onSuccess: refreshPurchases,
  });

  // Mutations Commandes
  const createOrderMutation = useMutation({
    mutationFn: async (input: PurchaseOrderInput) => createPurchaseOrderInStorage(orgId, input),
    onSuccess: async () => {
      await refreshPurchases();
      await queryClient.invalidateQueries({ queryKey: qk.stock.all });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PurchaseOrderInput> }) =>
      updatePurchaseOrderInStorage(orgId, id, patch),
    onSuccess: async () => {
      await refreshPurchases();
      await queryClient.invalidateQueries({ queryKey: qk.stock.all });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => deletePurchaseOrderInStorage(orgId, id),
    onSuccess: refreshPurchases,
  });

  // Réception de commande -> invalide aussi le cache de stock
  const receiveOrderMutation = useMutation({
    mutationFn: async ({
      id,
      receivedQuantities,
      deliveryNotes,
    }: {
      id: string;
      receivedQuantities: Record<string, number>;
      deliveryNotes?: string | undefined;
    }) => receivePurchaseOrderInStorage(orgId, id, receivedQuantities, deliveryNotes),
    onSuccess: async () => {
      await refreshPurchases();
      // Synchronisation directe avec le cache de stock
      await queryClient.invalidateQueries({ queryKey: qk.stock.all });
    },
  });

  const suppliers: Supplier[] = useMemo(
    () => suppliersQuery.data ?? [],
    [suppliersQuery.data],
  );

  const orders: PurchaseOrder[] = useMemo(
    () => ordersQuery.data ?? [],
    [ordersQuery.data],
  );

  const metrics: PurchaseMetrics = useMemo(
    () => calculatePurchaseMetrics(orders, suppliers),
    [orders, suppliers],
  );

  const createSupplier = useCallback(
    async (input: SupplierInput) => createSupplierMutation.mutateAsync(input),
    [createSupplierMutation],
  );

  const updateSupplier = useCallback(
    async (id: string, patch: Partial<SupplierInput>) =>
      updateSupplierMutation.mutateAsync({ id, patch }),
    [updateSupplierMutation],
  );

  const deleteSupplier = useCallback(
    async (id: string) => deleteSupplierMutation.mutateAsync(id),
    [deleteSupplierMutation],
  );

  const createOrder = useCallback(
    async (input: PurchaseOrderInput) => createOrderMutation.mutateAsync(input),
    [createOrderMutation],
  );

  const updateOrder = useCallback(
    async (id: string, patch: Partial<PurchaseOrderInput>) =>
      updateOrderMutation.mutateAsync({ id, patch }),
    [updateOrderMutation],
  );

  const deleteOrder = useCallback(
    async (id: string) => deleteOrderMutation.mutateAsync(id),
    [deleteOrderMutation],
  );

  const receiveOrder = useCallback(
    async (
      id: string,
      receivedQuantities: Record<string, number>,
      deliveryNotes?: string | undefined,
    ) => receiveOrderMutation.mutateAsync({ id, receivedQuantities, deliveryNotes }),
    [receiveOrderMutation],
  );

  return {
    suppliers,
    orders,
    metrics,
    isLoading: suppliersQuery.isLoading || ordersQuery.isLoading,
    isError: suppliersQuery.isError || ordersQuery.isError,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    createOrder,
    updateOrder,
    deleteOrder,
    receiveOrder,
    refreshPurchases,
  };
}
