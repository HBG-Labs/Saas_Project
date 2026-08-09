import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { TablesUpdate } from '@/types/database';

import {
  createOrganization,
  getOrganization,
  listMyOrganizations,
  updateOrganization,
} from '../api/organizations.api';

import { useCurrentOrganization } from './useCurrentOrganization';

/**
 * Organisations dont l'utilisateur est membre actif.
 *
 * Une liste vide n'est PAS une erreur : c'est la réponse légitime pour qui
 * n'appartient encore à aucune entreprise. Les pages doivent la traiter comme
 * un état, pas comme une panne.
 */
export function useMyOrganizations() {
  return useQuery({
    queryKey: qk.organizations.mine(),
    queryFn: listMyOrganizations,
  });
}

export function useOrganization(organizationId: string | null) {
  return useQuery({
    queryKey: qk.organizations.detail(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? null : getOrganization(organizationId)),
    enabled: organizationId !== null,
  });
}

/**
 * Crée une organisation et bascule dessus.
 *
 * La sélection fait partie de la mutation, pas de l'écran appelant : créer une
 * entreprise pour rester dans la précédente n'a aucun sens, et laisser chaque
 * page y penser garantit qu'un jour l'une l'oubliera.
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { select } = useCurrentOrganization();

  return useMutation({
    mutationFn: createOrganization,
    onSuccess: async (organization) => {
      select(organization.id);
      // `await` : sans lui, la redirection qui suit afficherait la nouvelle
      // organisation avant que sa liste ne soit rechargée — donc un écran
      // « aucune entreprise » pendant un instant.
      await queryClient.invalidateQueries({ queryKey: qk.organizations.mine() });
    },
  });
}

export function useUpdateOrganization(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: TablesUpdate<'organizations'>) => updateOrganization(organizationId, patch),
    onSuccess: async () => {
      // La liste porte le nom affiché par le sélecteur : les deux clés doivent
      // être invalidées, sans quoi l'en-tête garderait l'ancien nom.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.organizations.detail(organizationId) }),
        queryClient.invalidateQueries({ queryKey: qk.organizations.mine() }),
      ]);
    },
  });
}
