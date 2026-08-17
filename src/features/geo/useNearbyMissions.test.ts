import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNearbyMissions } from './useNearbyMissions';
import type { MissionWithRelations } from '@/types/domain';

describe('useNearbyMissions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockMissions = [
    {
      id: 'm1',
      title: 'Chantier Lamentin',
      reference: 'MIS-001',
      latitude: 14.615,
      longitude: -60.999,
      status: 'assigned',
    },
    {
      id: 'm2',
      title: 'Chantier Schoelcher',
      reference: 'MIS-002',
      latitude: 14.618,
      longitude: -61.1,
      status: 'in_progress',
    },
    {
      id: 'm3',
      title: 'Chantier Sans Coordonnées',
      reference: 'MIS-003',
      latitude: null,
      longitude: null,
      status: 'assigned',
    },
  ] as unknown as MissionWithRelations[];

  it('ne retourne aucune distance avant localisation ponctuelle', () => {
    const { result } = renderHook(() => useNearbyMissions(mockMissions));
    expect(result.current.userPosition).toBeNull();
    expect(result.current.nearbyMissions).toEqual([]);
  });

  it('calcule et trie les chantiers par ordre de distance après localisation', async () => {
    // Mock de Fort-de-France (14.6161, -61.0588)
    const mockPosition = {
      coords: {
        latitude: 14.6161,
        longitude: -61.0588,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as unknown as GeolocationPosition;

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: (pos: GeolocationPosition) => void) => {
          success(mockPosition);
        },
      },
    });

    const { result } = renderHook(() => useNearbyMissions(mockMissions));

    await act(async () => {
      await result.current.requestNearby();
    });

    expect(result.current.userPosition).not.toBeNull();
    expect(result.current.nearbyMissions.length).toBe(2);

    // m2 (Schoelcher ~4.4km) est plus proche de FdF que m1 (Lamentin ~6.4km)
    expect(result.current.nearbyMissions[0]?.mission.id).toBe('m2');
    expect(result.current.nearbyMissions[1]?.mission.id).toBe('m1');
    expect(result.current.nearbyMissions[0]?.distanceKm).toBeLessThan(
      result.current.nearbyMissions[1]?.distanceKm ?? 999,
    );
  });

  it('filtre par rayon kilométrique', async () => {
    const mockPosition = {
      coords: {
        latitude: 14.6161,
        longitude: -61.0588,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as unknown as GeolocationPosition;

    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: (pos: GeolocationPosition) => void) => {
          success(mockPosition);
        },
      },
    });

    const { result } = renderHook(() => useNearbyMissions(mockMissions));

    await act(async () => {
      await result.current.requestNearby();
    });

    // Rayon restreint à 5km -> seul Schoelcher (~4.4km) doit être inclus
    act(() => {
      result.current.setRadiusKm(5);
    });

    expect(result.current.nearbyMissions.length).toBe(1);
    expect(result.current.nearbyMissions[0]?.mission.id).toBe('m2');
  });
});
