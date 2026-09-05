import { useEffect, useMemo, useState } from 'react';
import { calculateDistanceKm, formatDistance, type GeoPosition } from '@/features/geo';
import type { InterventionSite } from './types';

export interface RouteStep {
  site: InterventionSite;
  stepNumber: number;
  distanceFromPreviousKm: number;
  formattedDistanceFromPrevious: string;
  estimatedDriveTimeMinutes: number;
}

export interface OptimizedRoute {
  steps: RouteStep[];
  totalDistanceKm: number;
  formattedTotalDistance: string;
  totalEstimatedDriveTimeMinutes: number;
  formattedTotalTime: string;
  savingsKm: number;
  googleMapsMultiStopUrl: string | null;
  /** Tracé réel suivant les virages et routes du réseau routier (lat, lng) */
  roadGeometry?: [number, number][];
  isRoadGeometryLoading?: boolean;
}

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: Array<[number, number]> };
    legs?: Array<{ distance: number; duration: number }>;
  }>;
}

/**
 * Facteur de détour routier moyen (Circuity factor).
 * Les routes réelles (notamment insulaires, périurbaines ou montagneuses) font ~1.4x la distance vol d'oiseau.
 */
export const ROAD_CIRCUITY_FACTOR = 1.42;

/**
 * Vitesse moyenne effective sur route réelle prenant en compte le relief et le trafic (38 km/h).
 */
const AVERAGE_SPEED_KMH = 38;

export function estimateDriveTimeMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const hours = distanceKm / AVERAGE_SPEED_KMH;
  return Math.max(1, Math.round(hours * 60));
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes < 10 ? '0' : ''}${remainingMinutes}m`;
}

/**
 * Calcule la distance totale d'une séquence de points vol d'oiseau
 */
function computeTotalSequenceDistance(
  start: { latitude: number; longitude: number } | null,
  sites: InterventionSite[],
): number {
  if (sites.length === 0) return 0;
  let total = 0;
  let currentLat = start?.latitude ?? sites[0]!.lat;
  let currentLon = start?.longitude ?? sites[0]!.lng;

  const startIndex = start ? 0 : 1;
  for (let i = startIndex; i < sites.length; i++) {
    const next = sites[i]!;
    total += calculateDistanceKm(currentLat, currentLon, next.lat, next.lng);
    currentLat = next.lat;
    currentLon = next.lng;
  }
  return total;
}

/**
 * Optimise l'ordre d'une liste de chantiers (TSP Nearest Neighbor + 2-Opt)
 */
export function optimizeRoute(
  sites: InterventionSite[],
  startPosition?: GeoPosition | null,
): OptimizedRoute {
  if (sites.length === 0) {
    return {
      steps: [],
      totalDistanceKm: 0,
      formattedTotalDistance: '0 km',
      totalEstimatedDriveTimeMinutes: 0,
      formattedTotalTime: '0 min',
      savingsKm: 0,
      googleMapsMultiStopUrl: null,
    };
  }

  const initialDistance = computeTotalSequenceDistance(startPosition ?? null, sites);

  // 1. Algorithme du Plus Proche Voisin (Nearest-Neighbor Heuristic)
  const remaining = [...sites];
  const ordered: InterventionSite[] = [];

  let currentLat = startPosition?.latitude ?? remaining[0]!.lat;
  let currentLon = startPosition?.longitude ?? remaining[0]!.lng;

  if (!startPosition) {
    const first = remaining.shift()!;
    ordered.push(first);
    currentLat = first.lat;
    currentLon = first.lng;
  }

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDistance = calculateDistanceKm(
      currentLat,
      currentLon,
      remaining[0]!.lat,
      remaining[0]!.lng,
    );

    for (let i = 1; i < remaining.length; i++) {
      const dist = calculateDistanceKm(
        currentLat,
        currentLon,
        remaining[i]!.lat,
        remaining[i]!.lng,
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    const nextSite = remaining.splice(nearestIndex, 1)[0]!;
    ordered.push(nextSite);
    currentLat = nextSite.lat;
    currentLon = nextSite.lng;
  }

  // 2. Raffinement 2-Opt (décroisement des arêtes)
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < ordered.length - 1; i++) {
      for (let k = i + 1; k < ordered.length; k++) {
        const newRoute = [...ordered];
        const sub = newRoute.slice(i, k + 1).reverse();
        newRoute.splice(i, k - i + 1, ...sub);

        const currentDist = computeTotalSequenceDistance(startPosition ?? null, ordered);
        const newDist = computeTotalSequenceDistance(startPosition ?? null, newRoute);

        if (newDist < currentDist - 0.01) {
          ordered.length = 0;
          ordered.push(...newRoute);
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  // 3. Construction des étapes avec facteur de détour routier estimé
  let totalDistance = 0;
  let totalMinutes = 0;
  let prevLat = startPosition?.latitude ?? ordered[0]!.lat;
  let prevLon = startPosition?.longitude ?? ordered[0]!.lng;

  const steps: RouteStep[] = ordered.map((site, index) => {
    let distFromPrev = 0;
    if (index === 0 && !startPosition) {
      distFromPrev = 0;
    } else {
      // Application du coefficient routier sur le vol d'oiseau
      const rawDistance = calculateDistanceKm(prevLat, prevLon, site.lat, site.lng);
      distFromPrev = Math.round(rawDistance * ROAD_CIRCUITY_FACTOR * 10) / 10;
    }

    totalDistance += distFromPrev;
    const driveTime = estimateDriveTimeMinutes(distFromPrev);
    totalMinutes += driveTime;

    prevLat = site.lat;
    prevLon = site.lng;

    return {
      site,
      stepNumber: index + 1,
      distanceFromPreviousKm: distFromPrev,
      formattedDistanceFromPrevious: formatDistance(distFromPrev),
      estimatedDriveTimeMinutes: driveTime,
    };
  });

  const savings = Math.max(0, initialDistance * ROAD_CIRCUITY_FACTOR - totalDistance);

  // 4. Génération de l'URL d'itinéraire multi-destinations Google Maps
  let googleMapsUrl: string | null = null;
  if (steps.length > 0) {
    const coordsList = steps.map((s) => `${s.site.lat},${s.site.lng}`);
    if (startPosition) {
      coordsList.unshift(`${startPosition.latitude},${startPosition.longitude}`);
    }
    if (coordsList.length >= 2) {
      googleMapsUrl = `https://www.google.com/maps/dir/${coordsList.join('/')}`;
    }
  }

  return {
    steps,
    totalDistanceKm: Math.round(totalDistance * 10) / 10,
    formattedTotalDistance: formatDistance(totalDistance),
    totalEstimatedDriveTimeMinutes: totalMinutes,
    formattedTotalTime: formatDurationMinutes(totalMinutes),
    savingsKm: Math.round(savings * 10) / 10,
    googleMapsMultiStopUrl: googleMapsUrl,
  };
}

