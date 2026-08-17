import type { MissionWithRelations } from '@/types/domain';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export type GeoErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

/**
 * Échec d'une demande de position.
 *
 * Une vraie `Error`, et pas un objet nu. La version précédente rejetait
 * `{ code, message }` : la pile d'appel était perdue, `instanceof Error`
 * répondait faux, et tout code défensif écrivant
 * `error instanceof Error ? error.message : '…'` affichait le message de repli
 * plutôt que l'explication exacte — « Autorisation GPS refusée » devenait
 * « une erreur est survenue ».
 */
export class GeoError extends Error {
  readonly code: GeoErrorCode;

  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.name = 'GeoError';
    this.code = code;

    // Nécessaire pour que `instanceof GeoError` survive à la transpilation —
    // même précaution que `AppError`.
    Object.setPrototypeOf(this, GeoError.prototype);
  }
}

export interface NearbyMission {
  mission: MissionWithRelations;
  distanceKm: number;
  formattedDistance: string;
}

export interface NavigationDestination {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  label?: string | null;
}
