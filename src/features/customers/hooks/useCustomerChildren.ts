import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { TablesUpdate } from '@/types/database';

import {
  archiveSite,
  createContact,
  createSite,
  deleteContact,
  listContacts,
  listOrganizationSites,
  listSites,
  setPrimaryContact,
  updateContact,
  updateSite,
} from '../api/customers.api';

// -----------------------------------------------------------------------------
// Contacts
// -----------------------------------------------------------------------------

export function useCustomerContacts(customerId: string | undefined) {
  return useQuery({
    queryKey: qk.customers.contacts(customerId ?? 'none'),
    queryFn: () => (customerId === undefined ? [] : listContacts(customerId)),
    enabled: customerId !== undefined,
  });
}

export function useCreateContact(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createContact,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.customers.contacts(customerId) });
    },
  });
}

export function useUpdateContact(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contactId, patch }: { contactId: string; patch: TablesUpdate<'customer_contacts'> }) =>
      updateContact(contactId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.customers.contacts(customerId) });
    },
  });
}

export function useDeleteContact(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteContact,
    onSuccess: async () => {
      // Les sites référencent le contact en `on delete set null` : leur affichage
      // change aussi, d'où la seconde invalidation.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.customers.contacts(customerId) }),
        queryClient.invalidateQueries({ queryKey: qk.customers.sites(customerId) }),
      ]);
    },
  });
}

export function useSetPrimaryContact(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactId: string) => setPrimaryContact(customerId, contactId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.customers.contacts(customerId) });
    },
  });
}

// -----------------------------------------------------------------------------
// Sites
// -----------------------------------------------------------------------------

export function useCustomerSites(customerId: string | undefined) {
  return useQuery({
    queryKey: qk.customers.sites(customerId ?? 'none'),
    queryFn: () => (customerId === undefined ? [] : listSites(customerId)),
    enabled: customerId !== undefined,
  });
}

export function useOrganizationSites(organizationId: string | null) {
  return useQuery({
    queryKey: qk.customers.organizationSites(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listOrganizationSites(organizationId)),
    enabled: organizationId !== null,
  });
}

/**
 * Invalide TOUT le domaine et non les seuls sites du client : un nouveau site
 * apparaît aussi dans `organizationSites`, qui alimente le sélecteur du
 * formulaire de mission. Cibler finement laisserait ce sélecteur périmé, sans
 * qu'aucune erreur ne le signale.
 */
export function useCreateSite(_customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.customers.all });
    },
  });
}

export function useUpdateSite(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ siteId, patch }: { siteId: string; patch: TablesUpdate<'sites'> }) =>
      updateSite(siteId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.customers.sites(customerId) });
    },
  });
}

export function useArchiveSite(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveSite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.customers.sites(customerId) });
    },
  });
}