/**
 * Récupère le tracé réel et les métriques réelles depuis le réseau routier OSRM
 */
export async function fetchRealRoadRoute(
  waypoints: Array<{ lat: number; lng: number }>,
): Promise<{
  geometry: [number, number][];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  legs: Array<{ distanceKm: number; durationMinutes: number }>;
} | null> {
  if (waypoints.length < 2) return null;

  try {
    const coordsStr = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const data = (await res.json()) as OsrmRouteResponse;
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route) {
      return null;
    }

    const geometry: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng],
    );

    const totalDistanceKm = Math.round((route.distance / 1000) * 10) / 10;
    const totalDurationMinutes = Math.round(route.duration / 60);

    const legs = (route.legs ?? []).map((leg) => ({
      distanceKm: Math.round((leg.distance / 1000) * 10) / 10,
      durationMinutes: Math.round(leg.duration / 60),
    }));

    return {
      geometry,
      totalDistanceKm,
      totalDurationMinutes,
      legs,
    };
  } catch {
    // Si OSRM est hors-ligne ou timeout, le fallback avec ROAD_CIRCUITY_FACTOR reste actif
    return null;
  }
}

/**
 * Hook React calculant la tournée optimisée enrichie du tracé routier réel OSRM
 */
export function useOptimizedRoadRoute(
  sites: InterventionSite[],
  startPosition?: GeoPosition | null,
): OptimizedRoute {
  // 1. Calcul synchrone immédiat (avec coefficient de détour routier réaliste)
  const initialRoute = useMemo(
    () => optimizeRoute(sites, startPosition),
    [sites, startPosition],
  );

  const routeKey = useMemo(() => {
    const start = startPosition
      ? `${startPosition.latitude},${startPosition.longitude}`
      : 'first-site';
    return `${start}|${sites.map((site) => `${site.id}:${site.lat},${site.lng}`).join('|')}`;
  }, [sites, startPosition]);

  const [resolvedRoute, setResolvedRoute] = useState<{
    key: string;
    route: OptimizedRoute;
  } | null>(null);

  useEffect(() => {
    if (initialRoute.steps.length < 2) return;

    let isMounted = true;
    const waypoints: Array<{ lat: number; lng: number }> = [];
    if (startPosition && !isNaN(startPosition.latitude) && !isNaN(startPosition.longitude)) {
      waypoints.push({ lat: startPosition.latitude, lng: startPosition.longitude });
    }
    initialRoute.steps.forEach((s) => {
      waypoints.push({ lat: s.site.lat, lng: s.site.lng });
    });

    void fetchRealRoadRoute(waypoints).then((osrmResult) => {
      if (!isMounted || !osrmResult) return;

      const updatedSteps = initialRoute.steps.map((step, idx) => {
        const leg = osrmResult.legs[idx];
        if (!leg) return step;
        return {
          ...step,
          distanceFromPreviousKm: leg.distanceKm,
          formattedDistanceFromPrevious: formatDistance(leg.distanceKm),
          estimatedDriveTimeMinutes: leg.durationMinutes,
        };
      });

      setResolvedRoute({
        key: routeKey,
        route: {
          ...initialRoute,
          steps: updatedSteps,
          totalDistanceKm: osrmResult.totalDistanceKm,
          formattedTotalDistance: formatDistance(osrmResult.totalDistanceKm),
          totalEstimatedDriveTimeMinutes: osrmResult.totalDurationMinutes,
          formattedTotalTime: formatDurationMinutes(osrmResult.totalDurationMinutes),
          roadGeometry: osrmResult.geometry,
          isRoadGeometryLoading: false,
        },
      });
    });

    return () => {
      isMounted = false;
    };
  }, [initialRoute, routeKey, startPosition]);

  return resolvedRoute?.key === routeKey ? resolvedRoute.route : initialRoute;
}

/**
 * URLs de navigation pour applications GPS externes tierces
 */
export function getWazeNavigationUrl(latitude: number, longitude: number): string {
  return `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
}

export function getAppleMapsNavigationUrl(latitude: number, longitude: number): string {
  return `https://maps.apple.com/?daddr=${latitude},${longitude}`;
}

export function getGoogleMapsNavigationUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
