import { useQueries } from '@tanstack/react-query';

import { forwardGeocode } from './reverse-geocoding';

/**
 * Résout un lot d'adresses en coordonnées, sans les redemander deux fois.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE HOOK REMPLACE
 *
 * La carte tenait deux `useEffect` qui parcouraient tous les clients puis
 * toutes les missions, appelaient le géocodeur en série, et rangeaient le
 * résultat dans un `useState`. Trois défauts :
 *
 *   • les dépendances de l'effet contenaient l'état que l'effet écrivait, donc
 *     chaque réponse relançait la boucle ;
 *   • rien n'était conservé d'une visite à l'autre : ouvrir la carte deux fois
 *     interrogeait deux fois l'API publique pour les mêmes adresses ;
 *   • les échecs disparaissaient dans un `catch {}`, et le point manquant sur
 *     la carte ne s'expliquait pas.
 *
 * TanStack Query règle les trois : une requête par ADRESSE, dédupliquée par sa
 * clé, conservée en cache, et dont l'échec est observable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE HOOK N'ÉCRIT RIEN EN BASE, ET C'EST VOULU
 *
 * Il serait tentant d'enregistrer les coordonnées trouvées sur la mission. Mais
 * une consultation ne doit pas écrire : un technicien qui ouvre la carte n'a
 * pas `mission.update`, la requête échouerait pour lui seul, et l'écriture
 * silencieuse d'une donnée déduite d'un service tiers mérite mieux qu'un effet
 * de bord d'affichage.
 *
 * Les coordonnées se posent à la SAISIE, par `MapLocationPickerDialog`, qui les
 * enregistre explicitement. Ce hook ne comble que les lignes antérieures.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface AddressToResolve {
  /** Identifiant de l'objet auquel rattacher le résultat. */
  id: string;
  query: string;
}

export interface ResolvedCoordinates {
  latitude: number;
  longitude: number;
}

/** Un mois : une adresse postale ne se déplace pas. */
const CACHE_MS = 30 * 24 * 60 * 60 * 1000;

export function useGeocodedAddresses(entries: readonly AddressToResolve[]): {
  coordinates: Record<string, ResolvedCoordinates>;
  isResolving: boolean;
  failedCount: number;
} {
  const results = useQueries({
    queries: entries.map((entry) => ({
      // La clé porte l'ADRESSE, pas l'identifiant : deux clients à la même
      // adresse ne déclenchent qu'une requête.
      queryKey: ['geocode', entry.query] as const,
      queryFn: () => forwardGeocode(entry.query),
      enabled: entry.query.trim().length > 3,
      staleTime: CACHE_MS,
      gcTime: CACHE_MS,
      // Le géocodeur public peut refuser ponctuellement ; inutile d'insister
      // trente fois pour un point d'affichage.
      retry: 1,
    })),
  });

  const coordinates: Record<string, ResolvedCoordinates> = {};
  let isResolving = false;
  let failedCount = 0;

  results.forEach((result, index) => {
    const entry = entries[index];
    if (entry === undefined) return;

    if (result.isPending && result.fetchStatus !== 'idle') isResolving = true;
    if (result.isError) failedCount += 1;

    const first = result.data?.[0];
    if (first !== undefined) {
      coordinates[entry.id] = { latitude: first.latitude, longitude: first.longitude };
    }
  });

  return { coordinates, isResolving, failedCount };
}
