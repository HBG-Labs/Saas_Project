import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import type { TablesUpdate } from '@/types/database';

import { getMyProfile, updateMyProfile } from './api/profile.api';

/**
 * Les deux hooks React Query du profil, dans un fichier à part.
 *
 * Ils vivaient dans `index.ts` — « un seul fichier, la feature tient en deux
 * hooks et une table ». Toujours vrai en volume, plus en emplacement :
 * `AvatarPicker` a besoin des deux, et un composant qui importerait le barrel
 * de sa PROPRE feature créerait une dépendance circulaire dès que ce barrel
 * réexporte ce composant — ce que fait précisément `index.ts` pour
 * `AvatarPicker`. Le reste du projet évite déjà ce schéma : les composants
 * importent depuis le fichier concret, jamais depuis leur propre `index.ts`
 * (voir `MemberRow`, qui importe `memberDisplayName` depuis
 * `../hooks/useMembers`, pas depuis `features/organizations`).
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
      jobTitle?: string;
    }) => {
      if (userId === null) {
        throw new Error('Vous devez être connecté pour modifier votre profil.');
      }
      return updateMyProfile(userId, patch);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PROFILE_KEY(userId ?? 'anonymous') });
      // Les membres affichent le nom et l'avatar du profil : la liste doit suivre.
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}
