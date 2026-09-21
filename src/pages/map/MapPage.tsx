import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Compass, Map as MapIcon, List, Crosshair, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import { useCurrentIndustry } from '@/features/industries';
import { useMissions } from '@/features/missions';
import { useCustomers, useOrganizationSites } from '@/features/customers';
import { useCurrentOrganization } from '@/features/organizations';
import {
  GoogleMapView,
  DispatchSidebar,
  toInterventionSite,
  siteToMapItem,
  customerToMapItem,
  type MapLayerMode,
  type InterventionSite,
} from '@/features/map';
import {
  useGeolocation,
  calculateDistanceKm,
  formatDistance,
  useGeocodedAddresses,
} from '@/features/geo';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function MapPage() {
  useDocumentTitle('Cartographie & Chantiers');

  const { organization } = useCurrentOrganization();
  const { code: industry, label: industryLabel } = useCurrentIndustry();
  const organizationId = organization?.id ?? null;

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [layerMode, setLayerMode] = useState<MapLayerMode>('roadmap');
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');
  const [radiusKm, setRadiusKm] = useState<number | null>(null);

  // 2. Chargement de toutes les missions de l'organisation
  const missionsQuery = useMissions(organizationId, {
    limit: 500,
  });
  const missions = useMemo(() => missionsQuery.data ?? [], [missionsQuery.data]);

  // 3. Chargement des clients et de leurs sites
  const customersQuery = useCustomers(organizationId);
  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);

  const sitesQuery = useOrganizationSites(organizationId);
  const sites = useMemo(() => sitesQuery.data ?? [], [sitesQuery.data]);

  const customersMap = useMemo(() => {
    const map = new Map<string, (typeof customers)[number]>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const sitesMap = useMemo(() => {
    const map = new Map<string, (typeof sites)[number]>();
    sites.forEach((s) => map.set(s.id, s));
    return map;
  }, [sites]);

  const sitesByCustomerId = useMemo(() => {
    const set = new Set<string>();
    sites.forEach((s) => {
      if (s.latitude !== null && s.longitude !== null) {
        set.add(s.customer_id);
      }
    });
    return set;
  }, [sites]);

  const firstSiteCoordsByCustomerId = useMemo(() => {
    const map = new Map<string, { latitude: number; longitude: number }>();
    sites.forEach((s) => {
      if (s.latitude !== null && s.longitude !== null && !map.has(s.customer_id)) {
        map.set(s.customer_id, { latitude: s.latitude, longitude: s.longitude });
      }
    });
    return map;
  }, [sites]);

  // Géocodage des lignes antérieures, sans coordonnées enregistrées.
  //
  // Une requête par ADRESSE, mise en cache un mois. Les deux effets précédents
  // rappelaient le service à chaque visite, et leurs dépendances contenaient
  // l'état qu'ils écrivaient.
  const customersToGeocode = useMemo(
    () =>
      customers
        .filter((customer) => !sitesByCustomerId.has(customer.id))
        .filter(
          (customer) =>
            customer.address_line1 != null &&
            (customer.city != null || customer.postal_code != null),
        )
        .map((customer) => ({
          id: customer.id,
          query: [customer.address_line1, customer.postal_code, customer.city]
            .filter((part) => part != null && part !== '')
            .join(' '),
        })),
    [customers, sitesByCustomerId],
  );

  const customerGeocoding = useGeocodedAddresses(customersToGeocode);
  const customerGeocodes = customerGeocoding.coordinates;

  const missionsToGeocode = useMemo(
    () =>
      missions
        .filter((mission) => mission.latitude === null || mission.longitude === null)
        .filter(
          (mission) => mission.site_id === null || sitesMap.get(mission.site_id)?.latitude == null,
        )
        .filter(
          (mission) =>
            mission.customer_id === null ||
            (!firstSiteCoordsByCustomerId.has(mission.customer_id) &&
              customerGeocodes[mission.customer_id] === undefined),
        )
        .map((mission) => {
          const customer = mission.customer_id ? customersMap.get(mission.customer_id) : null;
          const directQuery = [mission.address_line1, mission.postal_code, mission.city]
            .filter((part) => part != null && part !== '')
            .join(' ');
          const customerQuery = customer
            ? [customer.address_line1, customer.postal_code, customer.city]
                .filter((part) => part != null && part !== '')
                .join(' ')
            : '';

          return {
            id: mission.id,
            query: directQuery || (mission.location_label ?? '') || customerQuery,
          };
        })
        .filter((entry) => entry.query.trim().length > 3),
    [missions, sitesMap, firstSiteCoordsByCustomerId, customerGeocodes, customersMap],
  );

  const missionGeocoding = useGeocodedAddresses(missionsToGeocode);
  const missionGeocodes = missionGeocoding.coordinates;

  /** Adresses qu'aucun géocodeur n'a su placer — dit, plutôt que tu. */
  const unplacedCount = customerGeocoding.failedCount + missionGeocoding.failedCount;

  // 3. Géolocalisation ponctuelle de l'utilisateur
  const {
    position: userPosition,
    isLoading: isLocatingUser,
    error: geoError,
    requestPosition: locateUser,
  } = useGeolocation();

  // 4. Conversion et agrégation de TOUS les points cartographiques (Missions + Sites + Clients)
  const allInterventions = useMemo<InterventionSite[]>(() => {
    const list: InterventionSite[] = [];

    // Missions géolocalisées (avec coordonnées directes ou héritées)
    missions.forEach((mission) => {
      let fallbackCoords: { latitude: number; longitude: number } | null = null;

      if (mission.latitude === null || mission.longitude === null) {
        if (mission.site_id) {
          const site = sitesMap.get(mission.site_id);
          if (site && site.latitude !== null && site.longitude !== null) {
            fallbackCoords = { latitude: site.latitude, longitude: site.longitude };
          }
        }

        if (!fallbackCoords && mission.customer_id) {
          const siteCoords = firstSiteCoordsByCustomerId.get(mission.customer_id);
          if (siteCoords) {
            fallbackCoords = siteCoords;
          } else if (customerGeocodes[mission.customer_id]) {
            fallbackCoords = customerGeocodes[mission.customer_id]!;
          }
        }

        if (!fallbackCoords && missionGeocodes[mission.id]) {
          fallbackCoords = missionGeocodes[mission.id]!;
        }
      }

      const site = toInterventionSite(mission, { industry, industryLabel }, fallbackCoords);
      if (site) list.push(site);
    });

    // Sites clients géolocalisés
    sites.forEach((site) => {
      const customer = customersMap.get(site.customer_id);
      const item = siteToMapItem(site, customer, { industry, industryLabel });
      if (item) list.push(item);
    });

    // Clients avec adresse géocodée sans site en base
    customers.forEach((customer) => {
      if (sitesByCustomerId.has(customer.id)) return;
      const coords = customerGeocodes[customer.id];
      if (coords) {
        list.push(customerToMapItem(customer, coords, { industry, industryLabel }));
      }
    });

    return list;
  }, [
    missions,
    sites,
    customers,
    customersMap,
    sitesMap,
    sitesByCustomerId,
    firstSiteCoordsByCustomerId,
    customerGeocodes,
    missionGeocodes,
    industry,
    industryLabel,
  ]);

  // 5. Calcul des distances pour tous les points
  const { interventions, distancesMap } = useMemo(() => {
    const map: Record<string, string> = {};

    let filtered = allInterventions;

    if (userPosition) {
      allInterventions.forEach((item) => {
        const dist = calculateDistanceKm(
          userPosition.latitude,
          userPosition.longitude,
          item.lat,
          item.lng,
        );
        map[item.id] = formatDistance(dist);
      });

      if (radiusKm !== null) {
        filtered = allInterventions.filter((item) => {
          const dist = calculateDistanceKm(
            userPosition.latitude,
            userPosition.longitude,
            item.lat,
            item.lng,
          );
          return dist <= radiusKm;
        });
      }
    }

    return { interventions: filtered, distancesMap: map };
  }, [allInterventions, userPosition, radiusKm]);

  const missionsCount = interventions.filter((s) => s.kind !== 'client').length;
  const clientsCount = interventions.filter((s) => s.kind === 'client').length;
  const totalGeocodedMissions = allInterventions.filter((s) => s.kind !== 'client').length;
  const unlocatedCount = Math.max(0, missions.length - totalGeocodedMissions);

  const handleSelectSite = (id: string) => {
    setSelectedSiteId(id);
    setMobileTab('map');
  };

  const handleLocateAndNearby = async () => {
    await locateUser();
  };

  const organizationName = organization?.name ?? 'votre organisation';

  return (
    <div className="mx-auto max-w-7xl space-y-3 pb-6 sm:space-y-4">
      {/* 1. Header & Actions GPS Ponctuelles */}
      <div className="bg-surface border-border flex flex-col justify-between gap-3 rounded-2xl border p-3.5 shadow-xs sm:flex-row sm:items-center sm:p-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary border-primary/20 flex size-8 items-center justify-center rounded-xl border">
              <Compass className="size-4" />
            </div>
            <div>
              <h1 className="text-foreground text-base font-extrabold tracking-tight sm:text-lg">
                Cartographie & Chantiers
              </h1>
              <p className="text-3xs text-muted-foreground mt-0.5">
                {interventions.length} lieu{interventions.length > 1 ? 'x' : ''} géolocalisé
                {interventions.length > 1 ? 's' : ''} ({missionsCount} mission
                {missionsCount > 1 ? 's' : ''}, {clientsCount} client{clientsCount > 1 ? 's' : ''})
                · {organizationName}
              </p>
            </div>
          </div>
        </div>

        {/* Actions GPS Ponctuelles & Filtres */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          {/* Sélecteur de rayon de proximité si position connue */}
          {userPosition && (
            <div className="bg-surface-subtle border-border text-3xs flex items-center gap-1 rounded-xl border p-1">
              <span className="text-muted-foreground px-1.5 font-medium">Rayon :</span>
              {[5, 10, 25, 50].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadiusKm(radiusKm === r ? null : r)}
                  className={cn(
                    'rounded-lg px-2 py-0.5 font-semibold transition-all',
                    radiusKm === r
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r}km
                </button>
              ))}
            </div>
          )}

          {/* Bouton d'action « Autour de moi » ponctuelle */}
          <Button
            type="button"
            variant={userPosition ? 'outline' : 'primary'}
            size="sm"
            onClick={handleLocateAndNearby}
            disabled={isLocatingUser}
            className="h-8 gap-1.5 text-xs shadow-xs"
          >
            <Crosshair className={cn('size-3.5', isLocatingUser && 'animate-spin')} />
            <span>
              {isLocatingUser
                ? 'Localisation...'
                : userPosition
                  ? 'Actualiser GPS'
                  : 'Autour de moi'}
            </span>
          </Button>

          {/* Bascule Mobile Carte / Liste */}
          <div className="bg-surface-subtle border-border text-3xs flex items-center rounded-xl border p-0.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileTab('map')}
              aria-label="Afficher la carte"
              aria-pressed={mobileTab === 'map'}
              className={cn(
                'size-touch flex items-center justify-center rounded-lg transition-all sm:size-auto sm:p-1.5',
                mobileTab === 'map'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground',
              )}
            >
              <MapIcon className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('list')}
              aria-label="Afficher la liste"
              aria-pressed={mobileTab === 'list'}
              className={cn(
                'size-touch flex items-center justify-center rounded-lg transition-all sm:size-auto sm:p-1.5',
                mobileTab === 'list'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground',
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Alerte discrète si des missions sont sans coordonnées */}
      {unlocatedCount > 0 && (
        <div className="bg-warning/10 border-warning/25 text-3xs text-warning flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-warning size-3.5 shrink-0" />
            <span>
              <strong>
                {unlocatedCount} mission{unlocatedCount > 1 ? 's' : ''}
              </strong>{' '}
              sans adresse ou coordonnées GPS ne peu{unlocatedCount > 1 ? 'vent' : 't'} pas être
              affichée{unlocatedCount > 1 ? 's' : ''} sur la carte.
            </span>
          </div>
          <Link
            to={ROUTES.missions}
            className="text-warning shrink-0 font-bold underline hover:opacity-80"
          >
            Voir les missions
          </Link>
        </div>
      )}

      {/* Message d'erreur GPS éventuel */}
      {geoError && (
        <div className="bg-error/10 border-error/30 text-error flex items-center gap-2 rounded-xl border p-3 text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>{geoError.message}</span>
        </div>
      )}

      {/* Adresses que le géocodeur n'a pas su placer */}
      {unplacedCount > 0 && (
        <div className="bg-warning/10 border-warning/30 text-warning flex items-center gap-2 rounded-xl border p-3 text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            {unplacedCount} adresse{unplacedCount > 1 ? 's' : ''} n’a pas pu être placée sur la
            carte. Renseignez les coordonnées depuis la fiche concernée.
          </span>
        </div>
      )}

      {/* 2. Zone Principale (Carte + Sidebar Chantiers & Clients) */}
      <div className="grid h-[calc(100vh-210px)] min-h-[580px] grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12">
        {/* Vue Carte */}
        <div
          className={`h-full lg:col-span-8 xl:col-span-9 ${
            mobileTab === 'map' ? 'block' : 'hidden lg:block'
          }`}
        >
          <GoogleMapView
            interventions={interventions}
            selectedSiteId={selectedSiteId}
            onSelectSite={handleSelectSite}
            layerMode={layerMode}
            onLayerModeChange={setLayerMode}
            userPosition={userPosition}
            onLocateUser={handleLocateAndNearby}
            isLocatingUser={isLocatingUser}
          />
        </div>

        {/* Sidebar Liste des Chantiers, Clients & Distances */}
        <div
          className={`h-full lg:col-span-4 xl:col-span-3 ${
            mobileTab === 'list' ? 'block' : 'hidden lg:block'
          }`}
        >
          <DispatchSidebar
            interventions={interventions}
            selectedSiteId={selectedSiteId}
            onSelectSite={handleSelectSite}
            distancesMap={distancesMap}
            onLocateUser={handleLocateAndNearby}
            isLocatingUser={isLocatingUser}
          />
        </div>
      </div>
    </div>
  );
}
