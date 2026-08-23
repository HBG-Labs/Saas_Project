import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { qk } from '@/lib/query-keys';

import {
  calculatePurchaseMetrics,
  createPurchaseOrder,
  createSupplier as createSupplierInDb,
  deletePurchaseOrder,
  deleteSupplier as deleteSupplierInDb,
  listPurchaseOrders,
  listSuppliers,
  receivePurchaseOrder,
  updatePurchaseOrder,
  updateSupplier as updateSupplierInDb,
} from '../api/purchases.api';
import type {
  PurchaseMetrics,
  PurchaseOrder,
  PurchaseOrderInput,
  Supplier,
  SupplierInput,
} from '../types/purchases.types';

/**
 * Fournisseurs et bons de commande de l'organisation courante.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA SURFACE PUBLIQUE N'A PAS CHANGÉ
 *
 * Les douze clés retournées sont exactement celles d'avant, y compris la forme
 * APLATIE des arguments (`updateSupplier(id, patch)`, et non `({ id, patch })`) :
 * les deux pages et les huit composants du module n'ont pas eu à bouger. Seule
 * la source a changé — `localStorage` est devenu PostgreSQL. C'est la stratégie
 * déjà suivie pour le parc roulant puis pour le stock.
 *
 * Deux ajouts : `error`, qui porte l'échec réel jusqu'à l'interface, et
 * `isPending`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Le repli `organizationId ?? 'demo'` a disparu. Les requêtes étaient bien
 * gardées par `enabled`, mais PAS les mutations : sans organisation
 * sélectionnée, créer un fournisseur écrivait dans une organisation fantôme.
 *
 * `reconcilePurchasesWithStock()` n'est plus appelé dans les `queryFn` — une
 * requête n'a pas à écrire. La cohérence Achats↔Stock est désormais garantie
 * par la transaction de `receive_purchase_order`, et non plus rattrapée après
 * coup en cherchant la référence de commande dans le texte d'un motif.
 */
export function usePurchases(organizationId: string | null) {
  const queryClient = useQueryClient();
  const cacheKey = organizationId ?? 'none';

  const suppliersQuery = useQuery({
    queryKey: qk.purchases.suppliers(cacheKey),
    queryFn: () => (organizationId === null ? [] : listSuppliers(organizationId)),
    enabled: organizationId !== null,
  });

  const ordersQuery = useQuery({
    queryKey: qk.purchases.orders(cacheKey),
    queryFn: () => (organizationId === null ? [] : listPurchaseOrders(organizationId)),
    enabled: organizationId !== null,
  });

  const refreshPurchases = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.purchases.all });
  }, [queryClient]);

  /*
    Une commande touche AUSSI le stock : réceptionner incrémente les quantités et
    journalise un mouvement. Ne rafraîchir que les achats laisserait la page
    Stock afficher l'état d'avant la livraison.
  */
  const refreshPurchasesAndStock = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.purchases.all }),
      queryClient.invalidateQueries({ queryKey: qk.stock.all }),
    ]);
  }, [queryClient]);

  /** Les mutations exigent une organisation : sans elle, la policy refuserait. */
  const exigerOrganisation = useCallback((): string => {
    if (organizationId === null) {
      throw new Error('Aucune organisation sélectionnée.');
    }
    return organizationId;
  }, [organizationId]);

  const createSupplierMutation = useMutation({
    mutationFn: (input: SupplierInput) => createSupplierInDb(exigerOrganisation(), input),
    onSuccess: refreshPurchases,
  });

  const updateSupplierMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SupplierInput> }) =>
      updateSupplierInDb(id, patch),
    onSuccess: refreshPurchases,
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: (id: string) => deleteSupplierInDb(id),
    onSuccess: refreshPurchases,
  });

  const createOrderMutation = useMutation({
    mutationFn: (input: PurchaseOrderInput) => createPurchaseOrder(exigerOrganisation(), input),
    onSuccess: refreshPurchasesAndStock,
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PurchaseOrderInput> }) =>
      updatePurchaseOrder(id, patch),
    onSuccess: refreshPurchasesAndStock,
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id: string) => deletePurchaseOrder(id),
    onSuccess: refreshPurchasesAndStock,
  });

  const receiveOrderMutation = useMutation({
    mutationFn: ({
      id,
      receivedQuantities,
      deliveryNotes,
    }: {
      id: string;
      receivedQuantities: Record<string, number>;
      deliveryNotes?: string | undefined;
    }) => receivePurchaseOrder(id, receivedQuantities, deliveryNotes),
    onSuccess: refreshPurchasesAndStock,
  });

  /*
    `useMemo` sur `data ?? []` : un tableau neuf à chaque rendu ferait se recréer
    les `useCallback` qui en dépendent, et re-rendre les modales.
  */
  const suppliers: Supplier[] = useMemo(
    () => suppliersQuery.data ?? [],
    [suppliersQuery.data],
  );

  const orders: PurchaseOrder[] = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  /*
    L'instant de référence de la dépense « du mois », figé au montage.

    `Date.now()` appelé pendant le rendu est impur : deux rendus successifs
    donneraient deux fenêtres différentes, et l'indicateur changerait sans que
    les données aient bougé.
  */
  const [maintenant] = useState(() => Date.now());

  const metrics: PurchaseMetrics = useMemo(
    () => calculatePurchaseMetrics(orders, suppliers, maintenant),
    [maintenant, orders, suppliers],
  );

  const createSupplier = useCallback(
    (input: SupplierInput) => createSupplierMutation.mutateAsync(input),
    [createSupplierMutation],
  );

  const updateSupplier = useCallback(
    (id: string, patch: Partial<SupplierInput>) =>
      updateSupplierMutation.mutateAsync({ id, patch }),
    [updateSupplierMutation],
  );

  const deleteSupplier = useCallback(
    (id: string) => deleteSupplierMutation.mutateAsync(id),
    [deleteSupplierMutation],
  );

  const createOrder = useCallback(
    (input: PurchaseOrderInput) => createOrderMutation.mutateAsync(input),
    [createOrderMutation],
  );

  const updateOrder = useCallback(
    (id: string, patch: Partial<PurchaseOrderInput>) =>
      updateOrderMutation.mutateAsync({ id, patch }),
    [updateOrderMutation],
  );

  const deleteOrder = useCallback(
    (id: string) => deleteOrderMutation.mutateAsync(id),
    [deleteOrderMutation],
  );

  const receiveOrder = useCallback(
    (id: string, receivedQuantities: Record<string, number>, deliveryNotes?: string) =>
      receiveOrderMutation.mutateAsync({ id, receivedQuantities, deliveryNotes }),
    [receiveOrderMutation],
  );

  return {
    suppliers,
    orders,
    metrics,
    isLoading: suppliersQuery.isLoading || ordersQuery.isLoading,
    isPending: organizationId !== null && (suppliersQuery.isPending || ordersQuery.isPending),
    isError: suppliersQuery.isError || ordersQuery.isError,
    /* L'erreur réelle, remontée jusqu'à l'interface plutôt qu'avalée. */
    error:
      suppliersQuery.error ??
      ordersQuery.error ??
      createSupplierMutation.error ??
      updateSupplierMutation.error ??
      deleteSupplierMutation.error ??
      createOrderMutation.error ??
      updateOrderMutation.error ??
      deleteOrderMutation.error ??
      receiveOrderMutation.error,
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
