import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';

import {
  countUnreadForClient,
  getPortalContext,
  getPortalFileUrl,
  getPortalMission,
  getPortalQuote,
  listPortalConversations,
  listPortalDocuments,
  listPortalInvoices,
  listPortalMessages,
  listPortalMissions,
  listPortalQuotes,
  markConversationReadByClient,
  respondPortalQuote,
  sendPortalMessage,
  touchLastSeen,
  type PortalBucket,
  type PortalSendInput,
} from '../api/portal.api';

/** Racine des clés : tout le portail se purge d'un coup à la déconnexion. */
const ROOT = ['portal'] as const;

export const portalKeys = {
  all: ROOT,
  context: () => [...ROOT, 'context'] as const,
  missions: () => [...ROOT, 'missions'] as const,
  mission: (id: string) => [...ROOT, 'mission', id] as const,
  quotes: () => [...ROOT, 'quotes'] as const,
  quote: (id: string) => [...ROOT, 'quote', id] as const,
  invoices: () => [...ROOT, 'invoices'] as const,
  documents: () => [...ROOT, 'documents'] as const,
  conversations: () => [...ROOT, 'conversations'] as const,
  messages: (id: string) => [...ROOT, 'messages', id] as const,
  unread: () => [...ROOT, 'unread'] as const,
};

/**
 * Identité portail de la session courante. `null` : la session existe mais
 * n'est le contact d'aucun portail actif — révoqué, désactivé, formule sans
 * le module, ou simplement un membre d'entreprise égaré ici.
 */
export function usePortalContext() {
  const { status } = useAuth();
  return useQuery({
    queryKey: portalKeys.context(),
    queryFn: getPortalContext,
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function usePortalMissions() {
  return useQuery({ queryKey: portalKeys.missions(), queryFn: listPortalMissions });
}

export function usePortalMission(missionId: string | undefined) {
  return useQuery({
    queryKey: portalKeys.mission(missionId ?? 'none'),
    queryFn: () => (missionId === undefined ? null : getPortalMission(missionId)),
    enabled: missionId !== undefined,
  });
}

export function usePortalQuotes() {
  return useQuery({ queryKey: portalKeys.quotes(), queryFn: listPortalQuotes });
}

export function usePortalQuote(quoteId: string | undefined) {
  return useQuery({
    queryKey: portalKeys.quote(quoteId ?? 'none'),
    queryFn: () => (quoteId === undefined ? null : getPortalQuote(quoteId)),
    enabled: quoteId !== undefined,
  });
}

export function useRespondPortalQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, decision }: { quoteId: string; decision: 'accepted' | 'refused' }) =>
      respondPortalQuote(quoteId, decision),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: portalKeys.all });
    },
  });
}

export function usePortalInvoices() {
  return useQuery({ queryKey: portalKeys.invoices(), queryFn: listPortalInvoices });
}

export function usePortalDocuments() {
  return useQuery({ queryKey: portalKeys.documents(), queryFn: listPortalDocuments });
}

export function usePortalConversations() {
  return useQuery({ queryKey: portalKeys.conversations(), queryFn: listPortalConversations });
}

export function usePortalMessages(conversationId: string | null) {
  return useQuery({
    queryKey: portalKeys.messages(conversationId ?? 'none'),
    queryFn: () => (conversationId === null ? [] : listPortalMessages(conversationId)),
    enabled: conversationId !== null,
    refetchInterval: 30_000,
  });
}

export function usePortalUnread() {
  return useQuery({ queryKey: portalKeys.unread(), queryFn: countUnreadForClient, refetchInterval: 60_000 });
}

export function useTouchLastSeen() {
  return useMutation({ mutationFn: touchLastSeen });
}

export function usePortalFileUrl() {
  return useMutation({
    mutationFn: ({ bucket, path }: { bucket: PortalBucket; path: string }) => getPortalFileUrl(bucket, path),
  });
}

export function useSendPortalMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PortalSendInput) => sendPortalMessage(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: portalKeys.all });
    },
  });
}

export function useMarkReadByClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => markConversationReadByClient(conversationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: portalKeys.all });
    },
  });
}
