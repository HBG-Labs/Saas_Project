import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from '@/features/auth';
import {
  getUserPreferences,
  upsertUserPreferences,
  type UserPreferences,
  DEFAULT_USER_PREFERENCES,
} from '../api/user-preferences.api';

export const USER_PREFERENCES_QUERY_KEY = ['user_preferences'] as const;

export function useUserPreferences() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...USER_PREFERENCES_QUERY_KEY, userId],
    queryFn: () => (userId ? getUserPreferences(userId) : Promise.resolve(null)),
    enabled: userId !== null,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<Omit<UserPreferences, 'user_id'>>) => {
      if (!userId) throw new Error('Utilisateur non connecté');
      return upsertUserPreferences(userId, patch);
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: [...USER_PREFERENCES_QUERY_KEY, userId] });
      const previous = queryClient.getQueryData<UserPreferences>([...USER_PREFERENCES_QUERY_KEY, userId]);

      if (previous && userId) {
        queryClient.setQueryData<UserPreferences>([...USER_PREFERENCES_QUERY_KEY, userId], {
          ...previous,
          ...patch,
        });
      }

      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous && userId) {
        queryClient.setQueryData([...USER_PREFERENCES_QUERY_KEY, userId], context.previous);
      }
    },
    onSettled: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: [...USER_PREFERENCES_QUERY_KEY, userId] });
      }
    },
  });

  const updatePreference = useCallback(
    <K extends keyof Omit<UserPreferences, 'user_id'>>(key: K, value: UserPreferences[K]) => {
      mutation.mutate({ [key]: value });
    },
    [mutation],
  );

  const preferences: UserPreferences = query.data ?? {
    user_id: userId ?? 'anon',
    ...DEFAULT_USER_PREFERENCES,
  };

  return {
    preferences,
    isLoading: query.isPending,
    isUpdating: mutation.isPending,
    updatePreference,
    updatePreferences: mutation.mutateAsync,
  };
}
