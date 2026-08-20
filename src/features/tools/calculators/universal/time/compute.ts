export type TimeMode = 'between_times' | 'add_subtract' | 'decimal_conversion';

/**
 * Calcule la durée entre deux heures au format HH:MM
 * Ex: 07:30 -> 15:45 = 8h 15min = 8.25h
 */
export function computeBetweenTimes(
  startTime: string,
  endTime: string,
  breakMinutes: number = 0,
) {
  const parts1 = startTime.split(':');
  const parts2 = endTime.split(':');

  const h1 = parts1.length >= 1 && parts1[0] !== undefined ? Number(parts1[0]) : NaN;
  const m1 = parts1.length >= 2 && parts1[1] !== undefined ? Number(parts1[1]) : NaN;
  const h2 = parts2.length >= 1 && parts2[0] !== undefined ? Number(parts2[0]) : NaN;
  const m2 = parts2.length >= 2 && parts2[1] !== undefined ? Number(parts2[1]) : NaN;

  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) {
    return {
      totalMinutes: 0,
      hours: 0,
      minutes: 0,
      decimalHours: 0,
      formattedDuration: '0 h 00 min',
      formattedDecimal: '0,00 h',
    };
  }

  let startTotal = h1 * 60 + m1;
  let endTotal = h2 * 60 + m2;

  // Si l'heure de fin est inférieure à l'heure de début, on passe minuit (+24h)
  if (endTotal < startTotal) {
    endTotal += 24 * 60;
  }

  const rawMinutes = endTotal - startTotal;
  const totalMinutes = Math.max(0, rawMinutes - breakMinutes);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const decimalHours = Number((totalMinutes / 60).toFixed(2));

  return {
    totalMinutes,
    hours,
    minutes,
    decimalHours,
    formattedDuration: `${hours} h ${minutes.toString().padStart(2, '0')} min`,
    formattedDecimal: `${decimalHours.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} h`,
  };
}

/**
 * Additionne ou soustrait des durées
 */
export function computeAddSubtractDuration(
  h1: number,
  m1: number,
  s1: number,
  h2: number,
  m2: number,
  s2: number,
  operation: 'add' | 'subtract' = 'add',
) {
  const totalSec1 = h1 * 3600 + m1 * 60 + s1;
  const totalSec2 = h2 * 3600 + m2 * 60 + s2;

  const resultSec =
    operation === 'add' ? totalSec1 + totalSec2 : Math.max(0, totalSec1 - totalSec2);

  const hours = Math.floor(resultSec / 3600);
  const minutes = Math.floor((resultSec % 3600) / 60);
  const seconds = resultSec % 60;
  const decimalHours = Number((resultSec / 3600).toFixed(4));

  return {
    totalSeconds: resultSec,
    hours,
    minutes,
    seconds,
    decimalHours,
    formatted: `${hours} h ${minutes.toString().padStart(2, '0')} min ${seconds.toString().padStart(2, '0')} s`,
    formattedDecimal: `${decimalHours.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} h`,
  };
}

/**
 * Convertit des heures décimales en HH:MM:SS et inversement
 */
export function convertDecimalHours(val: number, direction: 'decimal_to_hms' | 'hms_to_decimal') {
  if (isNaN(val)) {
    return { hours: 0, minutes: 0, seconds: 0, decimal: 0, formatted: '0 h 00 min' };
  }

  if (direction === 'decimal_to_hms') {
    const totalSeconds = Math.round(val * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      hours,
      minutes,
      seconds,
      decimal: val,
      formatted: `${hours} h ${minutes.toString().padStart(2, '0')} min ${seconds > 0 ? `${seconds} s` : ''}`.trim(),
    };
  }

  // Si on a des minutes totales ou secondes
  return {
    hours: Math.floor(val),
    minutes: Math.round((val - Math.floor(val)) * 60),
    seconds: 0,
    decimal: val,
    formatted: `${val.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} h`,
  };
}
