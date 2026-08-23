import type { HolidayTerritory, PublicHoliday } from './types';

/**
 * Jours fériés français, calculés.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE FONCTION PLUTÔT QU'UNE LISTE
 *
 * La version précédente énumérait les fériés de 2026, à la main. Trois d'entre
 * eux — lundi de Pâques, Ascension, lundi de Pentecôte — se déplacent chaque
 * année. Une liste figée n'est donc pas seulement incomplète pour 2027 : elle
 * est FAUSSE, et de la pire manière, puisqu'elle affiche des dates plausibles.
 * Un décompte de congés calculé sur un férié qui n'en est pas se traduit par un
 * jour de trop ou de moins sur un bulletin.
 *
 * Ces trois dates dérivent toutes de Pâques, qui se calcule. Une table en base
 * aurait le même défaut qu'une liste, avec une migration à écrire chaque
 * décembre en prime.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const HOLIDAY_TERRITORIES: {
  id: HolidayTerritory;
  label: string;
  code: string;
  flag: string;
}[] = [
  { id: 'metropole', label: 'France Métropolitaine', code: 'FR', flag: '🇫🇷' },
  { id: 'guadeloupe', label: 'Guadeloupe (971)', code: '971', flag: '🇬🇵' },
  { id: 'martinique', label: 'Martinique (972)', code: '972', flag: '🇲🇶' },
  { id: 'guyane', label: 'Guyane (973)', code: '973', flag: '🇬🇫' },
  { id: 'reunion', label: 'La Réunion (974)', code: '974', flag: '🇷🇪' },
  { id: 'mayotte', label: 'Mayotte (976)', code: '976', flag: '🇾🇹' },
  { id: 'alsace_moselle', label: 'Alsace-Moselle', code: 'ALS', flag: '🇫🇷' },
];

/**
 * Dimanche de Pâques, algorithme de Meeus/Jones/Butcher (calendrier grégorien).
 *
 * Reproduit tel quel : ce n'est pas le genre de calcul qu'on adapte « pour
 * simplifier ». Il est valable de 1583 à 4099, ce qui couvre confortablement la
 * durée de vie de ce logiciel.
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * `YYYY-MM-DD` en temps universel.
 *
 * `toISOString().slice(0, 10)` sur une date construite en heure locale décale
 * d'un jour à l'ouest de Greenwich — un férié qui tombe la veille pour un
 * utilisateur en Guadeloupe. Tout est donc construit et lu en UTC.
 */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shift(from: Date, days: number): string {
  return isoDate(new Date(from.getTime() + days * 86_400_000));
}

function pad(month: number, day: number, year: number): string {
  return `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const TERRITORY_LABELS: Record<HolidayTerritory | 'national', string> = {
  national: 'National',
  metropole: 'France Métropolitaine',
  guadeloupe: 'Guadeloupe',
  martinique: 'Martinique',
  guyane: 'Guyane',
  reunion: 'La Réunion',
  mayotte: 'Mayotte',
  alsace_moselle: 'Alsace-Moselle',
};

function holiday(
  date: string,
  name: string,
  territory: HolidayTerritory | 'national',
): PublicHoliday {
  return { date, name, territory, territoryLabel: TERRITORY_LABELS[territory] };
}

/** Les onze fériés du socle national, pour une année donnée. */
export function getNationalHolidays(year: number): PublicHoliday[] {
  const easter = easterSunday(year);

  return [
    holiday(pad(1, 1, year), 'Jour de l’An', 'national'),
    holiday(shift(easter, 1), 'Lundi de Pâques', 'national'),
    holiday(pad(5, 1, year), 'Fête du Travail', 'national'),
    holiday(pad(5, 8, year), 'Victoire 1945', 'national'),
    holiday(shift(easter, 39), 'Ascension', 'national'),
    holiday(shift(easter, 50), 'Lundi de Pentecôte', 'national'),
    holiday(pad(7, 14, year), 'Fête Nationale', 'national'),
    holiday(pad(8, 15, year), 'Assomption', 'national'),
    holiday(pad(11, 1, year), 'Toussaint', 'national'),
    holiday(pad(11, 11, year), 'Armistice 1918', 'national'),
    holiday(pad(12, 25, year), 'Noël', 'national'),
  ];
}

/**
 * Les fériés propres à un territoire.
 *
 * Les dates d'abolition de l'esclavage sont FIXES et diffèrent d'un territoire
 * à l'autre : elles commémorent la promulgation locale du décret de 1848, qui
 * n'a pas eu lieu le même jour partout. Les aligner serait une erreur
 * historique autant qu'une erreur de paie.
 */
function getTerritoryHolidays(territory: HolidayTerritory, year: number): PublicHoliday[] {
  const goodFriday = shift(easterSunday(year), -2);

  switch (territory) {
    case 'martinique':
      return [
        holiday(goodFriday, 'Vendredi Saint', territory),
        holiday(pad(5, 22, year), 'Abolition de l’esclavage', territory),
        holiday(pad(7, 21, year), 'Fête Victor Schœlcher', territory),
      ];
    case 'guadeloupe':
      return [
        holiday(goodFriday, 'Vendredi Saint', territory),
        holiday(pad(5, 27, year), 'Abolition de l’esclavage', territory),
        holiday(pad(7, 21, year), 'Fête Victor Schœlcher', territory),
      ];
    case 'guyane':
      return [holiday(pad(6, 10, year), 'Abolition de l’esclavage', territory)];
    case 'reunion':
      return [holiday(pad(12, 20, year), 'Abolition de l’esclavage (Fête Caf’)', territory)];
    case 'mayotte':
      return [holiday(pad(4, 27, year), 'Abolition de l’esclavage', territory)];
    case 'alsace_moselle':
      return [
        holiday(goodFriday, 'Vendredi Saint', territory),
        holiday(pad(12, 26, year), 'Saint-Étienne', territory),
      ];
    case 'metropole':
      return [];
  }
}

/** Socle national et fériés locaux, triés par date. */
export function getHolidaysForTerritory(
  territory: HolidayTerritory,
  year: number = new Date().getUTCFullYear(),
): PublicHoliday[] {
  return [...getNationalHolidays(year), ...getTerritoryHolidays(territory, year)].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/** Index des dates fériées, pour savoir vite si un jour donné en est un. */
export function holidayDateSet(
  territory: HolidayTerritory,
  year: number = new Date().getUTCFullYear(),
): Set<string> {
  return new Set(getHolidaysForTerritory(territory, year).map((entry) => entry.date));
}
