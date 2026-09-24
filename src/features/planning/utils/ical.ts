import { addDaysToDateKey } from '../date-utils';
import type { PlanningCalendarEvent } from '../types';

export interface ParsedICSEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string | undefined;
  scheduledStart?: string | undefined;
  scheduledEnd?: string | undefined;
  details?: string | undefined;
}

function compactUtc(value: string): string {
  return value.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

/** Convertit une heure civile du fuseau métier en instant UTC. */
export function zonedLocalDateTimeToIso(date: string, time: string, timeZone: string): string {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  const [hour = 0, minute = 0, second = 0] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = target;

  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(candidate));
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const rendered = Date.UTC(
      pick('year'),
      pick('month') - 1,
      pick('day'),
      pick('hour'),
      pick('minute'),
      pick('second'),
    );
    candidate -= rendered - target;
  }

  return new Date(candidate).toISOString();
}

export function exportEventsToICS(
  events: PlanningCalendarEvent[],
  timeZone = 'Europe/Paris',
): void {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//REZO360//Planning Module//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:REZO360 - Planning & Interventions',
    `X-WR-TIMEZONE:${timeZone}`,
  ];

  events.forEach((event) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeText(event.id)}@rezo360.com`);
    lines.push(`DTSTAMP:${compactUtc(new Date().toISOString())}`);
    if (event.scheduledStart) {
      lines.push(`DTSTART:${compactUtc(event.scheduledStart)}`);
      if (event.scheduledEnd) lines.push(`DTEND:${compactUtc(event.scheduledEnd)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}`);
      const exclusiveEnd = addDaysToDateKey(event.endDate ?? event.date, 1);
      lines.push(`DTEND;VALUE=DATE:${exclusiveEnd.replace(/-/g, '')}`);
    }
    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.details) lines.push(`DESCRIPTION:${escapeText(event.details)}`);
    if (event.address) lines.push(`LOCATION:${escapeText(event.address)}`);
    if (event.technicianName) {
      lines.push(`ATTENDEE;CN=${escapeText(event.technicianName)}:mailto:dispatch@rezo360.com`);
    }
    lines.push(event.status === 'cancelled' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `planning_rezo360_${new Date().toISOString().split('T')[0]}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function property(block: string, name: string): { params: string; value: string } | null {
  const match = block.match(new RegExp(`^${name}([^:]*)\\:(.*)$`, 'im'));
  return match ? { params: match[1] ?? '', value: (match[2] ?? '').trim() } : null;
}

function parseDateTime(
  raw: string,
  params: string,
  fallbackTimeZone: string,
): { date: string; instant?: string } | null {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  if (!match[4] || !match[5]) return { date };
  const time = `${match[4]}:${match[5]}:${match[6] ?? '00'}`;
  if (match[7] === 'Z') {
    return { date, instant: new Date(`${date}T${time}Z`).toISOString() };
  }
  const tzid = params.match(/TZID=([^;:]+)/i)?.[1] ?? fallbackTimeZone;
  return { date, instant: zonedLocalDateTimeToIso(date, time, tzid) };
}

export function parseICS(content: string, timeZone = 'Europe/Paris'): ParsedICSEvent[] {
  const events: ParsedICSEvent[] = [];
  const unfolded = content.replace(/\r?\n[ \t]/g, '');
  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match: RegExpExecArray | null;

  while ((match = veventRegex.exec(unfolded)) !== null) {
    const block = match[1] ?? '';
    const startProperty = property(block, 'DTSTART');
    const parsedStart = startProperty
      ? parseDateTime(startProperty.value, startProperty.params, timeZone)
      : null;
    if (!parsedStart) continue;
    const endProperty = property(block, 'DTEND');
    const parsedEnd = endProperty
      ? parseDateTime(endProperty.value, endProperty.params, timeZone)
      : null;
    const summary = property(block, 'SUMMARY')?.value;
    const details = property(block, 'DESCRIPTION')?.value;
    const rawUid = property(block, 'UID')?.value.replace(/@.*/, '');

    events.push({
      id: rawUid || `import-${String(events.length + 1)}-${parsedStart.date}`,
      title: summary ? unescapeText(summary) : 'Événement importé',
      date: parsedStart.date,
      ...(parsedEnd ? { endDate: parsedEnd.date } : {}),
      ...(parsedStart.instant ? { scheduledStart: parsedStart.instant } : {}),
      ...(parsedEnd?.instant ? { scheduledEnd: parsedEnd.instant } : {}),
      ...(details ? { details: unescapeText(details) } : {}),
    });
  }

  return events;
}
