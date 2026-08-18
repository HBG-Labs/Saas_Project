import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Crosshair,
  MapPin,
  Search,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDefaultTerritory } from '@/config/territories';
import { getCurrentPosition } from '../geolocation';
import {
  reverseGeocode,
  forwardGeocode,
  type GeocodedAddress,
} from '../reverse-geocoding';

export interface MapLocationPickerProps {
  initialLatitude?: number | null | undefined;
  initialLongitude?: number | null | undefined;
  initialAddress?: string | undefined;
  onSelectLocation: (location: GeocodedAddress) => void;
  onCancel?: (() => void) | undefined;
  confirmLabel?: string | undefined;
}

export function MapLocationPicker({
  initialLatitude,
  initialLongitude,
  initialAddress = '',
  onSelectLocation,
  onCancel,
  confirmLabel = 'Valider ces coordonnées',
}: MapLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const { territory } = useDefaultTerritory();

  const [selectedCoords, setSelectedCoords] = useState<{
    lat: number;
    lng: number;
  }>(() => {
    if (initialLatitude != null && initialLongitude != null) {
      return { lat: initialLatitude, lng: initialLongitude };
    }
    return { lat: territory.center[0], lng: territory.center[1] };
  });

  const [geocodedInfo, setGeocodedInfo] = useState<GeocodedAddress | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>(initialAddress);
  const [searchResults, setSearchResults] = useState<GeocodedAddress[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // 1. Géocodage inverse — déclaré AVANT l’effet qui l’utilise.
  //
  // Trois issues distinctes, et l'utilisateur doit pouvoir les distinguer :
  // une adresse trouvée, un lieu inconnu des référentiels, un service
  // injoignable. Les confondre le laisserait devant un champ vide sans savoir
  // s'il doit ressaisir ou réessayer.
  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    setIsGeocoding(true);
    setGeocodeError(null);
    try {
      const res = await reverseGeocode(lat, lng);
      setGeocodedInfo(res ?? null);

      if (res?.label !== undefined) {
        setSearchQuery(res.label);
      } else if (res === undefined) {
        setGeocodeError('Aucune adresse connue à cet endroit. Saisissez-la manuellement.');
      }
    } catch (error) {
      setGeocodedInfo(null);
      setGeocodeError(
        error instanceof Error ? error.message : "Le service d'adresses est injoignable.",
      );
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // 2. Géocode initial — seulement si l'adresse n'est pas déjà connue.
  //
  // L'appelant transmet presque toujours `initialAddress` : interroger le
  // service pour retrouver une adresse qu'on nous a donnée était un
  // aller-retour réseau pour rien, à chaque ouverture de la modale.
  useEffect(() => {
    if (initialLatitude == null || initialLongitude == null) return;
    if (initialAddress !== '') return;

    let cancelled = false;
    void (async () => {
      if (!cancelled) await fetchAddress(initialLatitude, initialLongitude);
    })();

    return () => {
      cancelled = true;
    };
  }, [initialLatitude, initialLongitude, initialAddress, fetchAddress]);

  // 3. Initialisation de la carte Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const startLat = initialLatitude ?? territory.center[0];
    const startLng = initialLongitude ?? territory.center[1];
    const startZoom = initialLatitude != null ? 16 : territory.zoom;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: startZoom,
        zoomControl: true,
      });

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 19,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps & OpenStreetMap',
      }).addTo(map);

      // Création de l'icône personnalisée du marqueur interactif
      const customPinIcon = L.divIcon({
        className: 'picker-pin',
        html: `
          <div style="
            position: relative;
            transform: translate(-50%, -100%);
            display: flex;
            flex-direction: column;
            align-items: center;
          ">
            <div style="
              width: 34px;
              height: 34px;
              background: #2563eb;
              border: 3px solid #ffffff;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 4px 14px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 10px;
                height: 10px;
                background: #ffffff;
                border-radius: 50%;
                transform: rotate(45deg);
              "></div>
            </div>
          </div>
        `,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
      });

      const marker = L.marker([startLat, startLng], {
        icon: customPinIcon,
        draggable: true,
      }).addTo(map);

      // Déplacement du marqueur au clic sur la carte
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setSelectedCoords({ lat, lng });
        void fetchAddress(lat, lng);
      });

      // Déplacement du marqueur au drag
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setSelectedCoords({ lat: pos.lat, lng: pos.lng });
        void fetchAddress(pos.lat, pos.lng);
      });

      markerRef.current = marker;
      mapInstanceRef.current = map;

    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // Volontairement vide : cet effet CRÉE la carte Leaflet, une seule fois.
    //
    // Ajouter `territory`, `layerMode` ou les coordonnées initiales en
    // dépendances détruirait et reconstruirait la carte à chaque changement de
    // filtre — perdant le zoom, le centrage et la position que l'utilisateur
    // vient de choisir. Ces valeurs sont appliquées par des effets SÉPARÉS, qui
    // agissent sur l'instance existante.
    //
    // Le tableau vide est donc une décision, pas un oubli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Action « Ma position » (One-shot)
  const handleLocateMe = async () => {
    setIsLocatingUser(true);
    try {
      const pos = await getCurrentPosition();
      const lat = pos.latitude;
      const lng = pos.longitude;

      setSelectedCoords({ lat, lng });

      if (mapInstanceRef.current && markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        mapInstanceRef.current.flyTo([lat, lng], 17, { animate: true, duration: 1 });
      }

      await fetchAddress(lat, lng);
    } catch (error) {
      setGeocodeError(
        error instanceof Error ? error.message : 'Position indisponible sur cet appareil.',
      );
    } finally {
      setIsLocatingUser(false);
    }
  };

  // 4. Recherche d'adresse
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await forwardGeocode(searchQuery);
      setSearchResults(results);
      if (results.length > 0 && results[0]) {
        handleSelectSuggestion(results[0]);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSuggestion = (item: GeocodedAddress) => {
    const lat = item.latitude;
    const lng = item.longitude;

    setSelectedCoords({ lat, lng });
    setGeocodedInfo(item);
    setSearchResults([]);

    if (mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.flyTo([lat, lng], 17, { animate: true, duration: 0.8 });
    }
  };

  const handleValidate = () => {
    onSelectLocation({
      latitude: selectedCoords.lat,
      longitude: selectedCoords.lng,
      addressLine1: geocodedInfo?.addressLine1,
      postalCode: geocodedInfo?.postalCode,
      city: geocodedInfo?.city,
      country: geocodedInfo?.country ?? 'FR',
      label: geocodedInfo?.label,
    });
  };

  return (
    <div className="flex flex-col h-[520px] max-h-[85vh] w-full rounded-2xl overflow-hidden bg-surface border border-border select-none">
      {/* Barre de recherche et action rapide */}
      <div className="p-3 border-b border-border bg-surface-subtle/40 space-y-2">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Rechercher une adresse, une ville, un lieu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8 bg-surface"
            />
          </div>

          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={isSearching}
            className="text-xs h-8 px-2.5"
          >
            {isSearching ? <Loader2 className="size-3.5 animate-spin" /> : 'Chercher'}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleLocateMe}
            disabled={isLocatingUser}
            className="text-xs h-8 px-2.5 gap-1"
            title="Centrer sur ma position GPS actuelle"
          >
            <Crosshair className={`size-3.5 ${isLocatingUser ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Ma position</span>
          </Button>
        </form>

        {/* Suggestions de recherche */}
        {searchResults.length > 1 && (
          <div className="bg-surface rounded-xl border border-border shadow-md max-h-32 overflow-y-auto p-1 space-y-0.5">
            {searchResults.map((res, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectSuggestion(res)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-3xs text-foreground hover:bg-surface-hover transition-all flex items-center gap-1.5"
              >
                <MapPin className="size-3 text-primary shrink-0" />
                <span className="truncate">{res.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Carte Leaflet interactive */}
      <div className="relative flex-1 min-h-[260px]">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Guide d'instruction flottant */}
        <div className="absolute top-2.5 left-2.5 z-10 bg-slate-900/85 backdrop-blur-md text-white text-3xs px-2.5 py-1.5 rounded-xl border border-white/10 shadow-lg flex items-center gap-1.5 pointer-events-none">
          <Sparkles className="size-3 text-amber-400 shrink-0" />
          <span>Cliquez ou glissez le repère 📍 pour ajuster la position exacte</span>
        </div>
      </div>

      {/* Pied de dialogue avec coordonnées et validation */}
      <div className="p-3.5 border-t border-border bg-surface-subtle/50 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-3xs font-mono font-bold text-foreground">
              <MapPin className="size-3 text-primary shrink-0" />
              <span>
                GPS : {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
              </span>
              {isGeocoding && <Loader2 className="size-2.5 animate-spin text-primary ml-1" />}
            </div>
            {geocodedInfo?.addressLine1 !== undefined && (
              <p className="text-3xs text-muted-foreground truncate">
                {[geocodedInfo.addressLine1, geocodedInfo.postalCode, geocodedInfo.city]
                  .filter((part) => part !== undefined && part !== '')
                  .join(', ')}
              </p>
            )}
            {/* Une adresse introuvable ou un service en panne se disent, plutôt
                que de laisser le champ vide sans explication. Les coordonnées
                restent valides : le point est posé, seule son adresse manque. */}
            {geocodeError !== null && (
              <p className="text-3xs text-amber-600 dark:text-amber-400">{geocodeError}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            {onCancel && (
              <Button type="button" variant="outline" size="sm" onClick={onCancel} className="text-xs h-8">
                Annuler
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleValidate}
              className="text-xs h-8 gap-1.5 font-bold"
            >
              <Check className="size-3.5" />
              <span>{confirmLabel}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
