import { describe, expect, it } from 'vitest';

import {
  currentWeekStartsOn,
  localDateTimeToIso,
  socialPostFormToPatch,
  splitIsoDateTime,
  validateSocialPostForm,
  type SocialPost,
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

  it('préserve l’heure locale affichée après un aller-retour ISO', () => {
    const iso = localDateTimeToIso('2026-10-25', '18:30');
    expect(splitIsoDateTime(iso, '2026-10-25')).toEqual({ date: '2026-10-25', time: '18:30' });
  });

  it('déprogramme explicitement un post SCHEDULED modifié', () => {
    const post = {
      id: 'post-1',
      organization_id: 'org-1',
      week_id: 'week-1',
      account_id: null,
      slot_index: 1,
      status: 'scheduled',
      format: 'image',
      scheduled_at: '2026-09-29T18:30:00.000Z',
      publish_mode: 'dry_run',
      publish_state: 'scheduled',
      selected_asset_id: 'asset-1',
      schedule_timezone: 'Europe/Paris',
      approved_snapshot: { caption: 'approuve' },
      publish_attempt_id: null,
      publish_attempts: 0,
      publish_locked_at: null,
      publish_lock_token: null,
      publish_next_attempt_at: null,
      publish_last_error_code: null,
      publish_last_error_kind: null,
      publish_reconciliation_required_at: null,
      dry_run_published_at: null,
      hook: 'Ancien hook',
      marketing_angle: null,
      concept: null,
      visual_brief: null,
      visual_text: 'Ancien texte',
      caption: 'Ancienne légende Instagram.',
      cta: 'Voir REZO360',
      hashtags: [],
      image_prompt: null,
      recommendation_reason: null,
      content: { planned_for: '2026-09-29T18:30:00.000Z' },
      approved_by: 'user-1',
      approved_at: '2026-09-28T08:00:00.000Z',
      cancelled_by: null,
      cancelled_at: null,
      published_at: null,
      instagram_media_id: null,
      last_error: null,
      created_by: null,
      created_at: '2026-09-26T00:00:00.000Z',
      updated_at: '2026-09-26T00:00:00.000Z',
    } satisfies SocialPost;

    const patch = socialPostFormToPatch(post, VALID, 'ready');

    expect(patch.status).toBe('ready');
    expect(patch.scheduled_at).toBeNull();
    expect(patch.approved_by).toBeNull();
    expect(patch.approved_at).toBeNull();
    expect(patch.selected_asset_id).toBeNull();
    expect(patch.publish_state).toBe('not_scheduled');
  });
});
