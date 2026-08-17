import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateDistanceKm,
  formatDistance,
  getCurrentPosition,
  getNavigationUrl,
  openNavigationApp,
} from './geolocation';
import { GeoError } from './types';

describe('geolocation service (ponctuel & sécurisé)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateDistanceKm', () => {
    it('retourne 0 si les coordonnées sont identiques', () => {
      expect(calculateDistanceKm(14.6415, -61.0242, 14.6415, -61.0242)).toBe(0);
    });

    it('calcule correctement la distance entre deux points connus', () => {
      // Fort-de-France (14.6161, -61.0588) à Le Lamentin (14.6150, -60.9990) ~ 6.4 km
      const distance = calculateDistanceKm(14.6161, -61.0588, 14.615, -60.999);
      expect(distance).toBeGreaterThan(6.0);
      expect(distance).toBeLessThan(7.0);
    });

    it('calcule la distance Paris - Lyon (~390-400 km)', () => {
      const distance = calculateDistanceKm(48.8566, 2.3522, 45.764, 4.8357);
      expect(distance).toBeGreaterThan(385);
      expect(distance).toBeLessThan(405);
    });
  });

  describe('formatDistance', () => {
    it('formate les distances inférieures à 1 km en mètres', () => {
      expect(formatDistance(0.45)).toBe('450 m');
      expect(formatDistance(0.08)).toBe('80 m');
      expect(formatDistance(0.005)).toBe('5 m');
    });

    it('formate les distances entre 1 km et 10 km avec une décimale', () => {
      expect(formatDistance(1.23)).toBe('1,2 km');
      expect(formatDistance(6.78)).toBe('6,8 km');
    });

    it('formate les grandes distances en km entiers arrondis', () => {
      expect(formatDistance(14.8)).toBe('15 km');
      expect(formatDistance(125.4)).toBe('125 km');
    });
  });

  describe('getNavigationUrl', () => {
    it('génère une URL Google Maps avec coordonnées précises', () => {
      const url = getNavigationUrl({ latitude: 14.6415, longitude: -61.0242 });
      expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=14.6415,-61.0242');
    });

    it('génère une URL avec adresse textuelle', () => {
      const url = getNavigationUrl({ address: '12 rue de la Paix, Paris' });
      expect(url).toBe(
        'https://www.google.com/maps/dir/?api=1&destination=12%20rue%20de%20la%20Paix%2C%20Paris',
      );
    });

    it('retourne null si aucune destination n’est fournie', () => {
      expect(getNavigationUrl({})).toBeNull();
      expect(getNavigationUrl({ address: '   ' })).toBeNull();
    });
  });

  describe('openNavigationApp', () => {
    it('ouvre une nouvelle fenêtre avec l’URL générée', () => {
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      const result = openNavigationApp({ latitude: 14.6415, longitude: -61.0242 });
      expect(result).toBe(true);
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.google.com/maps/dir/?api=1&destination=14.6415,-61.0242',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });

  describe('getCurrentPosition (absence totale de tracking continu)', () => {
    it('récupère une seule position via navigator.geolocation.getCurrentPosition', async () => {
      const mockPosition = {
        coords: {
          latitude: 14.6415,
          longitude: -61.0242,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as unknown as GeolocationPosition;

      const getCurrentPositionMock = vi.fn((success: PositionCallback) => {
        success(mockPosition);
      });

      const watchPositionMock = vi.fn();

      vi.stubGlobal('navigator', {
        geolocation: {
          getCurrentPosition: getCurrentPositionMock,
          watchPosition: watchPositionMock,
        },
      });

      const pos = await getCurrentPosition();
      expect(pos.latitude).toBe(14.6415);
      expect(pos.longitude).toBe(-61.0242);
      expect(pos.accuracy).toBe(10);

      // Vérification essentielle : JAMAIS de watchPosition appelé
      expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);
      expect(watchPositionMock).not.toHaveBeenCalled();
    });

    it('gère proprement le refus d’autorisation avec un message explicite', async () => {
      const mockError: GeolocationPositionError = {
        code: 1, // PERMISSION_DENIED
        message: 'User denied Geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      };

      const getCurrentPositionMock = vi.fn(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error(mockError);
        },
      );

      vi.stubGlobal('navigator', {
        geolocation: {
          getCurrentPosition: getCurrentPositionMock,
        },
      });

      // Le rejet porte désormais une vraie `Error`, et non un objet nu : la
      // pile d'appel survit, et tout code écrivant
      // `error instanceof Error ? error.message : '…'` affiche l'explication
      // exacte plutôt que son message de repli.
      const rejection: unknown = await getCurrentPosition().catch((error: unknown) => error);

      expect(rejection).toBeInstanceOf(GeoError);
      expect((rejection as GeoError).code).toBe('PERMISSION_DENIED');
      expect((rejection as GeoError).message).toContain('Autorisation GPS refusée');
    });
  });
});
