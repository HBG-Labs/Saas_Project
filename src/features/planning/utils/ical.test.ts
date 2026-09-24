import { describe, expect, it } from 'vitest';

import { parseICS, zonedLocalDateTimeToIso } from './ical';

describe('iCalendar du planning', () => {
  it('préserve les horaires UTC importés', () => {
    const [event] = parseICS(
      `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:mission-42@example.test\nDTSTART:20260923T120000Z\nDTEND:20260923T133000Z\nSUMMARY:Maintenance réseau\nEND:VEVENT\nEND:VCALENDAR`,
    );

    expect(event).toMatchObject({
      id: 'mission-42',
      date: '2026-09-23',
      scheduledStart: '2026-09-23T12:00:00.000Z',
      scheduledEnd: '2026-09-23T13:30:00.000Z',
    });
  });

  it('respecte le TZID et déplie les lignes continuées', () => {
    const [event] = parseICS(
      `BEGIN:VEVENT\r\nUID:local-1\r\nDTSTART;TZID=America/Martinique:20260923T080000\r\nSUMMARY:Visite technique\r\nDESCRIPTION:Première ligne\r\n suite\r\nEND:VEVENT`,
    );

    expect(event?.scheduledStart).toBe('2026-09-23T12:00:00.000Z');
    expect(event?.details).toBe('Première lignesuite');
  });

  it('convertit une saisie métier sans dépendre du fuseau du navigateur', () => {
    expect(zonedLocalDateTimeToIso('2026-09-23', '09:00:00', 'America/Martinique')).toBe(
      '2026-09-23T13:00:00.000Z',
    );
    expect(zonedLocalDateTimeToIso('2026-09-23', '09:00:00', 'Europe/Paris')).toBe(
      '2026-09-23T07:00:00.000Z',
    );
  });
});
