import { describe, expect, it } from 'vitest';

import {
  addDaysToDateKey,
  dateKeysToSafeIsoRange,
  monthBounds,
  organizationDateKey,
  startOfIsoWeek,
} from './date-utils';

describe('dates civiles du planning', () => {
  it('range un même instant dans la journée de l’organisation', () => {
    const instant = '2026-09-23T02:30:00.000Z';

    expect(organizationDateKey(instant, 'Europe/Paris')).toBe('2026-09-23');
    expect(organizationDateKey(instant, 'America/Martinique')).toBe('2026-09-22');
  });

  it('navigue par jours civils sans être décalé par les changements d’heure', () => {
    expect(addDaysToDateKey('2026-03-29', 1)).toBe('2026-03-30');
    expect(startOfIsoWeek('2026-09-23')).toBe('2026-09-21');
    expect(monthBounds('2028-02-14')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('élargit la fenêtre UTC avant le rangement dans le fuseau métier', () => {
    expect(dateKeysToSafeIsoRange('2026-09-21', '2026-09-27')).toEqual({
      from: '2026-09-20T00:00:00.000Z',
      to: '2026-09-29T00:00:00.000Z',
    });
  });
});
