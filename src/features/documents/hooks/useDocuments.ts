import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { qk } from '@/lib/query-keys';
import type { OrganizationDocument } from '@/types/domain';

import {
  createFolder,
  deleteDocument as deleteDocumentApi,
  listDocuments,
  listFolders,
  updateDocument as updateDocumentApi,
  uploadDocument as uploadDocumentApi,
  type DocumentListInput,
  type UploadDocumentInput,
} from '../api/documents.api';
import type { FiltreFamille } from '../constants';

export interface DocumentFilters {
  search: string;
  famille: FiltreFamille;
  folderId: string | null | undefined;
  page: number;
}

/**
 * La bibliothèque d'une organisation, paginée et filtrée par la base.
 *
 * Les filtres voyagent dans la clé de cache : changer de page ou de famille
 * change d'entrée, et revenir en arrière ré-affiche instantanément. Le compte
 * total vient du même appel que la page, ce qui évite une seconde requête pour
 * afficher « 24 sur 312 ».
 *
 * `placeholderData` conserve la page précédente pendant le chargement de la
 * suivante : sans elle, la liste se viderait à chaque frappe dans la recherche.
 */
export function useDocuments(organizationId: string | null, filters: DocumentFilters) {
  const input: DocumentListInput = {
    organizationId: organizationId ?? '',
    search: filters.search,
    famille: filters.famille,
    ...(filters.folderId !== undefined ? { folderId: filters.folderId } : {}),
    page: filters.page,
  };

  return useQuery({
    queryKey: qk.documents.list(organizationId ?? 'none', filters),
    queryFn: () => listDocuments(input),
    enabled: organizationId !== null,
    placeholderData: (precedent) => precedent,
  });
}

export function useDocumentFolders(organizationId: string | null) {
  return useQuery({
    queryKey: qk.documents.folders(organizationId ?? 'none'),
    queryFn: () => (organizationId === null ? [] : listFolders(organizationId)),
    enabled: organizationId !== null,
  });
}

/**
 * Les écritures de la bibliothèque.
 *
 * Toutes invalident `qk.documents.all` : après un dépôt ou une suppression, on
 * ne sait pas quelle combinaison de filtres est affichée, et invalider la racine
 * les purge sans avoir à le deviner.
 */
export function useDocumentMutations() {
  const queryClient = useQueryClient();

  const invalider = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.documents.all });
  }, [queryClient]);

  const upload = useMutation({
    mutationFn: (input: UploadDocumentInput) => uploadDocumentApi(input),
    onSuccess: invalider,
  });

  const update = useMutation({
    mutationFn: (input: {
      documentId: string;
      patch: {
        name?: string;
        description?: string | null;
        category?: string | null;
        folder_id?: string | null;
      };
    }) => updateDocumentApi(input.documentId, input.patch),
    onSuccess: invalider,
  });

  const remove = useMutation({
    mutationFn: (document: OrganizationDocument) => deleteDocumentApi(document),
    onSuccess: invalider,
  });

  const addFolder = useMutation({
    mutationFn: (input: { organizationId: string; name: string; createdBy: string }) =>
      createFolder(input),
    onSuccess: invalider,
  });

  return { upload, update, remove, addFolder };
}
