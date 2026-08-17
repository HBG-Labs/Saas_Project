import { useCallback, useMemo, useState } from 'react';
import type { MissionWithRelations } from '@/types/domain';
import { calculateDistanceKm, formatDistance, getCurrentPosition } from './geolocation';
import type { GeoError, GeoPosition, NearbyMission } from './types';

/**
 * Hook pour calculer les chantiers/interventions à proximité
 * à partir d'une position GPS ponctuelle.
 */
export function useNearbyMissions(missions: readonly MissionWithRelations[]) {
  const [userPosition, setUserPosition] = useState<GeoPosition | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<GeoError | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(25); // 25 km par défaut

  const requestNearby = useCallback(async (): Promise<GeoPosition | null> => {
    setIsLocating(true);
    setError(null);

    try {
      const pos = await getCurrentPosition();
      setUserPosition(pos);
      return pos;
    } catch (err) {
      const geoErr = err as GeoError;
      setError(geoErr);
      return null;
    } finally {
      setIsLocating(false);
    }
  }, []);

  // Calcul de la distance pour chaque mission ayant des coordonnées GPS
  const allMissionsWithDistance = useMemo<NearbyMission[]>(() => {
    if (!userPosition) return [];

    const computed: NearbyMission[] = [];

    missions.forEach((mission) => {
      if (mission.latitude != null && mission.longitude != null) {
        const distanceKm = calculateDistanceKm(
          userPosition.latitude,
          userPosition.longitude,
          mission.latitude,
          mission.longitude,
        );

        computed.push({
          mission,
          distanceKm,
          formattedDistance: formatDistance(distanceKm),
        });
      }
    });

    // Tri par proximité croissante
    return computed.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [missions, userPosition]);

  // Filtrage par rayon kilométrique si spécifié
  const nearbyMissions = useMemo<NearbyMission[]>(() => {
    if (radiusKm == null) return allMissionsWithDistance;
    return allMissionsWithDistance.filter((item) => item.distanceKm <= radiusKm);
  }, [allMissionsWithDistance, radiusKm]);

  return {
    userPosition,
    isLocating,
    error,
    radiusKm,
    setRadiusKm,
    requestNearby,
    nearbyMissions,
    allMissionsWithDistance,
  };
}
