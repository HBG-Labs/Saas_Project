import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import {
  cancelSocialPost,
  createDevelopmentSocialWeek,
  generateSocialPostImages,
  generateSocialStudioWeek,
  getSocialStudioWeek,
  selectSocialPostAsset,
  setSocialWeekPublishingSuspended,
  updateSocialPostDraft,
  validateAndScheduleSocialWeek,
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

export function useGenerateSocialStudioWeek(organizationId: string, startsOn: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateSocialStudioWeek(organizationId, startsOn),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.social.week(organizationId, startsOn) });
    },
  });
}

export function useGenerateSocialPostImages(organizationId: string, startsOn: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, force }: { postId: string; force?: boolean }) =>
      generateSocialPostImages(organizationId, postId, force ?? false),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.social.week(organizationId, startsOn) });
    },
  });
}

export function useSelectSocialPostAsset(organizationId: string, startsOn: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, assetId }: { postId: string; assetId: string }) =>
      selectSocialPostAsset(organizationId, postId, assetId),
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

export function useValidateAndScheduleSocialWeek(organizationId: string, startsOn: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ weekId, timezone }: { weekId: string; timezone: string }) =>
      validateAndScheduleSocialWeek(organizationId, weekId, timezone),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.social.week(organizationId, startsOn) });
    },
  });
}

export function useSetSocialWeekPublishingSuspended(organizationId: string, startsOn: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ weekId, suspended }: { weekId: string; suspended: boolean }) =>
      setSocialWeekPublishingSuspended(organizationId, weekId, suspended),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.social.week(organizationId, startsOn) });
    },
  });
}

export function useCancelSocialPost(organizationId: string, startsOn: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId }: { postId: string }) => cancelSocialPost(organizationId, postId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.social.week(organizationId, startsOn) });
    },
  });
}
