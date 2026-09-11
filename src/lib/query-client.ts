import { QueryCache, QueryClient } from '@tanstack/react-query';

import { isAppError, toAppError } from '@/lib/errors';

/**
 * Configuration TanStack Query.
 *
 * Le catalogue d'outils change rarement : un `staleTime` d'une minute évite de
 * refetcher à chaque montage de composant sans rendre les données obsolètes.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        // Point unique de journalisation. En production, brancher ici un
        // service de collecte plutôt que la console.
        console.error('[query]', toAppError(error).message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Inutile de réessayer une erreur de droits ou une ressource absente.
          if (
            isAppError(error) &&
            ['forbidden', 'not_found', 'unauthenticated'].includes(error.code)
          ) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

/**
 * Retire les données privées lors d'un changement d'organisation.
 *
 * La liste des organisations de l'utilisateur reste en cache pour que le
 * provider puisse déterminer la nouvelle organisation sans boucle de
 * chargement. Le catalogue est public et identique pour tous les tenants.
 * Tout le reste est rechargé sous le contexte de la nouvelle organisation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI `type: 'inactive'`, ET CE QUE COÛTE SON OUBLI
 *
 * `removeQueries` sans filtre retire AUSSI les requêtes encore montées. Une
 * requête retirée du cache pendant que sa promesse est en vol n'a plus où
 * écrire son résultat : son observateur reste orphelin, `isPending` ne redevient
 * jamais `false`, et l'écran ne quitte plus son squelette. Ce n'est pas une
 * lenteur — c'est un blocage définitif, mesuré sur le tableau de bord, où
 * l'appartenance de l'utilisateur était lancée au rendu précis que la purge
 * suivait.
 *
 * Se limiter à l'inactif suffit, parce que l'isolation ne repose pas sur cette
 * purge : l'identifiant d'organisation fait déjà partie de chaque clé (voir
 * `query-keys.ts`). Changer d'organisation change donc les clés — les requêtes
 * montées observent d'office une nouvelle entrée et rechargent, tandis que
 * celles du tenant quitté deviennent inactives. Cette fonction ne fait que
 * libérer leur mémoire sans attendre le `gcTime`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function clearTenantQueryCache(queryClient: QueryClient): void {
  queryClient.removeQueries({
    type: 'inactive',
    predicate: ({ queryKey }) => {
      if (queryKey[0] === 'catalog') return false;
      return !(queryKey[0] === 'organizations' && queryKey[1] === 'mine');
    },
  });
}
