/**
 * Formatage localisé.
 *
 * `Intl` est natif : aucune librairie de dates n'est nécessaire pour ces
 * besoins, et une dépendance de 70 ko pour afficher « il y a 3 jours » serait
 * disproportionnée.
 */

const relativeFormatter = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

const DIVISIONS: readonly { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

/** « il y a 3 jours », « dans 2 heures ». */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  let duration = (date.getTime() - Date.now()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeFormatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return '';
}

const dateFormatter = new Intl.DateTimeFormat('fr', { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat('fr', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}

export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date);
}

const numberFormatter = new Intl.NumberFormat('fr');

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}
