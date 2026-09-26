import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import {
  disconnectInstagram,
  getInstagramAccount,
  getInstagramReadiness,
  startInstagramConnection,
  syncInstagramConnection,
} from '../api/instagram.api';

export function useInstagramAccount(organizationId: string | null) {
  return useQuery({
    queryKey: qk.social.instagramAccount(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? null : getInstagramAccount(organizationId)),
    enabled: organizationId !== null,
  });
}

export function useInstagramReadiness(organizationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: qk.social.instagramReadiness(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? null : getInstagramReadiness(organizationId)),
    enabled: organizationId !== null && enabled,
  });
}

export function useStartInstagramConnection(organizationId: string) {
  return useMutation({
    mutationFn: () => startInstagramConnection(organizationId),
  });
}

export function useSyncInstagramConnection(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncInstagramConnection(organizationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.social.all });
    },
  });
}

export function useDisconnectInstagram(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disconnectInstagram(organizationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.social.all });
    },
  });
}
