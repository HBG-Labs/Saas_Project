/**
 * Catalogue des avatars REZO360 — GÉNÉRÉ, ne pas modifier à la main.
 *
 * Produit par `scripts/generate-avatars.mjs`, en même temps que les SVG de
 * `public/avatars/`. Les deux sorties viennent de la même table : un
 * identifiant ne peut donc pas exister ici sans son fichier, ni l'inverse.
 *
 * Pour changer la collection, éditer le script puis relancer :
 *   node scripts/generate-avatars.mjs
 */

/** Familles de coiffure, telles qu'exposées aux filtres de la galerie. */
export type FamilleCoiffure =
  | 'courts'
  | 'ondules'
  | 'boucles'
  | 'crepus'
  | 'locks'
  | 'tresses'
  | 'attaches'
  | 'longs';

export interface AvatarCatalogue {
  id: string;
  coiffure: FamilleCoiffure;
  /** Identifiant de carnation, de la plus claire (c1) à la plus profonde (c8). */
  carnation: string;
  lunettes: boolean;
  pilosite: boolean;
  tenue: string;
}

export const AVATARS: readonly AvatarCatalogue[] = [
  { id: 'avatar-01', coiffure: 'courts', carnation: 'c1', lunettes: false, pilosite: false, tenue: 'polo' },
  { id: 'avatar-02', coiffure: 'courts', carnation: 'c5', lunettes: false, pilosite: true, tenue: 'chemiseTravail' },
  { id: 'avatar-03', coiffure: 'longs', carnation: 'c2', lunettes: false, pilosite: false, tenue: 'blazer' },
  { id: 'avatar-04', coiffure: 'crepus', carnation: 'c7', lunettes: true, pilosite: false, tenue: 'teeShirt' },
  { id: 'avatar-05', coiffure: 'courts', carnation: 'c3', lunettes: false, pilosite: true, tenue: 'chemise' },
  { id: 'avatar-06', coiffure: 'locks', carnation: 'c8', lunettes: false, pilosite: true, tenue: 'polaire' },
  { id: 'avatar-07', coiffure: 'attaches', carnation: 'c1', lunettes: true, pilosite: false, tenue: 'blazer' },
  { id: 'avatar-08', coiffure: 'boucles', carnation: 'c4', lunettes: false, pilosite: false, tenue: 'polo' },
  { id: 'avatar-09', coiffure: 'tresses', carnation: 'c6', lunettes: false, pilosite: false, tenue: 'chemise' },
  { id: 'avatar-10', coiffure: 'courts', carnation: 'c2', lunettes: true, pilosite: true, tenue: 'gilet' },
  { id: 'avatar-11', coiffure: 'longs', carnation: 'c3', lunettes: false, pilosite: false, tenue: 'teeShirt' },
  { id: 'avatar-12', coiffure: 'courts', carnation: 'c1', lunettes: false, pilosite: true, tenue: 'polaire' },
  { id: 'avatar-13', coiffure: 'crepus', carnation: 'c7', lunettes: false, pilosite: false, tenue: 'blazer' },
  { id: 'avatar-14', coiffure: 'courts', carnation: 'c4', lunettes: false, pilosite: true, tenue: 'chemiseTravail' },
  { id: 'avatar-15', coiffure: 'attaches', carnation: 'c5', lunettes: true, pilosite: false, tenue: 'chemise' },
  { id: 'avatar-16', coiffure: 'ondules', carnation: 'c2', lunettes: false, pilosite: false, tenue: 'polo' },
  { id: 'avatar-17', coiffure: 'longs', carnation: 'c8', lunettes: false, pilosite: false, tenue: 'blazer' },
  { id: 'avatar-18', coiffure: 'courts', carnation: 'c3', lunettes: true, pilosite: true, tenue: 'chemise' },
  { id: 'avatar-19', coiffure: 'attaches', carnation: 'c6', lunettes: false, pilosite: false, tenue: 'teeShirt' },
  { id: 'avatar-20', coiffure: 'courts', carnation: 'c1', lunettes: true, pilosite: false, tenue: 'gilet' },
  { id: 'avatar-21', coiffure: 'attaches', carnation: 'c4', lunettes: false, pilosite: false, tenue: 'chemise' },
  { id: 'avatar-22', coiffure: 'locks', carnation: 'c7', lunettes: false, pilosite: true, tenue: 'polo' },
  { id: 'avatar-23', coiffure: 'longs', carnation: 'c2', lunettes: true, pilosite: false, tenue: 'blazer' },
  { id: 'avatar-24', coiffure: 'boucles', carnation: 'c5', lunettes: false, pilosite: true, tenue: 'polaire' },
  { id: 'avatar-25', coiffure: 'longs', carnation: 'c1', lunettes: true, pilosite: false, tenue: 'chemise' },
  { id: 'avatar-26', coiffure: 'crepus', carnation: 'c6', lunettes: false, pilosite: true, tenue: 'chemiseTravail' },
  { id: 'avatar-27', coiffure: 'attaches', carnation: 'c3', lunettes: false, pilosite: false, tenue: 'teeShirt' },
  { id: 'avatar-28', coiffure: 'tresses', carnation: 'c8', lunettes: true, pilosite: false, tenue: 'blazer' },
  { id: 'avatar-29', coiffure: 'courts', carnation: 'c2', lunettes: false, pilosite: true, tenue: 'polo' },
  { id: 'avatar-30', coiffure: 'ondules', carnation: 'c4', lunettes: false, pilosite: false, tenue: 'chemise' },
  { id: 'avatar-31', coiffure: 'courts', carnation: 'c7', lunettes: true, pilosite: true, tenue: 'polaire' },
  { id: 'avatar-32', coiffure: 'longs', carnation: 'c1', lunettes: false, pilosite: false, tenue: 'teeShirt' },
  { id: 'avatar-33', coiffure: 'courts', carnation: 'c5', lunettes: false, pilosite: true, tenue: 'gilet' },
  { id: 'avatar-34', coiffure: 'attaches', carnation: 'c3', lunettes: false, pilosite: false, tenue: 'blazer' },
  { id: 'avatar-35', coiffure: 'crepus', carnation: 'c6', lunettes: false, pilosite: true, tenue: 'chemiseTravail' },
  { id: 'avatar-36', coiffure: 'courts', carnation: 'c2', lunettes: true, pilosite: false, tenue: 'chemise' },
  { id: 'avatar-37', coiffure: 'courts', carnation: 'c8', lunettes: true, pilosite: true, tenue: 'gilet' },
  { id: 'avatar-38', coiffure: 'longs', carnation: 'c4', lunettes: false, pilosite: false, tenue: 'polo' },
  { id: 'avatar-39', coiffure: 'courts', carnation: 'c1', lunettes: true, pilosite: true, tenue: 'blazer' },
  { id: 'avatar-40', coiffure: 'locks', carnation: 'c7', lunettes: false, pilosite: false, tenue: 'polaire' },
  { id: 'avatar-41', coiffure: 'ondules', carnation: 'c3', lunettes: false, pilosite: true, tenue: 'chemise' },
  { id: 'avatar-42', coiffure: 'tresses', carnation: 'c5', lunettes: true, pilosite: false, tenue: 'teeShirt' },
  { id: 'avatar-43', coiffure: 'attaches', carnation: 'c2', lunettes: false, pilosite: false, tenue: 'chemiseTravail' },
  { id: 'avatar-44', coiffure: 'crepus', carnation: 'c6', lunettes: true, pilosite: false, tenue: 'blazer' },
  { id: 'avatar-45', coiffure: 'courts', carnation: 'c1', lunettes: false, pilosite: true, tenue: 'polo' },
  { id: 'avatar-46', coiffure: 'longs', carnation: 'c8', lunettes: false, pilosite: false, tenue: 'chemise' },
  { id: 'avatar-47', coiffure: 'boucles', carnation: 'c4', lunettes: false, pilosite: true, tenue: 'polaire' },
  { id: 'avatar-48', coiffure: 'attaches', carnation: 'c3', lunettes: false, pilosite: false, tenue: 'teeShirt' },
  { id: 'avatar-49', coiffure: 'courts', carnation: 'c7', lunettes: true, pilosite: true, tenue: 'gilet' },
  { id: 'avatar-50', coiffure: 'longs', carnation: 'c2', lunettes: true, pilosite: false, tenue: 'blazer' },
];

/** Identifiant retenu quand aucun choix n'a été fait, ni aucun repli possible. */
export const AVATAR_PAR_DEFAUT = 'avatar-01';

const IDS = new Set(AVATARS.map((a) => a.id));

/** L'identifiant désigne-t-il un avatar de la collection courante ? */
export function estAvatarConnu(id: string | null | undefined): id is string {
  return typeof id === 'string' && IDS.has(id);
}

/**
 * Chemin du fichier SVG. Statique et servi par le CDN : aucun appel réseau
 * applicatif, et le navigateur le met en cache comme n'importe quelle image.
 */
export function cheminAvatar(id: string): string {
  return `/avatars/${id}.svg`;
}
