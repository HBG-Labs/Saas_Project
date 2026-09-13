import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FEATURES, useOrganizationEntitlements } from '@/features/billing';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { qk } from '@/lib/query-keys';
import type { TablesUpdate } from '@/types/database';

import {
  closeConversation,
  countUnreadForStaff,
  getPortalSettings,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
  setAttachmentsShared,
  setContactPortalAccess,
  setDocumentShared,
  upsertPortalSettings,
  type SendMessageInput,
} from '../api/client-portal.api';

/**
 * Ce que l'interface a le droit de MONTRER pour le portail client.
 *
 * Trois questions, jamais une seule : la formule inclut-elle le portail, le
 * portail est-il activé pour cette entreprise, et cette personne a-t-elle la
 * permission. Le serveur les repose toutes à chaque écriture ; ici elles ne
 * servent qu'à ne pas afficher une commande qui serait refusée.
 */
export function useClientPortalAccess() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { has, isLoading } = useOrganizationEntitlements(organizationId);
  const { can } = usePermission();
  const hasFeature = has(FEATURES.clientPortal);
  const settings = useQuery({
    queryKey: qk.clientPortal.settings(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? null : getPortalSettings(organizationId)),
    enabled: organizationId !== null && hasFeature,
    staleTime: 60_000,
  });

  return {
    organizationId,
    hasFeature,
    isEnabled: hasFeature && settings.data?.enabled === true,
    settings,
    isLoading: isLoading || (hasFeature && settings.isPending),
    canView: hasFeature && can(PERMISSIONS.clientPortalView),
    canSend: hasFeature && can(PERMISSIONS.clientMessageSend),
    canShare: hasFeature && can(PERMISSIONS.clientContentShare),
    canManage: hasFeature && can(PERMISSIONS.clientPortalManage),
  };
}

export function useUpdatePortalSettings(organizationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: TablesUpdate<'client_portal_settings'>) => {
      if (organizationId === null) throw new Error('Aucune organisation active.');
      return upsertPortalSettings(organizationId, patch);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.clientPortal.all });
    },
  });
}

export function useSetContactPortalAccess(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, enabled }: { contactId: string; enabled: boolean }) =>
      setContactPortalAccess(contactId, enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.customers.contacts(customerId) });
    },
  });
}

export function useShareAttachments(interventionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, shared }: { ids: string[]; shared: boolean }) => setAttachmentsShared(ids, shared),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.interventions.attachments(interventionId) });
    },
  });
}

export function useShareDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, shared }: { documentId: string; shared: boolean }) =>
      setDocumentShared(documentId, shared),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.documents.all });
    },
  });
}

export function useClientConversations(organizationId: string | null, customerId?: string, enabled = true) {
  return useQuery({
    queryKey: qk.clientPortal.conversations(organizationId ?? 'none', customerId),
    queryFn: () => (organizationId === null ? [] : listConversations(organizationId, customerId)),
    enabled: organizationId !== null && enabled,
  });
}

export function useClientMessages(conversationId: string | null) {
  return useQuery({
    queryKey: qk.clientPortal.messages(conversationId ?? 'none'),
    queryFn: () => (conversationId === null ? [] : listMessages(conversationId)),
    enabled: conversationId !== null,
    // Une réponse peut arriver pendant que l'écran est ouvert.
    refetchInterval: 30_000,
  });
}

export function useUnreadClientMessages(organizationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: qk.clientPortal.unread(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? 0 : countUnreadForStaff(organizationId)),
    enabled: organizationId !== null && enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useSendClientMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMessageInput) => sendMessage(input),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.clientPortal.messages(result.conversationId) }),
        queryClient.invalidateQueries({ queryKey: qk.clientPortal.all, exact: false }),
      ]);
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.clientPortal.all });
    },
  });
}

export function useCloseConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, closed }: { conversationId: string; closed: boolean }) =>
      closeConversation(conversationId, closed),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.clientPortal.all });
    },
  });
}
