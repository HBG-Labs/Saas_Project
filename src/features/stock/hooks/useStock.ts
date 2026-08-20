import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { qk } from '@/lib/query-keys';

import {
  createConsumable as createConsumableInDb,
  deleteConsumable as deleteConsumableInDb,
  listConsumables,
  listMovements,
  recordMovement as recordMovementInDb,
  updateConsumable as updateConsumableInDb,
} from '../api/stock.api';
import type {
  ConsumableInput,
  StockConsumable,
  StockMetrics,
  StockMovement,
  StockMovementInput,
} from '../types/stock.types';

/**
 * Le stock de l'organisation courante.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA SURFACE PUBLIQUE N'A PAS CHANGÉ
 *
 * `consumables`, `movements`, `lowStockArticles`, `metrics`, `addConsumable`,
 * `updateConsumable`, `deleteConsumable`, `recordMovement`, `quickAdjust` et
 * `refreshAll` sont exactement ceux d'avant : les huit composants du module et
 * la page Parc Matériel n'ont pas eu à bouger. Seule la source a changé —
 * `localStorage` est devenu PostgreSQL. C'est la stratégie déjà suivie pour la
 * migration du parc roulant.
 *
 * Deux ajouts seulement : `error`, qui porte l'échec réel jusqu'à l'interface,
 * et `isPending`, distinct de `isLoading`.
 *
 * ⚠️ `reconcilePurchasesWithStock()` n'est plus appelé ici. Cette fonction
 * appartient au module Achats, resté sur `localStorage` : elle écrivait dans un
 * stock local que cette page ne lit plus. Tant que les Achats ne sont pas
 * migrés à leur tour, la réception d'une commande n'alimente donc PAS le stock.
 * Une `queryFn` n'avait de toute façon pas à écrire.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Le cloisonnement est appliqué par les policies, pas ici. `organizationId`
 * sert à cadrer la requête et la clé de cache ; il n'y a plus de repli sur une
 * organisation « demo », qui faisait écrire les mutations dans un stock fantôme
 * lorsque aucune organisation n'était sélectionnée.
 */
export function useStock(organizationId: string | null) {
  const queryClient = useQueryClient();
  const cacheKey = organizationId ?? 'none';

  const consumablesQuery = useQuery({
    queryKey: qk.stock.consumables(cacheKey),
    queryFn: () => (organizationId === null ? [] : listConsumables(organizationId)),
    enabled: organizationId !== null,
  });

  const movementsQuery = useQuery({
    queryKey: qk.stock.movements(cacheKey),
    queryFn: () => (organizationId === null ? [] : listMovements(organizationId)),
    enabled: organizationId !== null,
  });

  /*
    Invalidation à la RACINE du domaine, pas sur la clé exacte.

    Un mouvement change à la fois le journal ET la quantité de l'article : ne
    rafraîchir que `movements` laisserait la table des consommables afficher
    l'ancien stock.
  */
  const refreshAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.stock.all });
  }, [queryClient]);

  /** Les mutations exigent une organisation : sans elle, la policy refuserait. */
  const exigerOrganisation = useCallback((): string => {
    if (organizationId === null) {
      throw new Error('Aucune organisation sélectionnée.');
    }
    return organizationId;
  }, [organizationId]);

  const createConsumableMutation = useMutation({
    mutationFn: (input: ConsumableInput) => createConsumableInDb(exigerOrganisation(), input),
    onSuccess: refreshAll,
  });

  const updateConsumableMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ConsumableInput> }) =>
      updateConsumableInDb(id, patch),
    onSuccess: refreshAll,
  });

  const deleteConsumableMutation = useMutation({
    mutationFn: (id: string) => deleteConsumableInDb(id),
    onSuccess: refreshAll,
  });

  const recordMovementMutation = useMutation({
    mutationFn: (input: StockMovementInput) => recordMovementInDb(input),
    onSuccess: refreshAll,
  });

  /*
    `useMemo` sur `data ?? []` : un tableau neuf à chaque rendu ferait se
    recréer les `useCallback` qui en dépendent, et re-rendre les modales.
  */
  const consumables: StockConsumable[] = useMemo(
    () => consumablesQuery.data ?? [],
    [consumablesQuery.data],
  );

  const movements: StockMovement[] = useMemo(
    () => movementsQuery.data ?? [],
    [movementsQuery.data],
  );

  /*
    L'instant de référence des « mouvements du mois », figé au montage.

    `Date.now()` appelé pendant le rendu est impur : deux rendus successifs
    donneraient deux fenêtres différentes, et l'indicateur changerait sans que
    les données aient bougé. Le figer suffit — la fenêtre se recalcule à la
    prochaine navigation, ce qui est la granularité attendue d'un KPI.
  */
  const [depuis] = useState(() => Date.now() - 30 * 24 * 3600 * 1000);

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

    const movementsCountMonth = movements.filter(
      (m) => new Date(m.date).getTime() >= depuis,
    ).length;

    return {
      totalArticles,
      totalQuantity,
      totalValueEur,
      lowStockCount: lowStockArticles.length,
      movementsCountMonth,
    };
  }, [consumables, depuis, lowStockArticles, movements]);

  const addConsumable = useCallback(
    (input: ConsumableInput) => createConsumableMutation.mutateAsync(input),
    [createConsumableMutation],
  );

  const updateConsumable = useCallback(
    (id: string, patch: Partial<ConsumableInput>) =>
      updateConsumableMutation.mutateAsync({ id, patch }),
    [updateConsumableMutation],
  );

  const deleteConsumable = useCallback(
    (id: string) => deleteConsumableMutation.mutateAsync(id),
    [deleteConsumableMutation],
  );

  const recordMovement = useCallback(
    (input: StockMovementInput) => recordMovementMutation.mutateAsync(input),
    [recordMovementMutation],
  );

  /*
    Ajustement rapide depuis la table : un delta signé devient un mouvement
    d'entrée ou de sortie. La nouvelle quantité est calculée par la base, pas
    ici — deux techniciens servant le même article au même instant liraient
    sinon la même quantité de départ, et une des deux sorties serait perdue.
  */
  const quickAdjust = useCallback(
    async (consumableId: string, delta: number, reason?: string) => {
      if (delta === 0) return;

      return recordMovementMutation.mutateAsync({
        consumableId,
        type: delta > 0 ? 'in' : 'out',
        quantity: Math.abs(delta),
        reason: reason || (delta > 0 ? 'Réapprovisionnement rapide' : 'Consommation rapide'),
      });
    },
    [recordMovementMutation],
  );

  return {
    consumables,
    movements,
    lowStockArticles,
    metrics,
    isLoading: consumablesQuery.isLoading || movementsQuery.isLoading,
    isPending:
      organizationId !== null && (consumablesQuery.isPending || movementsQuery.isPending),
    isError: consumablesQuery.isError || movementsQuery.isError,
    /* L'erreur réelle, remontée jusqu'à l'interface plutôt qu'avalée. */
    error:
      consumablesQuery.error ??
      movementsQuery.error ??
      createConsumableMutation.error ??
      updateConsumableMutation.error ??
      deleteConsumableMutation.error ??
      recordMovementMutation.error,
    addConsumable,
    updateConsumable,
    deleteConsumable,
    recordMovement,
    quickAdjust,
    refreshAll,
  };
}
