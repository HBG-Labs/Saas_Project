import { AppError } from '@/lib/errors/app-error';

import {
  asText,
  firstText,
  readBanFeatures,
  readCoordinates,
  readNominatim,
} from './geocoding-providers';

export interface GeocodedAddress {
  latitude: number;
  longitude: number;
  addressLine1?: string | undefined;
  postalCode?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
  label?: string | undefined;
}

/**
 * Conversion entre coordonnées et adresses postales.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX FOURNISSEURS, ET UN ORDRE QUI COMPTE
 *
 * La Base Adresse Nationale (`api-adresse.data.gouv.fr`) couvre la métropole et
 * les départements d'outre-mer, sans clé et sans quota déclaré. Nominatim
 * (OpenStreetMap) sert de recours : sa politique d'usage limite à une requête
 * par seconde et interdit le géocodage en masse — d'où son rang de second, et
 * jamais l'inverse.
 *
 * L'en-tête `User-Agent` que la version précédente posait était supprimé par le
 * navigateur — c'est un en-tête interdit en `fetch` — et annonçait de surcroît
 * le nom d'un autre produit. Il a été retiré plutôt que laissé comme une
 * identification imaginaire.
 *
 * CE QUI A CHANGÉ SUR LES ERREURS
 *
 * Les échecs étaient avalés par trois `catch {}` muets, et la fonction rendait
 * un objet contenant les coordonnées formatées en texte. L'appelant croyait
 * tenir une adresse ; il tenait « 48.856600, 2.352200 ».
 *
 * Désormais un échec des DEUX fournisseurs lève. Une adresse introuvable et un
 * service injoignable ne se disent pas de la même manière, et l'utilisateur doit
 * pouvoir faire la différence entre « saisissez l'adresse à la main » et
 * « réessayez dans un instant ».
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BAN_ENDPOINT = 'https://api-adresse.data.gouv.fr';
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org';

/** Au-delà, l'utilisateur attend devant un écran figé sans savoir pourquoi. */
const TIMEOUT_MS = 8000;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new AppError('network', `Le service d'adresses a répondu ${String(response.status)}.`);
  }

  return response.json();
}

/**
 * Coordonnées → adresse postale.
 *
 * Lève une `AppError` si aucun des deux fournisseurs ne répond. Renvoie
 * `undefined` si les deux répondent mais ne connaissent pas le lieu — un point
 * en pleine mer, par exemple, n'est pas une panne.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodedAddress | undefined> {
  const failures: unknown[] = [];

  // 1. Base Adresse Nationale.
  try {
    const payload = await fetchJson(
      `${BAN_ENDPOINT}/reverse/?lon=${String(longitude)}&lat=${String(latitude)}`,
    );
    const feature = readBanFeatures(payload)[0];

    if (feature?.properties !== undefined) {
      const props = feature.properties;
      return {
        latitude,
        longitude,
        addressLine1: firstText(props.name, props.street, props.label),
        postalCode: asText(props.postcode),
        city: asText(props.city),
        country: 'FR',
        label: firstText(props.label, props.name),
      };
    }
  } catch (error) {
    failures.push(error);
  }

  // 2. Nominatim, en recours.
  try {
    const payload = await fetchJson(
      `${NOMINATIM_ENDPOINT}/reverse?format=jsonv2&lat=${String(latitude)}&lon=${String(longitude)}`,
    );
    const data = readNominatim(payload);
    const address = data?.address;

    if (address !== undefined) {
      const street = [asText(address.house_number), asText(address.road)]
        .filter((part) => part !== undefined)
        .join(' ');
      const countryCode = asText(address.country_code);

      return {
        latitude,
        longitude,
        addressLine1: firstText(street, address.suburb, address.neighbourhood),
        postalCode: asText(address.postcode),
        city: firstText(address.city, address.town, address.village, address.municipality),
        country: countryCode === undefined ? 'FR' : countryCode.toUpperCase(),
        label: asText(data?.display_name),
      };
    }
  } catch (error) {
    failures.push(error);
  }

  // Les deux ont échoué : c'est une panne, pas une absence de résultat.
  if (failures.length === 2) {
    throw new AppError(
      'network',
      "Impossible de joindre un service d'adresses. Saisissez l'adresse manuellement.",
      { cause: failures[0] },
    );
  }

  return undefined;
}

/**
 * Adresse → coordonnées.
 *
 * La BAN seule : Nominatim interdit explicitement le géocodage en masse, et
 * cette fonction est appelée en boucle sur des listes de clients.
 */
export async function forwardGeocode(query: string): Promise<GeocodedAddress[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const payload = await fetchJson(
    `${BAN_ENDPOINT}/search/?q=${encodeURIComponent(trimmed)}&limit=5`,
  );

  const results: GeocodedAddress[] = [];

  for (const feature of readBanFeatures(payload)) {
    const coordinates = readCoordinates(feature.geometry);
    if (coordinates === undefined) continue;

    const props = feature.properties ?? {};
    results.push({
      ...coordinates,
      addressLine1: firstText(props.name, props.street),
      postalCode: asText(props.postcode),
      city: asText(props.city),
      country: 'FR',
      label: asText(props.label),
    });
  }

  return results;
}
