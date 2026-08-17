import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Compass,
  Map as MapIcon,
  List,
  Crosshair,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
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

  // 1. Chargement des missions
  const missionsQuery = useMissions(organizationId, {
    status: ['draft', 'assigned', 'accepted', 'in_progress', 'completed'],
    limit: 200,
  });
  const missions = useMemo(() => missionsQuery.data ?? [], [missionsQuery.data]);

  // 2. Chargement des clients et de leurs sites
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
          (mission) =>
            mission.site_id === null || sitesMap.get(mission.site_id)?.latitude == null,
        )
        .filter(
          (mission) =>
            mission.customer_id === null ||
            (!firstSiteCoordsByCustomerId.has(mission.customer_id) &&
              customerGeocodes[mission.customer_id] === undefined),
        )
        .map((mission) => ({
          id: mission.id,
          query:
            [mission.address_line1, mission.postal_code, mission.city]
              .filter((part) => part != null && part !== '')
              .join(' ') || (mission.location_label ?? ''),
        }))
        .filter((entry) => entry.query.trim().length > 3),
    [missions, sitesMap, firstSiteCoordsByCustomerId, customerGeocodes],
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
    <div className="space-y-3 sm:space-y-4 max-w-7xl mx-auto pb-6">
      {/* 1. Header & Actions GPS Ponctuelles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3.5 sm:p-4 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Compass className="size-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                Cartographie & Chantiers
              </h1>
              <p className="text-3xs text-muted-foreground mt-0.5">
                {interventions.length} lieu{interventions.length > 1 ? 'x' : ''} géolocalisé
                {interventions.length > 1 ? 's' : ''} ({missionsCount} mission{missionsCount > 1 ? 's' : ''}, {clientsCount} client{clientsCount > 1 ? 's' : ''}) · {organizationName}
              </p>
            </div>
          </div>
        </div>

        {/* Actions GPS Ponctuelles & Filtres */}
        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          {/* Sélecteur de rayon de proximité si position connue */}
          {userPosition && (
            <div className="flex items-center gap-1 bg-surface-subtle p-1 rounded-xl border border-border text-3xs">
              <span className="text-muted-foreground px-1.5 font-medium">Rayon :</span>
              {[5, 10, 25, 50].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadiusKm(r)}
                  className={`px-2 py-0.5 font-bold rounded-md transition-all ${
                    radiusKm === r
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r}km
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRadiusKm(null)}
                className={`px-2 py-0.5 font-bold rounded-md transition-all ${
                  radiusKm === null
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Tous
              </button>
            </div>
          )}

          {/* Bouton « Ma position » (One-shot) */}
          <Button
            type="button"
            variant={userPosition ? 'primary' : 'outline'}
            size="sm"
            onClick={handleLocateAndNearby}
            disabled={isLocatingUser}
            className="text-xs h-8 gap-1.5"
            title="Récupérer ponctuellement ma position GPS pour voir les chantiers et clients à proximité"
          >
            <Crosshair
              className={`size-3.5 ${isLocatingUser ? 'animate-spin' : ''}`}
            />
            <span>
              {isLocatingUser
                ? 'Localisation...'
                : userPosition
                  ? '📍 Ma position active'
                  : '📍 Ma position'}
            </span>
          </Button>

          {/* Bascule Mobile (Carte / Liste) */}
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
              <List className="size-3" />
              Liste ({interventions.length})
            </button>
          </div>
        </div>
      </div>

      {/* Alerte si des missions sont sans coordonnées GPS */}
      {unlocatedCount > 0 && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-amber-500/10 border border-amber-500/25 rounded-xl text-3xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
            <span>
              <strong>{unlocatedCount} mission{unlocatedCount > 1 ? 's' : ''}</strong> sans adresse ou coordonnées GPS ne peu{unlocatedCount > 1 ? 'vent' : 't'} pas être affichée{unlocatedCount > 1 ? 's' : ''} sur la carte.
            </span>
          </div>
          <Link
            to={ROUTES.missions}
            className="underline font-bold text-amber-900 dark:text-amber-100 shrink-0 hover:opacity-80"
          >
            Voir les missions
          </Link>
        </div>
      )}

      {/* Message d'erreur GPS éventuel */}
      {geoError && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="size-4 shrink-0" />
          <span>{geoError.message}</span>
        </div>
      )}

      {/* Adresses que le géocodeur n'a pas su placer.
          Un point absent de la carte s'expliquait auparavant par un `catch {}` :
          l'utilisateur cherchait un chantier qui n'apparaissait pas, sans
          jamais savoir que le service avait refusé la demande. */}
      {unplacedCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            {unplacedCount} adresse{unplacedCount > 1 ? 's' : ''} n’a pas pu être placée sur la
            carte. Renseignez les coordonnées depuis la fiche concernée.
          </span>
        </div>
      )}

      {/* 2. Zone Principale (Carte + Sidebar Chantiers & Clients) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 h-[calc(100vh-210px)] min-h-[580px]">
        {/* Vue Carte */}
        <div
          className={`lg:col-span-8 xl:col-span-9 h-full ${
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
          className={`lg:col-span-4 xl:col-span-3 h-full ${
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
