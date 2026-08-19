import type { PlanningCalendarEvent } from '../types';

export interface ParsedICSEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string | undefined;
  details?: string | undefined;
}

export function exportEventsToICS(events: PlanningCalendarEvent[]): void {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//REZO360//Planning Module//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:REZO360 - Planning & Interventions',
    'X-WR-TIMEZONE:Europe/Paris',
  ];

  events.forEach((evt) => {
    const formattedDate = evt.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${evt.id}@rezo360.fr`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    lines.push(`DTSTART;VALUE=DATE:${formattedDate}`);
    lines.push(`SUMMARY:${evt.title}`);
    if (evt.details) {
      lines.push(`DESCRIPTION:${evt.details}`);
    }
    if (evt.technicianName) {
      lines.push(`ATTENDEE;CN=${evt.technicianName}:mailto:dispatch@rezo360.fr`);
    }
    lines.push('STATUS:CONFIRMED');
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

export function parseICS(content: string): ParsedICSEvent[] {
  const events: ParsedICSEvent[] = [];
  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match: RegExpExecArray | null;

  while ((match = veventRegex.exec(content)) !== null) {
    const block = match[1] ?? '';

    // Extract summary
    const summaryMatch = block.match(/SUMMARY(?::|;[^:]*:)(.*)/);
    const summary = summaryMatch ? summaryMatch[1]?.trim() : 'Événement importé';

    // Extract description
    const descMatch = block.match(/DESCRIPTION(?::|;[^:]*:)(.*)/);
    const details = descMatch ? descMatch[1]?.trim() : undefined;

    // Extract start date (DTSTART:20260815 or DTSTART;VALUE=DATE:20260815 or DTSTART:20260815T090000Z)
    const dtstartMatch = block.match(/DTSTART(?::|;[^:]*:)(\d{4})(\d{2})(\d{2})/);
    let dateStr = new Date().toISOString().split('T')[0] ?? '2026-08-16';
    if (dtstartMatch && dtstartMatch[1] && dtstartMatch[2] && dtstartMatch[3]) {
      dateStr = `${dtstartMatch[1]}-${dtstartMatch[2]}-${dtstartMatch[3]}`;
    }

    // Extract UID
    const uidMatch = block.match(/UID(?::|;[^:]*:)(.*)/);
    const rawUid = uidMatch ? uidMatch[1]?.trim().replace(/@.*/, '') : undefined;
    const id = rawUid || `import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    events.push({
      id,
      title: summary || 'Sans titre',
      date: dateStr,
      details,
    });
  }

  return events;
}
