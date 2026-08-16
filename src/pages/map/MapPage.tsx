import { useState } from 'react';
import {
  RefreshCw,
  Compass,
  Users,
  Map as MapIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCurrentOrganization } from '@/features/organizations';
import { GoogleMapView } from '@/features/map/components/GoogleMapView';
import { DispatchSidebar } from '@/features/map/components/DispatchSidebar';
import {
  INITIAL_TECHNICIANS,
  INITIAL_INTERVENTIONS,
} from '@/features/map/mock-geo-data';
import type { MapLayerMode } from '@/features/map/types';

export default function MapPage() {
  const { organization } = useCurrentOrganization();

  const [technicians] = useState(INITIAL_TECHNICIANS);
  const [interventions] = useState(INITIAL_INTERVENTIONS);
  const [selectedTechId, setSelectedTechId] = useState<string | null>('tech-1');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [layerMode, setLayerMode] = useState<MapLayerMode>('roadmap');
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const handleSelectTech = (id: string) => {
    setSelectedTechId(id);
    setSelectedSiteId(null);
    // On mobile, automatically switch to map when technician is clicked
    setMobileTab('map');
  };

  const handleSelectSite = (id: string) => {
    setSelectedSiteId(id);
    const site = interventions.find((s) => s.id === id);
    if (site?.assignedTechnicianName) {
      const tech = technicians.find((t) => t.name === site.assignedTechnicianName);
      if (tech) setSelectedTechId(tech.id);
    }
  };

  const organizationName = organization?.name ?? 'Île-de-France';

  return (
    <div className="space-y-3 sm:space-y-4 max-w-7xl mx-auto pb-6">
      {/* 1. Header de Cartographie & Contrôles Temps Réel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 sm:p-4 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-7 sm:size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Compass className="size-3.5 sm:size-4" />
            </div>
            <h1 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
              Carte & Géolocalisation
            </h1>
            <Badge variant="outline" className="hidden sm:inline-flex text-3xs font-mono">
              Google Maps
            </Badge>
          </div>
          <p className="text-3xs sm:text-xs text-muted-foreground mt-0.5">
            {technicians.length} intervenants · Secteur {organizationName}
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2 justify-between sm:justify-end flex-wrap">
          {/* Mobile View Switcher (Tab pills) */}
          <div className="flex lg:hidden items-center bg-surface-subtle p-0.5 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setMobileTab('map')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                mobileTab === 'map'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MapIcon className="size-3" />
              Carte
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('list')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                mobileTab === 'list'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="size-3" />
              Équipe ({technicians.length})
            </button>
          </div>

          {/* Live Status Toggle */}
          <button
            type="button"
            onClick={() => setIsLiveActive(!isLiveActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-xl border text-3xs sm:text-xs font-bold transition-all shadow-xs ${
              isLiveActive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-surface text-muted-foreground border-border'
            }`}
          >
            <span className="relative flex size-2">
              {isLiveActive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full size-2 ${
                  isLiveActive ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
            </span>
            <span className="hidden sm:inline">{isLiveActive ? 'Temps réel ON' : 'PAUSE'}</span>
            <span className="sm:hidden">{isLiveActive ? 'LIVE' : 'OFF'}</span>
          </button>

          {/* Refresh Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-7 sm:h-8 px-2 sm:px-3 text-xs gap-1"
            title="Rafraîchir les positions GPS"
          >
            <RefreshCw className={`size-3 sm:size-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
        </div>
      </div>

      {/* 2. Main Map Area (Responsive layout with mobile view switcher) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-170px)] sm:h-[calc(100vh-210px)] min-h-[500px] max-h-[900px]">
        {/* Left Dispatch Sidebar: Hidden on mobile when mobileTab === 'map', visible on desktop */}
        <div
          className={`lg:col-span-4 h-full ${
            mobileTab === 'list' ? 'block' : 'hidden lg:block'
          }`}
        >
          <DispatchSidebar
            technicians={technicians}
            selectedTechId={selectedTechId}
            onSelectTech={handleSelectTech}
          />
        </div>

        {/* Center / Right Interactive Google Map Canvas: Hidden on mobile when mobileTab === 'list', visible on desktop */}
        <div
          className={`lg:col-span-8 h-full ${
            mobileTab === 'map' ? 'block' : 'hidden lg:block'
          }`}
        >
          <GoogleMapView
            technicians={technicians}
            interventions={interventions}
            selectedTechId={selectedTechId}
            selectedSiteId={selectedSiteId}
            onSelectTech={handleSelectTech}
            onSelectSite={handleSelectSite}
            layerMode={layerMode}
            onLayerModeChange={setLayerMode}
            activeTradeFilter={null}
          />
        </div>
      </div>
    </div>
  );
}
