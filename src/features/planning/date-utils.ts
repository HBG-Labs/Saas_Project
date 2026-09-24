const DATE_KEY_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function dateKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = DATE_KEY_FORMATTERS.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  DATE_KEY_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function timeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = TIME_FORMATTERS.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  TIME_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

/** La clé civile de l'organisation, jamais celle du navigateur. */
export function organizationDateKey(value: Date | string, timeZone: string): string {
  const parts = dateKeyFormatter(timeZone).formatToParts(
    typeof value === 'string' ? new Date(value) : value,
  );
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
}

export function organizationTime(value: Date | string, timeZone: string): string {
  return timeFormatter(timeZone).format(typeof value === 'string' ? new Date(value) : value);
}

/**
 * Manipulations de jours civils sans décalage DST. La date UTC n'est ici qu'un
 * conteneur pour YYYY-MM-DD : elle n'est jamais présentée comme un instant.
 */
export function dateKeyToUtcDate(dateKey: string): Date {
  const [year = 1970, month = 1, day = 1] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function utcDateToDateKey(date: Date): string {
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateToDateKey(date);
}

export function startOfIsoWeek(dateKey: string): string {
  const date = dateKeyToUtcDate(dateKey);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addDaysToDateKey(dateKey, -mondayOffset);
}

export function monthBounds(dateKey: string): { from: string; to: string } {
  const date = dateKeyToUtcDate(dateKey);
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { from: utcDateToDateKey(first), to: utcDateToDateKey(last) };
}

/**
 * Borne serveur volontairement élargie d'un jour de chaque côté : PostgREST
 * filtre des instants UTC, puis l'adaptateur les range selon le fuseau métier.
 */
export function dateKeysToSafeIsoRange(from: string, to: string): { from: string; to: string } {
  return {
    from: `${addDaysToDateKey(from, -1)}T00:00:00.000Z`,
    to: `${addDaysToDateKey(to, 2)}T00:00:00.000Z`,
  };
}
