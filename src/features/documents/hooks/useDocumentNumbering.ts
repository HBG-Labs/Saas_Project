import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';
import type { DocumentKind } from '@/types/database';
import { configureDocumentNumbering, getDocumentNumbering } from '../api/numbering.api';

export function useDocumentNumbering(organizationId: string | null, documentKind: DocumentKind) {
  return useQuery({
    queryKey: qk.documents.numbering(organizationId ?? 'none', documentKind),
    queryFn: () =>
      organizationId === null ? null : getDocumentNumbering(organizationId, documentKind),
    enabled: organizationId !== null,
  });
}

export function useConfigureDocumentNumbering() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: configureDocumentNumbering,
    onSuccess: async (setting) => {
      await queryClient.invalidateQueries({
        queryKey: qk.documents.numbering(setting.organization_id, setting.document_kind),
      });
    },
  });
}
