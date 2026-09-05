import {
  Check,
  Compass,
  Copy,
  Lock,
  MapPin,
  RefreshCw,
  Unlock,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

interface GeoLocationState {
  lat: number | null;
  lng: number | null;
  alt: number | null;
  accuracy: number | null;
}

interface DeviceOrientationEventWithCompass extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

type DeviceOrientationConstructorWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

function getCardinalDirection(heading: number): string {
  const directions = [
    { label: 'Nord', short: 'N', min: 348.75, max: 360 },
    { label: 'Nord', short: 'N', min: 0, max: 11.25 },
    { label: 'Nord-Nord-Est', short: 'NNE', min: 11.25, max: 33.75 },
    { label: 'Nord-Est', short: 'NE', min: 33.75, max: 56.25 },
    { label: 'Est-Nord-Est', short: 'ENE', min: 56.25, max: 78.75 },
    { label: 'Est', short: 'E', min: 78.75, max: 101.25 },
    { label: 'Est-Sud-Est', short: 'ESE', min: 101.25, max: 123.75 },
    { label: 'Sud-Est', short: 'SE', min: 123.75, max: 146.25 },
    { label: 'Sud-Sud-Est', short: 'SSE', min: 146.25, max: 168.75 },
    { label: 'Sud', short: 'S', min: 168.75, max: 191.25 },
    { label: 'Sud-Sud-Ouest', short: 'SSO', min: 191.25, max: 213.75 },
    { label: 'Sud-Ouest', short: 'SO', min: 213.75, max: 236.25 },
    { label: 'Ouest-Sud-Ouest', short: 'OSO', min: 236.25, max: 258.75 },
    { label: 'Ouest', short: 'O', min: 258.75, max: 281.25 },
    { label: 'Ouest-Nord-Ouest', short: 'ONO', min: 281.25, max: 303.75 },
    { label: 'Nord-Ouest', short: 'NO', min: 303.75, max: 326.25 },
    { label: 'Nord-Nord-Ouest', short: 'NNO', min: 326.25, max: 348.75 },
  ];

  const normalized = ((heading % 360) + 360) % 360;
  const match = directions.find((d) => normalized >= d.min && normalized < d.max);
  return match ? `${match.short} • ${match.label}` : `${Math.round(normalized)}°`;
}

export default function CompassTool() {
  const [heading, setHeading] = useState<number>(0);
  const [lockedHeading, setLockedHeading] = useState<number | null>(null);
  const [hasOrientationSensor, setHasOrientationSensor] = useState<boolean | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [copiedGps, signalerCopiedGps] = useEphemeralFlag();

  const [coords, setCoords] = useState<GeoLocationState>({
    lat: null,
    lng: null,
    alt: null,
    accuracy: null,
  });

  // Demande d'autorisation pour iOS 13+
  const requestOrientationPermission = useCallback(async () => {
    const orientationEvent = DeviceOrientationEvent as DeviceOrientationConstructorWithPermission;
    if (
      typeof window !== 'undefined' &&
      typeof orientationEvent.requestPermission === 'function'
    ) {
      try {
        const response = await orientationEvent.requestPermission();
        if (response === 'granted') {
          setHasOrientationSensor(true);
          setPermissionRequested(true);
        } else {
          setHasOrientationSensor(false);
        }
      } catch (err) {
        console.warn('Erreur permission orientation:', err);
      }
    } else {
      setPermissionRequested(true);
    }
  }, []);

  // Écoute des capteurs gyroscopiques
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      let compassHeading: number | null = null;

      // Spécifique iOS (webkitCompassHeading est le cap magnétique direct)
      const iosHeading = (event as DeviceOrientationEventWithCompass).webkitCompassHeading;
      if (iosHeading !== undefined) {
        compassHeading = iosHeading;
      } else if (event.alpha !== null) {
        // Standard Android / Web (alpha inversé)
        compassHeading = 360 - event.alpha;
      }

      if (compassHeading !== null) {
        setHasOrientationSensor(true);
        setHeading(Math.round(((compassHeading % 360) + 360) % 360));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  // Récupération des coordonnées GPS
  const fetchLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: Number(pos.coords.latitude.toFixed(5)),
            lng: Number(pos.coords.longitude.toFixed(5)),
            alt: pos.coords.altitude ? Math.round(pos.coords.altitude) : null,
            accuracy: Math.round(pos.coords.accuracy),
          });
        },
        (err) => {
          console.warn('Erreur géolocalisation:', err);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  // Copie des coordonnées GPS
  const copyCoordinates = () => {
    if (coords.lat !== null && coords.lng !== null) {
      void navigator.clipboard.writeText(`${coords.lat}, ${coords.lng}`);
      signalerCopiedGps();
    }
  };

  // Calcul de l'écart par rapport au cap verrouillé
  const headingDiff = lockedHeading !== null ? ((heading - lockedHeading + 540) % 360) - 180 : null;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto min-w-0">
      <Card className="border-border bg-surface shadow-2xs overflow-hidden min-w-0">
        <CardHeader className="border-b border-border/70 p-3.5 sm:p-4 pb-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Compass className="size-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base font-bold truncate">Boussole Numérique & Azimut</CardTitle>
                <p className="text-3xs sm:text-xs text-muted-foreground line-clamp-1">
                  Orientation magnétique, verrouillage de cap et GPS de chantier.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant={lockedHeading !== null ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setLockedHeading(lockedHeading !== null ? null : heading)}
              className="gap-1.5 text-xs font-semibold self-start sm:self-auto shrink-0 h-8"
            >
              {lockedHeading !== null ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
              <span>{lockedHeading !== null ? 'Libérer cap' : 'Verrouiller cap'}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-6 space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden">
          {/* Alerte demande de permission iOS */}
          {hasOrientationSensor === null && !permissionRequested && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-foreground">Autorisation des capteurs requise sur mobile</p>
                <p className="text-muted-foreground">
                  Cliquez sur activer pour autoriser le gyroscope et la boussole de votre appareil.
                </p>
              </div>
              <Button type="button" size="sm" onClick={requestOrientationPermission} className="text-xs shrink-0">
                Activer la boussole
              </Button>
            </div>
          )}

          {/* Cadran Central de la Boussole */}
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative size-64 sm:size-76 flex items-center justify-center">
              {/* Repère supérieur fixe (flèche de visée) */}
              <div className="absolute -top-3 z-20 flex flex-col items-center">
                <div className="size-0 border-x-8 border-x-transparent border-t-12 border-t-warning" />
              </div>

              {/* Cadran tournant gradué */}
              <div
                className="relative size-full rounded-full border-4 border-border bg-surface-sunken shadow-2xl flex items-center justify-center transition-transform duration-100 ease-out"
                style={{ transform: `rotate(${-heading}deg)` }}
              >
                {/* Graduations circulaires */}
                <div className="absolute inset-2 rounded-full border border-border" />
                <div className="absolute inset-6 rounded-full border border-dashed border-border/80" />

                {/* Points Cardinaux */}
                <span className="absolute top-2.5 text-sm font-black text-red-500 tracking-wider">N</span>
                <span className="absolute right-3.5 text-sm font-black text-muted-foreground tracking-wider">E</span>
                <span className="absolute bottom-2.5 text-sm font-black text-muted-foreground tracking-wider">S</span>
                <span className="absolute left-3.5 text-sm font-black text-muted-foreground tracking-wider">O</span>

                {/* Points Intercardinaux */}
                <span className="absolute top-8 right-8 text-2xs font-bold text-muted-foreground">NE</span>
                <span className="absolute bottom-8 right-8 text-2xs font-bold text-muted-foreground">SE</span>
                <span className="absolute bottom-8 left-8 text-2xs font-bold text-muted-foreground">SO</span>
                <span className="absolute top-8 left-8 text-2xs font-bold text-muted-foreground">NO</span>

                {/* Rayons principaux */}
                <div className="absolute h-full w-0.5 bg-slate-800/60" />
                <div className="absolute w-full h-0.5 bg-slate-800/60" />

                {/* Aiguille Nord / Sud */}
                <div className="absolute w-2 h-36 flex flex-col items-center justify-between pointer-events-none">
                  <div className="w-0 h-0 border-x-6 border-x-transparent border-b-28 border-b-red-600 drop-shadow-md" />
                  <div className="w-0 h-0 border-x-6 border-x-transparent border-t-28 border-t-slate-400 drop-shadow-md" />
                </div>
              </div>

              {/* Centre du cadran avec Cap en Degrés */}
              <div className="absolute z-10 flex flex-col items-center justify-center size-24 rounded-full bg-surface-sunken/90 backdrop-blur-md border border-border shadow-xl text-white">
                <span className="font-mono text-2xl font-black tracking-tight">{heading}°</span>
                <span className="text-3xs uppercase font-bold text-muted-foreground">
                  {getCardinalDirection(heading).split(' • ')[0]}
                </span>
              </div>
            </div>

            {/* Direction Textuelle */}
            <div className="mt-5 text-center space-y-1">
              <p className="text-base font-extrabold text-foreground">{getCardinalDirection(heading)}</p>
              {lockedHeading !== null && headingDiff !== null && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-warning/10 text-warning border border-warning/20">
                  <span>Cap cible : {lockedHeading}°</span>
                  <span>•</span>
                  <span>
                    {Math.abs(headingDiff) <= 2
                      ? '🎯 Aligné'
                      : headingDiff > 0
                        ? `Tourner de ${Math.abs(headingDiff)}° à gauche`
                        : `Tourner de ${Math.abs(headingDiff)}° à droite`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Simulateur / Ajustement manuel si aucun capteur */}
          {hasOrientationSensor === false && (
            <div className="p-4 rounded-xl bg-surface-raised border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">
                  Ajustement manuel (mode bureau sans gyroscope)
                </span>
                <span className="font-mono font-bold text-primary">{heading}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="359"
                value={heading}
                onChange={(e) => setHeading(Number(e.target.value))}
                aria-label="Cap manuel"
                className="w-full accent-primary h-2 bg-surface rounded-lg cursor-pointer"
              />
            </div>
          )}

          {/* Informations GPS de Chantier */}
          <div className="p-4 rounded-xl bg-surface-raised border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                <MapPin className="size-4 text-primary" />
                <span>Coordonnées GPS du site</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchLocation}
                  className="h-7 px-2 text-3xs font-semibold gap-1"
                >
                  <RefreshCw className="size-3" />
                  Actualiser
                </Button>
                {coords.lat !== null && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyCoordinates}
                    className="h-7 px-2 text-3xs font-semibold gap-1"
                  >
                    {copiedGps ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                    {copiedGps ? 'Copié' : 'Copier'}
                  </Button>
                )}
              </div>
            </div>

            {coords.lat !== null && coords.lng !== null ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-surface border border-border/80 text-xs">
                  <span className="text-3xs text-muted-foreground font-semibold block">Latitude</span>
                  <span className="font-mono font-bold text-foreground">{coords.lat}° N</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-border/80 text-xs">
                  <span className="text-3xs text-muted-foreground font-semibold block">Longitude</span>
                  <span className="font-mono font-bold text-foreground">{coords.lng}° E</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-border/80 text-xs">
                  <span className="text-3xs text-muted-foreground font-semibold block">Altitude</span>
                  <span className="font-mono font-bold text-foreground">
                    {coords.alt !== null ? `${coords.alt} m` : 'N/A'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface border border-border/80 text-xs">
                  <span className="text-3xs text-muted-foreground font-semibold block">Précision GPS</span>
                  <span className="font-mono font-bold text-success">
                    ± {coords.accuracy} m
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Recherche de position GPS en cours ou géolocalisation désactivée.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
