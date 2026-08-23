import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { memberDisplayName, useMembers } from '@/features/organizations';
import { qk } from '@/lib/query-keys';

import {
  addMaintenanceRecord as addMaintenanceRecordApi,
  createVehicle,
  deleteVehicle as deleteVehicleApi,
  listVehicles,
  updateVehicle as updateVehicleApi,
  type VehicleInput,
} from '../api/vehicles.api';
import type { Vehicle, VehicleMaintenanceRecord } from '../types';

/**
 * Le parc roulant d'une organisation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI A CHANGÉ, ET POURQUOI LA SURFACE EST RESTÉE LA MÊME
 *
 * Les véhicules vivaient dans `localStorage`, semés au premier accès avec une
 * flotte inventée. Ils sont désormais en base, cloisonnés par la RLS.
 *
 * Les noms rendus — `vehicles`, `addVehicle`, `updateVehicle`, `deleteVehicle`,
 * `addMaintenanceRecord` — sont ceux d'avant, délibérément : l'écran et ses
 * modales n'ont aucune raison de changer parce que le stockage a changé.
 *
 * Ce qui change en revanche, et que l'écran doit savoir : `isLoading` existe.
 * Une lecture réseau prend un instant là où `localStorage` répondait sur-le-champ.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useVehicles(organizationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...qk.vehicles.all, organizationId ?? 'none'],
    queryFn: () => (organizationId === null ? [] : listVehicles(organizationId)),
    enabled: organizationId !== null,
  });

  const rafraichir = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.vehicles.all });
  }, [queryClient]);

  const ajout = useMutation({
    mutationFn: (input: VehicleInput) => {
      if (organizationId === null) throw new Error('Aucune organisation sélectionnée.');
      return createVehicle(organizationId, input);
    },
    onSuccess: rafraichir,
  });

  const modification = useMutation({
    mutationFn: (params: { vehicleId: string; updates: Partial<VehicleInput> }) =>
      updateVehicleApi(params.vehicleId, params.updates),
    onSuccess: rafraichir,
  });

  const suppression = useMutation({
    mutationFn: (vehicleId: string) => deleteVehicleApi(vehicleId),
    onSuccess: rafraichir,
  });

  const entretien = useMutation({
    mutationFn: (params: {
      vehicleId: string;
      record: Omit<VehicleMaintenanceRecord, 'id'>;
      mileageActuel: number;
    }) => addMaintenanceRecordApi(params.vehicleId, params.record, params.mileageActuel),
    onSuccess: rafraichir,
  });

  const membersQuery = useMembers(organizationId);
  const members = membersQuery.data ?? [];

  // `useMemo` et non `?? []` directement : un tableau neuf à chaque rendu
  // change l'identité des dépendances de `addMaintenanceRecord`, qui se
  // recrée alors sans cesse et fait re-rendre les modales qui le reçoivent.
  const vehicles: Vehicle[] = useMemo(() => {
    const rawVehicles = query.data ?? [];
    if (members.length === 0) return rawVehicles;

    const membersMap = new Map(
      members.map((m) => [m.id, memberDisplayName(m)]),
    );

    return rawVehicles.map((v) => ({
      ...v,
      assignedMemberName: v.assignedMemberId
        ? (membersMap.get(v.assignedMemberId) ?? v.assignedMemberName ?? null)
        : null,
    }));
  }, [query.data, members]);

  const addVehicle = useCallback(
    (input: VehicleInput) => {
      ajout.mutate(input);
    },
    [ajout],
  );

  const updateVehicle = useCallback(
    (vehicleId: string, updates: Partial<VehicleInput>) => {
      modification.mutate({ vehicleId, updates });
    },
    [modification],
  );

  const deleteVehicle = useCallback(
    (vehicleId: string) => {
      suppression.mutate(vehicleId);
    },
    [suppression],
  );

  const addMaintenanceRecord = useCallback(
    (vehicleId: string, record: Omit<VehicleMaintenanceRecord, 'id'>) => {
      // Le compteur courant est lu ICI : l'API s'en sert pour ne relever le
      // kilométrage que si l'entretien l'a réellement dépassé.
      const actuel = vehicles.find((v) => v.id === vehicleId)?.mileage ?? 0;
      entretien.mutate({ vehicleId, record, mileageActuel: actuel });
    },
    [entretien, vehicles],
  );

  return {
    vehicles,
    isLoading: query.isPending && organizationId !== null,
    error: ajout.error ?? modification.error ?? suppression.error ?? entretien.error ?? query.error,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    addMaintenanceRecord,
  };
}
