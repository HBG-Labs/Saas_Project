import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import {
  getFormResponse,
  getFormTemplate,
  saveFormResponse,
  type FormValues,
} from '../api/forms.api';

/**
 * Modèle de saisie d'un type d'intervention.
 *
 * `staleTime` long : les modèles sont livrés avec le produit et n'évoluent que
 * par migration. Les relire à chaque ouverture d'un compte rendu coûterait une
 * requête pour une donnée qui ne change pas entre deux déploiements.
 */
export function useFormTemplate(interventionTypeId: string | null) {
  return useQuery({
    queryKey: [...qk.industries.all, 'form-template', interventionTypeId ?? 'none'],
    queryFn: () => (interventionTypeId === null ? null : getFormTemplate(interventionTypeId)),
    enabled: interventionTypeId !== null,
    staleTime: 60 * 60_000,
  });
}

export function useFormResponse(interventionId: string | null) {
  return useQuery({
    queryKey: [...qk.industries.all, 'form-response', interventionId ?? 'none'],
    queryFn: () => (interventionId === null ? null : getFormResponse(interventionId)),
    enabled: interventionId !== null,
  });
}

export function useSaveFormResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      interventionId: string;
      organizationId: string;
      formTemplateId: string;
      values: FormValues;
      completed: boolean;
    }) => saveFormResponse(input),
    onSuccess: (response) => {
      // La réponse revient du serveur validée : on écrit le cache avec elle
      // plutôt que d'invalider. Une invalidation relancerait une requête pour
      // obtenir ce qu'on a déjà en main — et ferait clignoter le formulaire
      // que l'utilisateur est peut-être en train de continuer à remplir.
      queryClient.setQueryData(
        [...qk.industries.all, 'form-response', response.interventionId],
        response,
      );
    },
  });
}
