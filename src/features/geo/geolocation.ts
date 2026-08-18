import { GeoError } from './types';
import type { GeoPosition, NavigationDestination } from './types';

/**
 * Service GPS centralisé et ponctuel pour NexoraTech.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RÈGLES DE CONFIDENTIALITÉ & FONCTIONNEMENT :
 *
 * 1. ZÉRO TRACKING EN ARRIÈRE-PLAN : Aucune fonction ne crée de `watchPosition`,
 *    d'intervalle ou de tâche d'arrière-plan.
 * 2. ACTION EXPLICITE UNIQUEMENT : La position n'est demandée QUE lorsque
 *    l'utilisateur clique volontairement sur une action (ex: « Ma position »,
 *    « Localiser l'intervention », « Interventions à proximité »).
 * 3. AUCUN STOCKAGE AUTOMATIQUE : La position de l'utilisateur n'est jamais
 *    enregistrée automatiquement en base de données.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 0, // Force une position fraîche à l'instant T
};

/**
 * Récupère UNE SEULE position GPS ponctuelle à la demande.
 */
export function getCurrentPosition(options: PositionOptions = DEFAULT_OPTIONS): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(
        new GeoError(
          'UNSUPPORTED',
          'La géolocalisation n’est pas prise en charge par cet appareil ou ce navigateur.',
        ),
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (geoError) => {
        let code: GeoError['code'] = 'UNKNOWN';
        let message = 'Une erreur est survenue lors de la récupération de votre position GPS.';

        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            code = 'PERMISSION_DENIED';
            message =
              'Autorisation GPS refusée. Veuillez autoriser l’accès à la localisation dans les réglages de votre navigateur ou téléphone.';
            break;
          case geoError.POSITION_UNAVAILABLE:
            code = 'POSITION_UNAVAILABLE';
            message =
              'Signal GPS indisponible ou précision insuffisante. Vérifiez que la localisation de votre appareil est activée.';
            break;
          case geoError.TIMEOUT:
            code = 'TIMEOUT';
            message = 'Délai d’attente dépassé pour la recherche du signal GPS. Veuillez réessayer.';
            break;
        }

        reject(new GeoError(code, message));
      },
      options,
    );
  });
}

/**
 * Calcule la distance à vol d'oiseau entre deux coordonnées géographiques (Formule de Haversine).
 * Retourne la distance en kilomètres (km).
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Rayon moyen de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formate une distance en kilomètres pour un affichage clair sur le terrain.
 * - < 1 km  => "450 m"
 * - < 10 km => "2,4 km"
 * - >= 10 km => "18 km"
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 0) return '0 m';

  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1).replace('.', ',')} km`;
  }

  return `${Math.round(distanceKm)} km`;
}

/**
 * Génère l'URL d'itinéraire vers une destination (coordonnées GPS ou adresse).
 */
export function getNavigationUrl(destination: NavigationDestination): string | null {
  if (destination.latitude != null && destination.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
  }

  const query = (destination.address ?? destination.label)?.trim();
  if (query && query !== '') {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  }

  return null;
}

/**
 * Ouvre l'application de navigation du système (Google Maps / Apple Maps / Waze).
 */
export function openNavigationApp(destination: NavigationDestination): boolean {
  const url = getNavigationUrl(destination);
  if (!url) return false;

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  return false;
}
