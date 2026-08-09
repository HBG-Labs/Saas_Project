import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { TablesUpdate } from '@/types/database';

import {
  archiveCustomer,
  createCustomer,
  getCustomer,
  listCustomerMissions,
  listCustomers,
  restoreCustomer,
  updateCustomer,
  type CustomerFilters,
} from '../api/customers.api';

export function useCustomers(organizationId: string | null, filters: CustomerFilters = {}) {
  return useQuery({
    queryKey: qk.customers.list(organizationId ?? 'none', filters),
    queryFn: () => (organizationId === null ? [] : listCustomers(organizationId, filters)),
    enabled: organizationId !== null,
  });
}

export function useCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: qk.customers.detail(customerId ?? 'none'),
    queryFn: () => (customerId === undefined ? null : getCustomer(customerId)),
    enabled: customerId !== undefined,
  });
}

/**
 * Missions du client.
 *
 * `staleTime` court : c'est l'écran qu'on ouvre avant d'appeler un client, et
 * une intervention terminée il y a dix minutes doit y figurer.
 */
export function useCustomerHistory(customerId: string | undefined) {
  return useQuery({
    queryKey: qk.customers.history(customerId ?? 'none'),
    queryFn: () => (customerId === undefined ? [] : listCustomerMissions(customerId)),
    enabled: customerId !== undefined,
    staleTime: 30_000,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomer,
    onSuccess: async () => {
      // Toutes les listes sont invalidées, filtres compris : la nouvelle fiche
      // peut apparaître ou non selon la recherche en cours, et deviner laquelle
      // coûterait plus cher que de tout relire.
      await queryClient.invalidateQueries({ queryKey: qk.customers.all });
    },
  });
}

export function useUpdateCustomer(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: TablesUpdate<'customers'>) => updateCustomer(customerId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.customers.all });
    },
  });
}

export function useArchiveCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveCustomer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.customers.all });
    },
  });
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreCustomer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.customers.all });
    },
  });
}
