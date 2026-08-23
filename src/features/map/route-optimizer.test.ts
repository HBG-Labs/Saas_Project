import { describe, expect, it } from 'vitest';
import {
  formatDurationMinutes,
  optimizeRoute,
  getWazeNavigationUrl,
  getAppleMapsNavigationUrl,
  getGoogleMapsNavigationUrl,
} from './route-optimizer';
import type { InterventionSite } from './types';

describe('route-optimizer', () => {
  const mockSites: InterventionSite[] = [
    {
      id: 'site-1',
      title: 'Raccordement Fibre Client A',
      reference: 'MIS-001',
      clientName: 'Client Alpha',
      address: '10 Rue de la Paix, 75002 Paris',
      lat: 48.8698,
      lng: 2.3312,
      scheduledTime: '08:00',
      trade: 'fiber_telecom',
      tradeLabel: 'Fibre Optique',
      status: 'planned',
      priority: 'high',
      kind: 'mission',
    },
    {
      id: 'site-2',
      title: 'Installation Borne IRVE Client B',
      reference: 'MIS-002',
      clientName: 'Client Beta',
      address: '45 Avenue de la République, 75011 Paris',
      lat: 48.8634,
      lng: 2.3732,
      scheduledTime: '10:30',
      trade: 'electrical',
      tradeLabel: 'Électricité & IRVE',
      status: 'planned',
      priority: 'normal',
      kind: 'mission',
    },
    {
      id: 'site-3',
      title: 'Audit Réseau Telecom Client C',
      reference: 'MIS-003',
      clientName: 'Client Gamma',
      address: '12 Boulevard Saint-Michel, 75005 Paris',
      lat: 48.8519,
      lng: 2.3435,
      scheduledTime: '14:00',
      trade: 'fiber_telecom',
      tradeLabel: 'Cuivre & ADSL',
      status: 'planned',
      priority: 'urgent',
      kind: 'mission',
    },
  ];

  it('optimise la séquence de visite et calcule le temps de route estimé', () => {
    const route = optimizeRoute(mockSites);

    expect(route.steps).toHaveLength(3);
    expect(route.totalDistanceKm).toBeGreaterThan(0);
    expect(route.formattedTotalDistance).toContain('km');
    expect(route.totalEstimatedDriveTimeMinutes).toBeGreaterThan(0);
    expect(route.googleMapsMultiStopUrl).toContain('https://www.google.com/maps/dir/');
  });

  it('gère une liste vide de chantiers sans erreur', () => {
    const route = optimizeRoute([]);
    expect(route.steps).toHaveLength(0);
    expect(route.totalDistanceKm).toBe(0);
    expect(route.googleMapsMultiStopUrl).toBeNull();
  });

  it('génère des URLs valides pour Waze, Apple Maps et Google Maps', () => {
    const waze = getWazeNavigationUrl(48.8566, 2.3522);
    const apple = getAppleMapsNavigationUrl(48.8566, 2.3522);
    const google = getGoogleMapsNavigationUrl(48.8566, 2.3522);

    expect(waze).toBe('https://waze.com/ul?ll=48.8566,2.3522&navigate=yes');
    expect(apple).toBe('https://maps.apple.com/?daddr=48.8566,2.3522');
    expect(google).toBe('https://www.google.com/maps/dir/?api=1&destination=48.8566,2.3522');
  });

  it('formate correctement les durées en minutes et heures', () => {
    expect(formatDurationMinutes(15)).toBe('15 min');
    expect(formatDurationMinutes(60)).toBe('1h');
    expect(formatDurationMinutes(75)).toBe('1h 15m');
    expect(formatDurationMinutes(125)).toBe('2h 05m');
  });

  it('applique un coefficient de détour routier réaliste supérieur au vol d’oiseau', () => {
    const route = optimizeRoute(mockSites);
    expect(route.totalDistanceKm).toBeGreaterThan(5);
  });
});
