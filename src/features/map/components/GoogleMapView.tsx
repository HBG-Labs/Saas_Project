import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  Crosshair,
  Compass,
  Phone,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { TechnicianLocation, InterventionSite, MapLayerMode } from '../types';

interface GoogleMapViewProps {
  technicians: TechnicianLocation[];
  interventions: InterventionSite[];
  selectedTechId: string | null;
  selectedSiteId: string | null;
  onSelectTech: (id: string) => void;
  onSelectSite: (id: string) => void;
  layerMode: MapLayerMode;
  onLayerModeChange: (mode: MapLayerMode) => void;
  activeTradeFilter: string | null;
}

export function GoogleMapView({
  technicians,
  interventions,
  selectedTechId,
  onSelectTech,
  onSelectSite,
  layerMode,
  onLayerModeChange,
}: GoogleMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedTech, setSelectedTech] = useState<TechnicianLocation | null>(null);
  const [isCardVisible, setIsCardVisible] = useState<boolean>(true);

  // Tile layers definition
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

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [48.8566, 2.3522],
        zoom: 13,
        zoomControl: false,
      });

      const tiles = L.tileLayer(
        'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        {
          maxZoom: 19,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3', 'a', 'b', 'c', 'd'],
          attribution: '&copy; Google Maps',
        },
      ).addTo(map);

      tileLayerRef.current = tiles;
      markersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Update Tile Layer on mode change
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    tileLayerRef.current.setUrl(getTileUrl(layerMode));
  }, [layerMode]);

  // 3. Update Markers & Routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    const routeGroup = routeLayerRef.current;

    if (!map || !markersGroup || !routeGroup) return;

    markersGroup.clearLayers();
    routeGroup.clearLayers();

    const activeTech = technicians.find((t) => t.id === selectedTechId) ?? technicians[0];
    setSelectedTech(activeTech ?? null);
    setIsCardVisible(true);

    // Add Intervention Site Markers
    interventions.forEach((site) => {
      const isAssignedToSelectedTech =
        activeTech && activeTech.name === site.assignedTechnicianName;

      const getTradeBg = (trade: string) => {
        switch (trade) {
          case 'fiber_telecom':
            return '#f59e0b';
          case 'hvac':
            return '#06b6d4';
          case 'electrical':
            return '#eab308';
          case 'plumbing':
            return '#2563eb';
          case 'landscaping':
            return '#10b981';
          default:
            return '#3b82f6';
        }
      };

      const customSiteIcon = L.divIcon({
        className: 'custom-site-pin',
        html: `
          <div style="
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            background: rgba(15, 23, 42, 0.92);
            color: #ffffff;
            border-radius: 12px;
            border: 2px solid ${isAssignedToSelectedTech ? '#3b82f6' : 'rgba(255,255,255,0.2)'};
            box-shadow: 0 4px 14px rgba(0,0,0,0.3);
            font-family: sans-serif;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            transform: translate(-50%, -50%);
            white-space: nowrap;
          ">
            <span style="
              width: 14px;
              height: 14px;
              border-radius: 4px;
              background: ${getTradeBg(site.trade)};
              display: inline-block;
            "></span>
            <span>${site.reference}</span>
          </div>
        `,
        iconSize: [100, 30],
        iconAnchor: [50, 15],
      });

      const marker = L.marker([site.lat, site.lng], { icon: customSiteIcon });
      marker.on('click', () => {
        onSelectSite(site.id);
      });
      markersGroup.addLayer(marker);
    });

    // Add Technicians Markers
    technicians.forEach((tech) => {
      const isSelected = selectedTechId === tech.id;

      const techIcon = L.divIcon({
        className: 'custom-tech-pin',
        html: `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 10px;
            background: ${isSelected ? '#2563eb' : 'rgba(15, 23, 42, 0.95)'};
            color: #ffffff;
            border-radius: 16px;
            border: 2px solid ${isSelected ? '#60a5fa' : 'rgba(255,255,255,0.25)'};
            box-shadow: 0 6px 20px rgba(0,0,0,0.4);
            font-family: sans-serif;
            cursor: pointer;
            transform: translate(-50%, -50%) ${isSelected ? 'scale(1.1)' : 'scale(1)'};
            transition: all 0.2s ease;
          ">
            <div style="
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: ${isSelected ? '#ffffff' : '#3b82f6'};
              color: ${isSelected ? '#2563eb' : '#ffffff'};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: 800;
            ">
              ${tech.initials}
            </div>
            <div style="text-align: left;">
              <div style="font-size: 12px; font-weight: 700; line-height: 1.1;">${tech.name}</div>
              <div style="font-size: 9px; opacity: 0.85; line-height: 1.1;">
                ${tech.status === 'on_road' ? `🚗 ${tech.speedKmH} km/h` : '📍 Sur site'}
              </div>
            </div>
          </div>
        `,
        iconSize: [120, 36],
        iconAnchor: [60, 18],
      });

      const marker = L.marker([tech.currentLat, tech.currentLng], { icon: techIcon });
      marker.on('click', () => {
        onSelectTech(tech.id);
      });
      markersGroup.addLayer(marker);

      // If this is the selected technician, draw their route to their mission destination
      if (isSelected && tech.currentMission) {
        const routeLine = L.polyline(
          [
            [tech.currentLat, tech.currentLng],
            [tech.currentMission.destinationLat, tech.currentMission.destinationLng],
          ],
          {
            color: '#3b82f6',
            weight: 4,
            dashArray: '8, 8',
            opacity: 0.9,
          },
        );
        routeGroup.addLayer(routeLine);
      }
    });

    // Center map on selected technician if one is active
    if (activeTech) {
      map.flyTo([activeTech.currentLat, activeTech.currentLng], 14, {
        animate: true,
        duration: 0.8,
      });
    }
  }, [technicians, interventions, selectedTechId, onSelectTech, onSelectSite]);

  const handleFitBounds = () => {
    const map = mapInstanceRef.current;
    if (!map || technicians.length === 0) return;

    const bounds = L.latLngBounds(technicians.map((t) => [t.currentLat, t.currentLng]));
    interventions.forEach((s) => bounds.extend([s.lat, s.lng]));
    map.fitBounds(bounds, { padding: [50, 50] });
  };

  return (
    <div
      className={cn(
        'relative w-full h-full min-h-[540px] overflow-hidden select-none rounded-2xl border border-border shadow-xs',
        isFullscreen && 'fixed inset-0 z-50 rounded-none border-none',
      )}
    >
      {/* Real Leaflet Map Container with Google Maps tiles */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top-Right Floating Controls (Layer Selector & Zoom & Recenter) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        {/* Layer Mode Picker */}
        <div className="flex items-center gap-1 bg-surface/90 backdrop-blur-md p-1 rounded-xl border border-border shadow-lg">
          <button
            type="button"
            onClick={() => onLayerModeChange('roadmap')}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all',
              layerMode === 'roadmap'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover',
            )}
          >
            Google Plan
          </button>
          <button
            type="button"
            onClick={() => onLayerModeChange('dark_cockpit')}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1',
              layerMode === 'dark_cockpit'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover',
            )}
          >
            <Sparkles className="size-3" />
            Mode Nuit
          </button>
          <button
            type="button"
            onClick={() => onLayerModeChange('satellite')}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1',
              layerMode === 'satellite'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover',
            )}
          >
            <Layers className="size-3" />
            Satellite
          </button>
        </div>

        {/* Zoom & Centering actions */}
        <div className="flex flex-col bg-surface/90 backdrop-blur-md rounded-xl border border-border shadow-lg divide-y divide-border self-end">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="p-2 text-foreground hover:bg-surface-hover hover:text-primary transition-colors text-sm font-bold flex items-center justify-center size-8"
            title="Zoomer (+)"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="p-2 text-foreground hover:bg-surface-hover hover:text-primary transition-colors text-sm font-bold flex items-center justify-center size-8"
            title="Dézoomer (-)"
          >
            −
          </button>
          <button
            type="button"
            onClick={handleFitBounds}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-surface-hover transition-colors flex items-center justify-center size-8"
            title="Recentrer sur la flotte"
          >
            <Crosshair className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-surface-hover transition-colors flex items-center justify-center size-8"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      {/* Top-Left Quick Info Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-2 bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border shadow-lg">
          <span className="relative flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold text-foreground">
            {technicians.length} Techniciens géolocalisés
          </span>
          <span className="text-border">|</span>
          <span className="text-3xs text-muted-foreground font-medium">
            Fonds : Google Maps Réel
          </span>
        </div>
      </div>

      {/* Bottom-Left Micro Focus Card (Compact, Non-Obtrusive, Dismissible) */}
      {selectedTech && isCardVisible && (
        <div className="absolute bottom-3 left-3 z-10 max-w-[270px] sm:max-w-[290px] w-full bg-surface/95 backdrop-blur-md rounded-xl border border-border shadow-lg p-2.5 animate-in fade-in slide-in-from-bottom-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xs border border-primary/20 shrink-0">
                {selectedTech.initials}
              </div>
              <div className="min-w-0">
                <h4 className="text-2xs font-bold text-foreground truncate leading-tight">
                  {selectedTech.name}
                </h4>
                <p className="text-3xs text-muted-foreground truncate leading-tight">
                  {selectedTech.status === 'on_road' ? `${selectedTech.speedKmH} km/h` : 'Sur site'} · 🔋 {selectedTech.batteryPct}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge
                variant={selectedTech.status === 'on_road' ? 'primary' : 'success'}
                className="text-3xs px-1.5 py-0.2"
              >
                {selectedTech.status === 'on_road' ? 'En route' : 'Sur site'}
              </Badge>
              <button
                type="button"
                onClick={() => setIsCardVisible(false)}
                className="text-muted-foreground hover:text-foreground text-3xs p-0.5"
                title="Masquer la carte"
              >
                ✕
              </button>
            </div>
          </div>

          {selectedTech.currentMission && (
            <div className="mt-1.5 pt-1.5 border-t border-border/50 text-3xs flex items-center justify-between text-muted-foreground">
              <span className="font-semibold text-foreground truncate max-w-[170px]">
                {selectedTech.currentMission.title}
              </span>
              <span className="font-mono text-primary font-bold shrink-0">
                {selectedTech.currentMission.estimatedArrival}
              </span>
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5 pt-1 border-t border-border/40">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-3xs h-6.5 px-2 gap-1"
              onClick={() => window.open(`tel:${selectedTech.phone}`)}
            >
              <Phone className="size-2.5" />
              Appeler
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="flex-1 text-3xs h-6.5 px-2 gap-1"
              onClick={() => {
                const query = encodeURIComponent(selectedTech.currentMission?.clientAddress ?? '');
                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
              }}
            >
              <Compass className="size-2.5" />
              Itinéraire
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
