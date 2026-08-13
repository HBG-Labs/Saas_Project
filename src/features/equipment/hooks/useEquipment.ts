import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { TablesUpdate } from '@/types/database';

import {
  createEquipment,
  deleteEquipment,
  listEquipment,
  updateEquipment,
  type EquipmentFilters,
  type EquipmentInput,
} from '../api/equipment.api';

export function useEquipmentList(organizationId: string | null, filters: EquipmentFilters = {}) {
  return useQuery({
    queryKey: qk.equipment.list(organizationId ?? 'none', filters),
    queryFn: () => (organizationId === null ? [] : listEquipment(organizationId, filters)),
    enabled: organizationId !== null,
  });
}

/**
 * Les trois mutations invalident la racine `equipment`.
 *
 * Invalider la seule liste courante laisserait les autres jeux de filtres
 * périmés en cache : l'appareil qu'on vient de passer en révision resterait
 * « disponible » dès qu'on change de filtre.
 */
export function useCreateEquipment(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<EquipmentInput, 'organizationId'>) =>
      createEquipment({ ...input, organizationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.equipment.all });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TablesUpdate<'equipment'> }) =>
      updateEquipment(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.equipment.all });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (equipmentId: string) => deleteEquipment(equipmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.equipment.all });
    },
  });
}
