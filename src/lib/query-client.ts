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
