import { describe, expect, it } from 'vitest';

import {
  currentWeekStartsOn,
  localDateTimeToIso,
  validateSocialPostForm,
  type SocialPostFormValues,
} from './weekly-planning';

const VALID: SocialPostFormValues = {
  plannedDate: '2026-09-29',
  plannedTime: '18:30',
  hook: 'Vous gérez encore vos interventions comme ça ?',
  visualText: 'Une semaine claire avant le premier appel.',
  caption: 'Une légende complète, humaine et suffisamment précise pour Instagram.',
  cta: 'Voir REZO360 en action',
  objective: 'Visites du profil',
  audience: 'Artisans',
};

describe('weekly-planning', () => {
  it('calcule le lundi de la semaine courante', () => {
    expect(currentWeekStartsOn(new Date('2026-09-30T12:00:00'))).toBe('2026-09-28');
    expect(currentWeekStartsOn(new Date('2026-10-04T12:00:00'))).toBe('2026-09-28');
  });

  it('autorise un brouillon incomplet mais refuse READY sans contenu fort', () => {
    const incomplete = { ...VALID, hook: '', visualText: '', caption: '', cta: '' };

    expect(validateSocialPostForm(incomplete, 'draft').success).toBe(true);
    expect(validateSocialPostForm(incomplete, 'ready').success).toBe(false);
  });

  it('valide READY lorsque hook, visuel, légende et CTA sont présents', () => {
    expect(validateSocialPostForm(VALID, 'ready').success).toBe(true);
  });

  it('convertit la date locale en ISO pour stockage dans content.planned_for', () => {
    expect(localDateTimeToIso('2026-09-29', '18:30')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:30:00.000Z$/,
    );
  });
});
