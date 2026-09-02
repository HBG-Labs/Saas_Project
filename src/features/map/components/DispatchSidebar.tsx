import {
  MapPin,
  Navigation,
  ExternalLink,
  Crosshair,
  Search,
  Building2,
  Briefcase,
  PlusCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/config/routes';
import { activateOnKey } from '@/lib/activate-on-key';
import { cn } from '@/lib/cn';
import { openNavigationApp } from '@/features/geo';
import type { InterventionSite } from '../types';

interface DispatchSidebarProps {
  interventions: InterventionSite[];
  selectedSiteId: string | null;
  onSelectSite: (id: string) => void;
  distancesMap?: Record<string, string>; // siteId => formatted distance (e.g. "1,2 km")
  onLocateUser?: () => void;
  isLocatingUser?: boolean;
}

export function DispatchSidebar({
  interventions,
  selectedSiteId,
  onSelectSite,
  distancesMap = {},
  onLocateUser,
  isLocatingUser = false,
}: DispatchSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'missions' | 'clients'>('all');

  const missionsCount = interventions.filter((s) => s.kind !== 'client').length;
  const clientsCount = interventions.filter((s) => s.kind === 'client').length;

  const filtered = interventions.filter((site) => {
    // Filtre par onglet
    if (activeTab === 'missions' && site.kind === 'client') return false;
    if (activeTab === 'clients' && site.kind !== 'client') return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      site.reference.toLowerCase().includes(term) ||
      site.title.toLowerCase().includes(term) ||
      site.clientName.toLowerCase().includes(term) ||
      site.address.toLowerCase().includes(term)
    );
  });

  const getPriorityVariant = (p: InterventionSite['priority']) => {
    switch (p) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'primary';
      default:
        return 'outline';
    }
  };

  const getPriorityLabel = (p: InterventionSite['priority']) => {
    switch (p) {
      case 'urgent':
        return 'Urgent';
      case 'high':
        return 'Haute';
      case 'normal':
        return 'Normale';
      default:
        return 'Basse';
    }
  };

  return (
    <aside className="w-full h-full flex flex-col bg-surface-subtle/50 rounded-2xl border border-border overflow-hidden shadow-xs">
      {/* 1. Header de Recherche & Filtres */}
      <div className="p-3 border-b border-border bg-surface space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-extrabold text-xs text-foreground tracking-tight truncate">
              Chantiers & Clients
            </h3>
            <Badge variant="outline" className="font-mono font-bold px-1.5 py-0">
              {filtered.length}
            </Badge>
          </div>

          {onLocateUser && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLocateUser}
              disabled={isLocatingUser}
              className="text-3xs h-6 px-2 gap-1 text-primary hover:text-primary hover:bg-primary/10"
              title="Calculer les distances depuis ma position"
            >
              <Crosshair className={cn('size-2.5', isLocatingUser && 'animate-spin')} />
              <span>Proximité</span>
            </Button>
          )}
        </div>

        {/* Onglets Filtres */}
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-surface-subtle rounded-xl border border-border text-3xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              'py-1 font-semibold rounded-lg transition-all text-center truncate px-1',
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Tous ({interventions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('missions')}
            className={cn(
              'py-1 font-semibold rounded-lg transition-all text-center flex items-center justify-center gap-1 truncate px-1',
              activeTab === 'missions'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Briefcase className="size-2.5 shrink-0" />
            <span className="truncate">Missions ({missionsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clients')}
            className={cn(
              'py-1 font-semibold rounded-lg transition-all text-center flex items-center justify-center gap-1 truncate px-1',
              activeTab === 'clients'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Building2 className="size-2.5 shrink-0" />
            <span className="truncate">Clients ({clientsCount})</span>
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Filtrer par réf, client, ville..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs pl-7 h-7 bg-surface"
          />
        </div>
      </div>
      {/* 2. Liste des éléments */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="size-6 mx-auto mb-1.5 opacity-40" />
            <p className="text-xs font-medium">Aucun lieu géolocalisé</p>
            <p className="text-3xs mt-0.5">
              {searchTerm
                ? 'Aucun résultat pour cette recherche'
                : 'Les missions et clients avec coordonnées GPS apparaîtront ici'}
            </p>
          </div>
        ) : (
          filtered.map((site) => {
            const isSelected = selectedSiteId === site.id;
            const distance = distancesMap[site.id];
            const isClient = site.kind === 'client';

            return (
              <div
                key={site.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSite(site.id)}
                onKeyDown={activateOnKey(() => onSelectSite(site.id))}
                className={cn(
                  'w-full text-left p-3 rounded-xl border transition-all cursor-pointer space-y-2',
                  isSelected
                    ? isClient
                      ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40'
                      : 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40'
                    : 'bg-surface hover:border-border-strong hover:bg-surface-hover/50 border-border/70',
                )}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-3xs font-bold text-foreground">
                        {site.reference}
                      </span>
                      <Badge
                        variant={isClient ? 'info' : getPriorityVariant(site.priority)}
                        className="px-1.5 py-0 font-bold"
                      >
                        {isClient ? '🏢 Client' : getPriorityLabel(site.priority)}
                      </Badge>
                      {distance && (
                        <Badge
                          variant="success"
                          className="px-1.5 py-0 font-bold"
                        >
                          📍 {distance}
                        </Badge>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-foreground truncate mt-1">
                      {site.title}
                    </h4>
                  </div>
                </div>

                <div className="text-3xs text-muted-foreground space-y-0.5">
                  {!isClient && (
                    <p className="font-medium text-foreground truncate">{site.clientName}</p>
                  )}
                  <p className="flex items-start gap-1 text-muted-foreground truncate">
                    <MapPin className="size-2.5 mt-0.5 shrink-0 opacity-70" />
                    <span className="truncate">{site.address}</span>
                  </p>
                  {site.phone && (
                    <p className="text-muted-foreground truncate">📞 {site.phone}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openNavigationApp({
                        latitude: site.lat,
                        longitude: site.lng,
                        address: site.address,
                      });
                    }}
                    className="text-3xs h-6 px-2 flex-1 justify-center gap-1"
                    title="Lancer l'application de navigation GPS"
                  >
                    <Navigation className="size-2.5 text-primary" />
                    <span>Itinéraire</span>
                  </Button>

                  {isClient ? (
                    <>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="text-3xs h-6 px-2 gap-1"
                        onClick={(e) => e.stopPropagation()}
                        title="Créer une mission pour ce client"
                      >
                        <Link to={ROUTES.missionNew}>
                          <PlusCircle className="size-2.5 text-primary" />
                          <span>Mission</span>
                        </Link>
                      </Button>
                      {site.customerId && (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="text-3xs h-6 px-2"
                          onClick={(e) => e.stopPropagation()}
                          title="Consulter la fiche client"
                        >
                          <Link to={ROUTES.customer(site.customerId)}>
                            <ExternalLink className="size-2.5" />
                          </Link>
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="text-3xs h-6 px-2"
                      onClick={(e) => e.stopPropagation()}
                      title="Consulter la fiche mission"
                    >
                      <Link to={ROUTES.mission(site.id)}>
                        <ExternalLink className="size-2.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
