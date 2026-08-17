import { useCallback, useState } from 'react';
import { getCurrentPosition } from './geolocation';
import type { GeoError, GeoPosition } from './types';

/**
 * Hook pour déclencher UNE demande ponctuelle de position GPS.
 *
 * Ne démarre aucun tracking automatique. L'état `position` est conservé
 * temporairement dans la mémoire du composant et n'est jamais persisté
 * automatiquement en base de données.
 */
export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<GeoError | null>(null);

  const requestPosition = useCallback(async (): Promise<GeoPosition | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const pos = await getCurrentPosition();
      setPosition(pos);
      return pos;
    } catch (err) {
      const geoErr = err as GeoError;
      setError(geoErr);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearPosition = useCallback(() => {
    setPosition(null);
    setError(null);
  }, []);

  return {
    position,
    isLoading,
    error,
    requestPosition,
    clearPosition,
  };
}
