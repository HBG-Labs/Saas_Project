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
    <aside className="bg-surface-subtle/50 border-border flex h-full w-full flex-col overflow-hidden rounded-2xl border shadow-xs">
      {/* 1. Header de Recherche & Filtres */}
      <div className="border-border bg-surface space-y-2.5 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="text-foreground truncate text-xs font-extrabold tracking-tight">
              Chantiers & Clients
            </h3>
            <Badge variant="outline" className="px-1.5 py-0 font-mono font-bold">
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
              className="text-3xs text-primary hover:text-primary hover:bg-primary/10 h-6 gap-1 px-2"
              title="Calculer les distances depuis ma position"
            >
              <Crosshair className={cn('size-2.5', isLocatingUser && 'animate-spin')} />
              <span>Proximité</span>
            </Button>
          )}
        </div>

        {/* Onglets Filtres */}
        <div className="bg-surface-subtle border-border text-3xs grid grid-cols-3 gap-1 rounded-xl border p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              'truncate rounded-lg px-1 py-1 text-center font-semibold transition-all',
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
              'flex items-center justify-center gap-1 truncate rounded-lg px-1 py-1 text-center font-semibold transition-all',
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
              'flex items-center justify-center gap-1 truncate rounded-lg px-1 py-1 text-center font-semibold transition-all',
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
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2" />
          <Input
            type="search"
            label="Filtrer la carte"
            hideLabel
            placeholder="Filtrer par réf, client, ville..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-surface h-7 pl-7 text-xs"
          />
        </div>
      </div>
      {/* 2. Liste des éléments */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
        {filtered.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <MapPin className="mx-auto mb-1.5 size-6 opacity-40" />
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
                  'w-full cursor-pointer space-y-2 rounded-xl border p-3 text-left transition-all',
                  isSelected
                    ? isClient
                      ? 'bg-primary/10 border-primary ring-primary/40 shadow-xs ring-1'
                      : 'bg-primary/10 border-primary ring-primary/40 shadow-xs ring-1'
                    : 'bg-surface hover:border-border-strong hover:bg-surface-hover/50 border-border/70',
                )}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-3xs text-foreground font-mono font-bold">
                        {site.reference}
                      </span>
                      <Badge
                        variant={isClient ? 'info' : getPriorityVariant(site.priority)}
                        className="px-1.5 py-0 font-bold"
                      >
                        {isClient ? '🏢 Client' : getPriorityLabel(site.priority)}
                      </Badge>
                      {distance && (
                        <Badge variant="success" className="px-1.5 py-0 font-bold">
                          📍 {distance}
                        </Badge>
                      )}
                    </div>
                    <h4 className="text-foreground mt-1 truncate text-xs font-bold">
                      {site.title}
                    </h4>
                  </div>
                </div>

                <div className="text-3xs text-muted-foreground space-y-0.5">
                  {!isClient && (
                    <p className="text-foreground truncate font-medium">{site.clientName}</p>
                  )}
                  <p className="text-muted-foreground flex items-start gap-1 truncate">
                    <MapPin className="mt-0.5 size-2.5 shrink-0 opacity-70" />
                    <span className="truncate">{site.address}</span>
                  </p>
                  {site.phone && <p className="text-muted-foreground truncate">📞 {site.phone}</p>}
                </div>

                <div className="border-border/50 flex items-center gap-1.5 border-t pt-1">
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
                    className="text-3xs h-6 flex-1 justify-center gap-1 px-2"
                    title="Lancer l'application de navigation GPS"
                  >
                    <Navigation className="text-primary size-2.5" />
                    <span>Itinéraire</span>
                  </Button>

                  {isClient ? (
                    <>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="text-3xs h-6 gap-1 px-2"
                        onClick={(e) => e.stopPropagation()}
                        title="Créer une mission pour ce client"
                      >
                        <Link to={ROUTES.missionNew}>
                          <PlusCircle className="text-primary size-2.5" />
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
