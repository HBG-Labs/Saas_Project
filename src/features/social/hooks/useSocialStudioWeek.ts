import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import {
  createDevelopmentSocialWeek,
  getSocialStudioWeek,
  updateSocialPostDraft,
} from '../api/weekly-planning.api';
import {
  currentWeekStartsOn,
  type SocialPost,
  type SocialPostFormValues,
  type SocialPostSaveIntent,
} from '../weekly-planning';

export function useSocialStudioWeek(
  organizationId: string | null,
  startsOn = currentWeekStartsOn(),
) {
  return useQuery({
    queryKey: qk.social.week(organizationId ?? 'none', startsOn),
    queryFn: () => (organizationId === null ? null : getSocialStudioWeek(organizationId, startsOn)),
    enabled: organizationId !== null,
  });
}

export function useCreateDevelopmentSocialWeek(organizationId: string, startsOn: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createDevelopmentSocialWeek(organizationId, startsOn),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.social.week(organizationId, startsOn) });
    },
  });
}

export function useUpdateSocialPost(organizationId: string, startsOn: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      post,
      values,
      intent,
    }: {
      post: SocialPost;
      values: SocialPostFormValues;
      intent: SocialPostSaveIntent;
    }) => updateSocialPostDraft(post, values, intent),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.social.week(organizationId, startsOn) });
    },
  });
}
