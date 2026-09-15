import { describe, expect, it } from 'vitest';

import { organizationSettingsSchema, parseReminderDays } from './organization.schema';

describe('parseReminderDays', () => {
  it('lit « 7, 14 » et trie/dédoublonne', () => {
    expect(parseReminderDays('7, 14')).toEqual([7, 14]);
    expect(parseReminderDays('14 7 7')).toEqual([7, 14]);
    expect(parseReminderDays('3;10;20')).toEqual([3, 10, 20]);
  });

  it('vide = aucune relance', () => {
    expect(parseReminderDays('')).toEqual([]);
    expect(parseReminderDays('   ')).toEqual([]);
  });

  it('refuse ce que la base refuserait : 0, > 365, plus de cinq, non entier', () => {
    expect(parseReminderDays('0')).toBeNull();
    expect(parseReminderDays('400')).toBeNull();
    expect(parseReminderDays('1,2,3,4,5,6')).toBeNull();
    expect(parseReminderDays('7.5')).toBeNull();
    expect(parseReminderDays('sept')).toBeNull();
  });
});

describe('organizationSettingsSchema — quoteReminderDays', () => {
  const base = { name: 'HBG Labs', slug: 'hbg-labs' };

  it('accepte une cadence valide et le champ vide', () => {
    expect(organizationSettingsSchema.safeParse({ ...base, quoteReminderDays: '7, 14' }).success).toBe(true);
    expect(organizationSettingsSchema.safeParse({ ...base, quoteReminderDays: '' }).success).toBe(true);
  });

  it('nomme le champ fautif sur une cadence invalide', () => {
    const result = organizationSettingsSchema.safeParse({ ...base, quoteReminderDays: '0, 999' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['quoteReminderDays']);
    }
  });
});
