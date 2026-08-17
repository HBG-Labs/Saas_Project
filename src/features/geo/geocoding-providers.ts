/**
 * Formes de réponse des deux géocodeurs, et lecture sûre de leur JSON.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EXISTE
 *
 * `response.json()` renvoie `any`. Tout ce qui en découlait — `data.features[0]`,
 * `props.postcode`, `addr.house_number` — échappait au typage : soixante-six
 * erreurs de lint, et surtout aucune garantie qu'un champ existe. Une réponse
 * d'erreur du service, ou un simple changement de schéma chez le fournisseur,
 * produisait `undefined` propagé jusqu'à l'écran plutôt qu'une erreur nette.
 *
 * Les formes ci-dessous ne sont pas exhaustives : elles décrivent ce que le code
 * LIT, et rien de plus. Les gardes vérifient ce que le code SUPPOSE.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Base Adresse Nationale — France métropolitaine et départements d'outre-mer. */
export interface BanProperties {
  label?: unknown;
  name?: unknown;
  street?: unknown;
  postcode?: unknown;
  city?: unknown;
}

export interface BanFeature {
  properties?: BanProperties;
  geometry?: { coordinates?: unknown };
}

/** Nominatim OpenStreetMap — recours quand la BAN ne répond pas. */
export interface NominatimAddress {
  house_number?: unknown;
  road?: unknown;
  suburb?: unknown;
  neighbourhood?: unknown;
  postcode?: unknown;
  city?: unknown;
  town?: unknown;
  village?: unknown;
  municipality?: unknown;
  country_code?: unknown;
}

export interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: unknown;
}

/** Une valeur n'est retenue que si c'est une chaîne non vide. */
export function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** Premier texte non vide de la liste — l'ordre exprime la préférence. */
export function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = asText(value);
    if (text !== undefined) return text;
  }
  return undefined;
}

/**
 * Coordonnées d'un objet GeoJSON, si elles sont exploitables.
 *
 * L'ordre GeoJSON est [longitude, latitude] — l'inverse de la convention
 * usuelle. L'inversion est la faute la plus courante du domaine, et elle place
 * silencieusement un chantier nantais au large de la Somalie.
 */
export function readCoordinates(
  geometry: { coordinates?: unknown } | undefined,
): { latitude: number; longitude: number } | undefined {
  const pair: unknown = geometry?.coordinates;
  if (!Array.isArray(pair) || pair.length < 2) return undefined;

  const [longitude, latitude] = pair as unknown[];
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return undefined;

  return { latitude, longitude };
}

/** Les `features` d'une réponse BAN, sans jamais supposer leur présence. */
export function readBanFeatures(payload: unknown): BanFeature[] {
  if (typeof payload !== 'object' || payload === null) return [];

  const features: unknown = (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];

  return features.filter(
    (feature): feature is BanFeature => typeof feature === 'object' && feature !== null,
  );
}

export function readNominatim(payload: unknown): NominatimResponse | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  return payload;
}
