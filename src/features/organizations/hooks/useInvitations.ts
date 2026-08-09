import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { OrgRole } from '@/types/database';

import {
  acceptInvitation,
  getInvitationPreview,
  inviteMember,
  listInvitations,
  revokeInvitation,
} from '../api/organizations.api';

import { useCurrentOrganization } from './useCurrentOrganization';

export function useInvitations(organizationId: string | null) {
  return useQuery({
    queryKey: qk.organizations.invitations(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listInvitations(organizationId)),
    enabled: organizationId !== null,
  });
}

export function useInviteMember(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { email: string; role: OrgRole }) =>
      inviteMember({ organizationId, email: input.email, role: input.role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.organizations.invitations(organizationId),
      });
    },
  });
}

export function useRevokeInvitation(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.organizations.invitations(organizationId),
      });
    },
  });
}

/**
 * Aperçu d'une invitation avant acceptation.
 *
 * `retry: false` : un jeton invalide le restera. Réessayer trois fois ne ferait
 * qu'allonger l'attente avant d'afficher le message qui explique la situation.
 */
export function useInvitationPreview(token: string | undefined) {
  return useQuery({
    queryKey: qk.organizations.invitationPreview(token ?? 'none'),
    queryFn: () => (token === undefined ? null : getInvitationPreview(token)),
    enabled: token !== undefined,
    retry: false,
  });
}

/**
 * Accepte une invitation et bascule sur l'organisation rejointe.
 *
 * L'ordre compte : on sélectionne AVANT d'invalider, puis on attend le
 * rechargement de la liste. L'inverse afficherait brièvement l'écran « aucune
 * entreprise » à quelqu'un qui vient précisément d'en rejoindre une.
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const { select } = useCurrentOrganization();

  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: async (organizationId) => {
      select(organizationId);
      await queryClient.invalidateQueries({ queryKey: qk.organizations.all });
    },
  });
}
