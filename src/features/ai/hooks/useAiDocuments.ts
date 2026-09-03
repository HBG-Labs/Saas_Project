import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import {
  deleteAiDocument,
  indexAiDocument,
  listAiDocuments,
  uploadAiDocument,
  type UploadAiDocumentInput,
} from '../api/ai-documents.api';

export function useAiDocuments(organizationId: string | null) {
  return useQuery({
    queryKey: qk.aiDocuments.list(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listAiDocuments(organizationId)),
    enabled: organizationId !== null,
    // Un document en cours d'indexation change de statut en quelques
    // secondes : un refetch périodique évite à l'administrateur de recharger
    // la page à la main pour voir passer `processing` → `ready`.
    refetchInterval: (query) => {
      const documents = query.state.data ?? [];
      const hasPending = documents.some((d) => d.status === 'pending' || d.status === 'processing');
      return hasPending ? 4000 : false;
    },
  });
}

export function useUploadAiDocument(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<UploadAiDocumentInput, 'organizationId'>) =>
      uploadAiDocument({ ...input, organizationId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.aiDocuments.list(organizationId) });
    },
  });
}

export function useReindexAiDocument(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => indexAiDocument(documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.aiDocuments.list(organizationId) });
    },
  });
}

export function useDeleteAiDocument(organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAiDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.aiDocuments.list(organizationId) });
    },
  });
}
