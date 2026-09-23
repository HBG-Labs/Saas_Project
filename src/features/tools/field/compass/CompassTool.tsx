import { Check, Compass, Copy, Lock, MapPin, RefreshCw, Unlock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

import { normalizeHeading, unwrapHeading } from './heading';

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

  const normalized = normalizeHeading(heading);
  const match = directions.find((d) => normalized >= d.min && normalized < d.max);
  return match ? `${match.short} • ${match.label}` : `${Math.round(normalized)}°`;
}

export default function CompassTool() {
  const [heading, setHeading] = useState<number>(0);
  const [dialHeading, setDialHeading] = useState<number>(0);
  const dialHeadingRef = useRef(0);
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

  const updateHeading = useCallback((nextHeading: number) => {
    const normalized = normalizeHeading(nextHeading);
    const unwrapped = unwrapHeading(dialHeadingRef.current, normalized);
    dialHeadingRef.current = unwrapped;
    setDialHeading(unwrapped);
    setHeading(Math.round(normalized) % 360);
  }, []);

  // Demande d'autorisation pour iOS 13+
  const requestOrientationPermission = useCallback(async () => {
    const orientationEvent = DeviceOrientationEvent as DeviceOrientationConstructorWithPermission;
    if (typeof window !== 'undefined' && typeof orientationEvent.requestPermission === 'function') {
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
        updateHeading(compassHeading);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [updateHeading]);

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
    <div className="mx-auto max-w-4xl min-w-0 space-y-4 sm:space-y-6">
      <Card className="border-border bg-surface min-w-0 overflow-hidden shadow-2xs">
        <CardHeader className="border-border/70 border-b p-3.5 pb-3.5 sm:p-4">
          <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                <Compass className="size-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-sm font-bold sm:text-base">
                  Boussole Numérique & Azimut
                </CardTitle>
                <p className="text-3xs text-muted-foreground line-clamp-1 sm:text-xs">
                  Orientation magnétique, verrouillage de cap et GPS de chantier.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant={lockedHeading !== null ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setLockedHeading(lockedHeading !== null ? null : heading)}
              className="h-8 shrink-0 gap-1.5 self-start text-xs font-semibold sm:self-auto"
            >
              {lockedHeading !== null ? (
                <Unlock className="size-3.5" />
              ) : (
                <Lock className="size-3.5" />
              )}
              <span>{lockedHeading !== null ? 'Libérer cap' : 'Verrouiller cap'}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="min-w-0 space-y-4 overflow-x-hidden p-3 sm:space-y-6 sm:p-6">
          {/* Alerte demande de permission iOS */}
          {hasOrientationSensor === null && !permissionRequested && (
            <div className="bg-primary/10 border-primary/20 flex flex-col justify-between gap-3 rounded-xl border p-4 text-xs sm:flex-row sm:items-center">
              <div className="space-y-0.5">
                <p className="text-foreground font-bold">
                  Autorisation des capteurs requise sur mobile
                </p>
                <p className="text-muted-foreground">
                  Cliquez sur activer pour autoriser le gyroscope et la boussole de votre appareil.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={requestOrientationPermission}
                className="shrink-0 text-xs"
              >
                Activer la boussole
              </Button>
            </div>
          )}

          {/* Cadran Central de la Boussole */}
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative flex size-64 items-center justify-center sm:size-76">
              {/* Repère supérieur fixe (flèche de visée) */}
              <div className="absolute -top-3 z-20 flex flex-col items-center">
                <div className="border-t-warning size-0 border-x-8 border-t-12 border-x-transparent" />
              </div>

              {/* Cadran tournant gradué */}
              <div
                className="border-border bg-surface-sunken relative flex size-full items-center justify-center rounded-full border-4 shadow-2xl transition-transform duration-100 ease-out"
                style={{ transform: `rotate(${-dialHeading}deg)` }}
              >
                {/* Graduations circulaires */}
                <div className="border-border absolute inset-2 rounded-full border" />
                <div className="border-border/80 absolute inset-6 rounded-full border border-dashed" />

                {/* Points Cardinaux */}
                <span className="text-error absolute top-2.5 text-sm font-black tracking-wider">
                  N
                </span>
                <span className="text-muted-foreground absolute right-3.5 text-sm font-black tracking-wider">
                  E
                </span>
                <span className="text-muted-foreground absolute bottom-2.5 text-sm font-black tracking-wider">
                  S
                </span>
                <span className="text-muted-foreground absolute left-3.5 text-sm font-black tracking-wider">
                  O
                </span>

                {/* Points Intercardinaux */}
                <span className="text-2xs text-muted-foreground absolute top-8 right-8 font-bold">
                  NE
                </span>
                <span className="text-2xs text-muted-foreground absolute right-8 bottom-8 font-bold">
                  SE
                </span>
                <span className="text-2xs text-muted-foreground absolute bottom-8 left-8 font-bold">
                  SO
                </span>
                <span className="text-2xs text-muted-foreground absolute top-8 left-8 font-bold">
                  NO
                </span>

                {/* Rayons principaux */}
                <div className="bg-foreground/60 absolute h-full w-0.5" />
                <div className="bg-foreground/60 absolute h-0.5 w-full" />

                {/* Aiguille Nord / Sud */}
                <div className="pointer-events-none absolute flex h-36 w-2 flex-col items-center justify-between">
                  <div className="h-0 w-0 border-x-6 border-b-28 border-x-transparent border-b-red-600 drop-shadow-md" />
                  <div className="h-0 w-0 border-x-6 border-t-28 border-x-transparent border-t-slate-400 drop-shadow-md" />
                </div>
              </div>

              {/* Centre du cadran avec Cap en Degrés */}
              <div className="bg-surface-sunken/90 border-border absolute z-10 flex size-24 flex-col items-center justify-center rounded-full border text-white shadow-xl backdrop-blur-md">
                <span className="font-mono text-2xl font-black tracking-tight">{heading}°</span>
                <span className="text-3xs text-muted-foreground font-bold uppercase">
                  {getCardinalDirection(heading).split(' • ')[0]}
                </span>
              </div>
            </div>

            {/* Direction Textuelle */}
            <div className="mt-5 space-y-1 text-center">
              <p className="text-foreground text-base font-extrabold">
                {getCardinalDirection(heading)}
              </p>
              {lockedHeading !== null && headingDiff !== null && (
                <div className="bg-warning/10 text-warning border-warning/20 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold">
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
            <div className="bg-surface-raised border-border space-y-2 rounded-xl border p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-semibold">
                  Ajustement manuel (mode bureau sans gyroscope)
                </span>
                <span className="text-primary font-mono font-bold">{heading}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="359"
                value={heading}
                onChange={(e) => updateHeading(Number(e.target.value))}
                aria-label="Cap manuel"
                className="accent-primary bg-surface h-2 w-full cursor-pointer rounded-lg"
              />
            </div>
          )}

          {/* Informations GPS de Chantier */}
          <div className="bg-surface-raised border-border space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div className="text-foreground flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                <MapPin className="text-primary size-4" />
                <span>Coordonnées GPS du site</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchLocation}
                  className="text-3xs h-7 gap-1 px-2 font-semibold"
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
                    className="text-3xs h-7 gap-1 px-2 font-semibold"
                  >
                    {copiedGps ? (
                      <Check className="text-success size-3" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {copiedGps ? 'Copié' : 'Copier'}
                  </Button>
                )}
              </div>
            </div>

            {coords.lat !== null && coords.lng !== null ? (
              <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4">
                <div className="bg-surface border-border/80 rounded-lg border p-2.5 text-xs">
                  <span className="text-3xs text-muted-foreground block font-semibold">
                    Latitude
                  </span>
                  <span className="text-foreground font-mono font-bold">{coords.lat}° N</span>
                </div>
                <div className="bg-surface border-border/80 rounded-lg border p-2.5 text-xs">
                  <span className="text-3xs text-muted-foreground block font-semibold">
                    Longitude
                  </span>
                  <span className="text-foreground font-mono font-bold">{coords.lng}° E</span>
                </div>
                <div className="bg-surface border-border/80 rounded-lg border p-2.5 text-xs">
                  <span className="text-3xs text-muted-foreground block font-semibold">
                    Altitude
                  </span>
                  <span className="text-foreground font-mono font-bold">
                    {coords.alt !== null ? `${coords.alt} m` : 'N/A'}
                  </span>
                </div>
                <div className="bg-surface border-border/80 rounded-lg border p-2.5 text-xs">
                  <span className="text-3xs text-muted-foreground block font-semibold">
                    Précision GPS
                  </span>
                  <span className="text-success font-mono font-bold">± {coords.accuracy} m</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Recherche de position GPS en cours ou géolocalisation désactivée.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
