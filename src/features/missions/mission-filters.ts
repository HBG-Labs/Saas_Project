import type { MissionStatus } from '@/types/database';

import type { MissionFilters } from './api/missions.api';

/**
 * Critères de la liste des missions, tels que l'écran les manipule.
 *
 * Volontairement tout en `string` : ce sont les valeurs que rendent les
 * sélecteurs et les champs de date, et les convertir à chaque frappe
 * multiplierait les états intermédiaires invalides. La traduction vers les
 * filtres de l'API se fait en un seul endroit, `toMissionQuery`, qui est pur et
 * testable sans écran.
 */
export interface MissionListFilters {
  search: string;
  /** `ANY_STATUS` (les états non terminaux), ou un `MissionStatus` précis. */
  status: string;
  customerId: string;
  teamId: string;
  memberId: string;
  /** `AAAA-MM-JJ`, tel que saisi — borne inclusive sur la planification. */
  from: string;
  to: string;
}

/**
 * Sentinelle « pas de filtre », pour les sélecteurs.
 *
 * Une chaîne vide serait plus naturelle, mais Radix affiche alors le texte de
 * remplacement à la place de l'intitulé choisi : l'utilisateur voit
 * « Sélectionner… » après avoir sélectionné quelque chose.
 */
export const ANY = 'any';

/** Alias lisible, pour le seul sélecteur dont la valeur par défaut a un sens. */
export const ANY_STATUS = ANY;

export const EMPTY_MISSION_FILTERS: MissionListFilters = {
  search: '',
  status: ANY_STATUS,
  customerId: ANY,
  teamId: ANY,
  memberId: ANY,
  from: '',
  to: '',
};

/**
 * Les états terminaux sont exclus par défaut.
 *
 * Une liste de missions sert à savoir quoi faire ensuite. Y laisser les
 * dossiers clos la fait grossir indéfiniment sans jamais rien apporter : au
 * bout d'un an, l'utile se noie dans l'archive. Le filtre reste accessible pour
 * aller les chercher.
 */
export const ACTIVE_STATUSES: readonly MissionStatus[] = [
  'draft',
  'assigned',
  'accepted',
  'in_progress',
  'completed',
  'submitted',
  'rejected',
  'approved',
];

/**
 * Bornes de journée en heure locale.
 *
 * `<input type="date">` rend `AAAA-MM-JJ` sans fuseau. Le concaténer tel quel
 * dans une comparaison sur `timestamptz` le ferait interpréter en UTC : un
 * technicien parisien cherchant le 9 août verrait apparaître une mission
 * planifiée le 8 à 23 h, et manquerait celle du 9 à 23 h 30.
 */
function startOfDay(date: string): string | undefined {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function endOfDay(date: string): string | undefined {
  const parsed = new Date(`${date}T23:59:59.999`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** Traduit les critères de l'écran en filtres pour `listMissions`. */
export function toMissionQuery(filters: MissionListFilters): MissionFilters {
  const search = filters.search.trim();
  const from = filters.from === '' ? undefined : startOfDay(filters.from);
  const to = filters.to === '' ? undefined : endOfDay(filters.to);

  return {
    status:
      filters.status === ANY_STATUS ? ACTIVE_STATUSES : [filters.status as MissionStatus],
    ...(search !== '' ? { search } : {}),
    ...(filters.customerId !== ANY ? { customerId: filters.customerId } : {}),
    ...(filters.teamId !== ANY ? { teamId: filters.teamId } : {}),
    ...(filters.memberId !== ANY ? { memberId: filters.memberId } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
  };
}

/**
 * Nombre de critères actifs.
 *
 * Sert à annoncer sur le bouton combien de filtres sont posés : sans ce
 * compte, une liste courte se lit comme une absence de travail alors qu'un
 * filtre oublié la réduit.
 */
export function countActiveFilters(filters: MissionListFilters): number {
  let count = 0;

  if (filters.search.trim() !== '') count += 1;
  if (filters.status !== ANY_STATUS) count += 1;
  if (filters.customerId !== ANY) count += 1;
  if (filters.teamId !== ANY) count += 1;
  if (filters.memberId !== ANY) count += 1;
  if (filters.from !== '') count += 1;
  if (filters.to !== '') count += 1;

  return count;
}
