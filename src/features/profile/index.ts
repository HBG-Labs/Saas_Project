import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import type { TablesUpdate } from '@/types/database';

import { getMyProfile, updateMyProfile } from './api/profile.api';

/**
 * API publique de la feature « profil ».
 *
 * Un seul fichier : la feature tient en deux hooks et une table. La découper en
 * `hooks/` et `api/` séparés multiplierait les fichiers sans rien clarifier.
 */

const PROFILE_KEY = (userId: string) => ['profile', userId] as const;

export function useMyProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: PROFILE_KEY(userId ?? 'anonymous'),
    queryFn: () => (userId === null ? null : getMyProfile(userId)),
    enabled: userId !== null,
  });
}

export function useUpdateMyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  return useMutation({
    mutationFn: (patch: {
      identity?: TablesUpdate<'profiles'>;
      details?: Omit<TablesUpdate<'profile_details'>, 'user_id'>;
    }) => {
      if (userId === null) {
        throw new Error('Vous devez être connecté pour modifier votre profil.');
      }
      return updateMyProfile(userId, patch);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY(userId ?? 'anonymous') });
      // Les membres affichent le nom du profil : la liste doit suivre.
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

export { getMyProfile, updateMyProfile, type FullProfile } from './api/profile.api';
export { PROFILE_AVATARS, useAvatarStore, type ProfileAvatar } from './avatars-data';
export { AvatarPickerModal } from './components/AvatarPickerModal';
