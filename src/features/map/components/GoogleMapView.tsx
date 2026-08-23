import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Maximize2,
  Minimize2,
  Crosshair,
  Compass,
  Navigation,
  MapPin,
  ExternalLink,
  PlusCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useDefaultTerritory } from '@/config/territories';
import { cn } from '@/lib/cn';
import { openNavigationApp } from '@/features/geo';
import type { GeoPosition } from '@/features/geo';
import type { InterventionSite, MapLayerMode } from '../types';

interface GoogleMapViewProps {
  interventions: InterventionSite[];
  selectedSiteId: string | null;
  onSelectSite: (id: string) => void;
  layerMode: MapLayerMode;
  onLayerModeChange: (mode: MapLayerMode) => void;
  userPosition?: GeoPosition | null;
  onLocateUser?: () => void;
  isLocatingUser?: boolean;
}

export function GoogleMapView({
  interventions,
  selectedSiteId,
  onSelectSite,
  layerMode,
  onLayerModeChange,
  userPosition,
  onLocateUser,
  isLocatingUser = false,
}: GoogleMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerLayerRef = useRef<L.LayerGroup | null>(null);

  const { territory } = useDefaultTerritory();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const getTileUrl = (mode: MapLayerMode) => {
    switch (mode) {
      case 'dark_cockpit':
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      case 'satellite':
        return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case 'roadmap':
      default:
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    }
  };

  // 1. Initialisation sécurisée de la carte Leaflet (robuste face au StrictMode / Fast Refresh)
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Si Leaflet a déjà un ID sur le conteneur ou si une instance existe, nettoyer proprement
    const containerWithLeaflet = container as unknown as { _leaflet_id?: number | null };
    if (containerWithLeaflet._leaflet_id != null) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      containerWithLeaflet._leaflet_id = null;
    }

    if (!mapInstanceRef.current) {
      const map = L.map(container, {
        center: territory.center,
        zoom: territory.zoom,
        zoomControl: false,
      });

      const tiles = L.tileLayer(getTileUrl(layerMode), {
        maxZoom: 19,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3', 'a', 'b', 'c', 'd'],
        attribution: '&copy; OpenStreetMap & Google Maps',
      }).addTo(map);

      tileLayerRef.current = tiles;
      markersLayerRef.current = L.layerGroup().addTo(map);
      userMarkerLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (container) {
        (container as unknown as { _leaflet_id?: number | null })._leaflet_id = null;
      }
    };
    // Volontairement vide : cet effet CRÉE la carte Leaflet une seule fois
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Mise à jour du calque de tuiles (mode satellite, roadmap, dark)
  useEffect(() => {
    if (mapInstanceRef.current && tileLayerRef.current) {
      tileLayerRef.current.setUrl(getTileUrl(layerMode));
    }
  }, [layerMode]);

  // 3. Position utilisateur ponctuelle
  useEffect(() => {
    const userGroup = userMarkerLayerRef.current;
    const map = mapInstanceRef.current;
    if (!userGroup || !map) return;

    userGroup.clearLayers();

    if (userPosition) {
      const userLat = userPosition.latitude;
      const userLng = userPosition.longitude;

      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div style="
            position: relative;
            width: 22px;
            height: 22px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              background: rgba(59, 130, 246, 0.4);
              animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
            <div style="
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: #2563eb;
              border: 3px solid #ffffff;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const userMarker = L.marker([userLat, userLng], { icon: userIcon });
      userMarker.bindTooltip('📍 Ma position (±' + Math.round(userPosition.accuracy) + 'm)', {
        permanent: false,
        direction: 'top',
      });
      userGroup.addLayer(userMarker);

      map.flyTo([userLat, userLng], 15, {
        animate: true,
        duration: 1,
      });
    }
  }, [userPosition]);

  // 4. Rendu des marqueurs de chantiers / interventions
  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    const map = mapInstanceRef.current;
    if (!markersGroup || !map) return;

    markersGroup.clearLayers();

    interventions.forEach((site) => {
      const isSelected = selectedSiteId === site.id;
      const isClient = site.kind === 'client';

      let pinColor = '#2563eb'; // Bleu standard
      if (isClient) {
        pinColor = '#0891b2'; // Cyan client
      } else if (site.priority === 'urgent') {
        pinColor = '#ef4444'; // Rouge urgent
      } else if (site.priority === 'high') {
        pinColor = '#f59e0b'; // Ambre haute
      }

      const customSiteIcon = L.divIcon({
        className: 'custom-site-pin',
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            cursor: pointer;
            transform: ${isSelected ? 'scale(1.12)' : 'scale(1)'};
            transition: transform 0.15s ease;
          ">
            <!-- 1. Pin aiguille avec pointe au sol précise -->
            <div style="
              position: relative;
              width: 26px;
              height: 34px;
              flex-shrink: 0;
              filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));
            ">
              <svg viewBox="0 0 26 34" width="26" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 0C5.82 0 0 5.82 0 13c0 9.8 13 21 13 21s13-11.2 13-21c0-7.18-5.82-13-13-13z" fill="${pinColor}" stroke="#ffffff" stroke-width="2"/>
                <circle cx="13" cy="13" r="5" fill="#ffffff"/>
              </svg>
              <span style="
                position: absolute;
                top: 10px;
                left: 10px;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: ${pinColor};
              "></span>
            </div>

            <!-- 2. Badge texte flottant à droite pour libérer la vue du terrain -->
            <div style="
              margin-left: 3px;
              margin-bottom: 12px;
              padding: 3px 7px;
              background: ${isSelected ? '#0f172a' : 'rgba(15, 23, 42, 0.9)'};
              color: #ffffff;
              border-radius: 7px;
              border: 1.5px solid ${isSelected ? '#93c5fd' : 'rgba(255,255,255,0.3)'};
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
              backdrop-filter: blur(4px);
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">
              ${isClient ? '🏢 ' + site.title : site.reference}
            </div>
          </div>
        `,
        iconSize: [160, 34],
        iconAnchor: [13, 34],
      });

      const marker = L.marker([site.lat, site.lng], { icon: customSiteIcon });
      marker.on('click', () => {
        onSelectSite(site.id);
      });
      markersGroup.addLayer(marker);
    });

    // Si un site spécifique est sélectionné, centrer dessus
    const activeSite = interventions.find((s) => s.id === selectedSiteId);
    if (activeSite) {
      map.flyTo([activeSite.lat, activeSite.lng], 15, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [interventions, selectedSiteId, onSelectSite]);

  const handleFitBounds = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (interventions.length === 0) {
      map.flyTo(territory.center, territory.zoom, { animate: true, duration: 0.8 });
      return;
    }

    const bounds = L.latLngBounds(interventions.map((s) => [s.lat, s.lng] as [number, number]));
    if (userPosition) {
      bounds.extend([userPosition.latitude, userPosition.longitude]);
    }
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  };

  const selectedSite = interventions.find((s) => s.id === selectedSiteId);

  return (
    <div
      className={cn(
        'relative w-full h-full rounded-2xl overflow-hidden border border-border shadow-xs bg-slate-900',
        isFullscreen && 'fixed inset-0 z-50 rounded-none border-none',
      )}
    >
      {/* Conteneur DOM Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Sélecteur de type de fond de carte (Haut Gauche) */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
        <div className="bg-surface/90 backdrop-blur-md p-1 rounded-xl border border-border shadow-md flex items-center gap-1">
          <button
            type="button"
            onClick={() => onLayerModeChange('roadmap')}
            className={cn(
              'px-2.5 py-1 text-3xs font-bold rounded-lg transition-all',
              layerMode === 'roadmap'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Plan
          </button>
          <button
            type="button"
            onClick={() => onLayerModeChange('satellite')}
            className={cn(
              'px-2.5 py-1 text-3xs font-bold rounded-lg transition-all',
              layerMode === 'satellite'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => onLayerModeChange('dark_cockpit')}
            className={cn(
              'px-2.5 py-1 text-3xs font-bold rounded-lg transition-all',
              layerMode === 'dark_cockpit'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Sombre
          </button>
        </div>
      </div>

      {/* Contrôles d'actions flottants à droite */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        {/* Bouton « Ma position » ponctuelle */}
        {onLocateUser && (
          <button
            type="button"
            onClick={onLocateUser}
            disabled={isLocatingUser}
            className={cn(
              'size-9 rounded-xl flex items-center justify-center border shadow-md transition-all',
              userPosition
                ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20'
                : 'bg-surface/90 backdrop-blur-md text-foreground border-border hover:bg-surface',
            )}
            title="📍 Ma position (Localisation ponctuelle)"
          >
            <Crosshair
              className={cn('size-4', isLocatingUser && 'animate-spin text-primary')}
            />
          </button>
        )}

        {/* Bouton recentrer tous les chantiers */}
        <button
          type="button"
          onClick={handleFitBounds}
          className="size-9 rounded-xl bg-surface/90 backdrop-blur-md text-foreground border border-border shadow-md flex items-center justify-center hover:bg-surface transition-all"
          title="Vue globale de tous les chantiers"
        >
          <Compass className="size-4" />
        </button>

        {/* Bouton plein écran */}
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="size-9 rounded-xl bg-surface/90 backdrop-blur-md text-foreground border border-border shadow-md flex items-center justify-center hover:bg-surface transition-all"
          title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        >
          {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </div>

      {/* Fiche détaillée flottante du chantier / client sélectionné */}
      {selectedSite && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm z-10 bg-surface/95 backdrop-blur-md p-3.5 rounded-2xl border border-border shadow-xl space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-3xs font-bold text-foreground">
                  {selectedSite.reference}
                </span>
                <Badge
                  variant={selectedSite.kind === 'client' ? 'info' : 'primary'}
                  className="text-4xs px-1.5 py-0 font-bold"
                >
                  {selectedSite.kind === 'client' ? '🏢 Client' : selectedSite.tradeLabel}
                </Badge>
              </div>
              <h4 className="text-xs font-bold text-foreground mt-1">{selectedSite.title}</h4>
            </div>
            <button
              type="button"
              onClick={() => onSelectSite('')}
              className="text-muted-foreground hover:text-foreground text-xs p-1 rounded-md"
            >
              ✕
            </button>
          </div>

          <div className="text-3xs text-muted-foreground space-y-0.5">
            {selectedSite.kind !== 'client' && (
              <p className="font-medium text-foreground">{selectedSite.clientName}</p>
            )}
            <p className="flex items-start gap-1">
              <MapPin className="size-3 shrink-0 mt-0.5 opacity-70" />
              <span>{selectedSite.address}</span>
            </p>
            {selectedSite.phone && (
              <p className="text-muted-foreground">📞 {selectedSite.phone}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                openNavigationApp({
                  latitude: selectedSite.lat,
                  longitude: selectedSite.lng,
                  address: selectedSite.address,
                });
              }}
              className="flex-1 justify-center gap-1.5 h-7 text-3xs"
            >
              <Navigation className="size-3" />
              <span>🧭 Itinéraire</span>
            </Button>

            {selectedSite.kind === 'client' ? (
              <>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-7 text-3xs px-2 gap-1"
                  title="Créer une mission pour ce client"
                >
                  <Link to={ROUTES.missionNew}>
                    <PlusCircle className="size-3 text-primary" />
                    <span>Mission</span>
                  </Link>
                </Button>
                {selectedSite.customerId && (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-7 text-3xs px-2"
                    title="Consulter la fiche client"
                  >
                    <Link to={ROUTES.customer(selectedSite.customerId)}>
                      <ExternalLink className="size-3" />
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-7 text-3xs px-2 gap-1"
                title="Consulter la fiche mission"
              >
                <Link to={ROUTES.mission(selectedSite.id)}>
                  <ExternalLink className="size-3" />
                  <span>Fiche</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
