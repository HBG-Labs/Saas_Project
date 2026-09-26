-- =============================================================================
-- Social Studio — trigger publish permission compatible semaines + posts
-- =============================================================================
--
-- Migration additive uniquement.
-- La fonction `app.enforce_social_publish_permission()` est utilisée à la fois
-- par `social_weeks` et `social_posts`. La version Phase F vérifiait des
-- colonnes propres aux posts même lorsqu'elle était appelée depuis
-- `social_weeks`, ce qui faisait échouer les INSERT/UPDATE de semaines.
-- =============================================================================

create or replace function app.enforce_social_publish_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_requires_publish boolean := false;
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
begin
  -- Les workers et Edge Functions internes utilisent service_role : ils n'ont
  -- pas d'utilisateur courant et franchissent les états techniques côté serveur.
  if v_actor is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_requires_publish :=
      coalesce(new.status, '') in (
        'scheduled',
        'processing',
        'published',
        'partially_published',
        'cancelled'
      )
      or (v_new ? 'approved_by' and nullif(v_new ->> 'approved_by', '') is not null)
      or (v_new ? 'approved_at' and nullif(v_new ->> 'approved_at', '') is not null)
      or (v_new ? 'scheduled_at' and nullif(v_new ->> 'scheduled_at', '') is not null)
      or (v_new ? 'published_at' and nullif(v_new ->> 'published_at', '') is not null)
      or (v_new ? 'instagram_media_id' and nullif(v_new ->> 'instagram_media_id', '') is not null)
      or (v_new ? 'publish_state' and coalesce(v_new ->> 'publish_state', 'not_scheduled') <> 'not_scheduled')
      or (v_new ? 'selected_asset_id' and nullif(v_new ->> 'selected_asset_id', '') is not null)
      or (v_new ? 'approved_snapshot' and coalesce(v_new -> 'approved_snapshot', '{}'::jsonb) <> '{}'::jsonb);
  elsif tg_op = 'UPDATE' then
    v_requires_publish :=
      coalesce(old.status, '') in ('scheduled', 'processing', 'published', 'partially_published')
      or coalesce(new.status, '') in (
        'scheduled',
        'processing',
        'published',
        'partially_published',
        'cancelled'
      )
      or (v_new ? 'publish_state' and coalesce(v_new ->> 'publish_state', 'not_scheduled') in (
        'scheduled',
        'processing',
        'published_simulated',
        'published_live',
        'failed',
        'cancelled',
        'skipped',
        'reconciliation_required'
      ))
      or (v_old ? 'publish_state' and coalesce(v_old ->> 'publish_state', 'not_scheduled') in (
        'scheduled',
        'processing',
        'published_simulated',
        'published_live',
        'failed',
        'cancelled',
        'skipped',
        'reconciliation_required'
      ))
      or (v_new ->> 'approved_by') is distinct from (v_old ->> 'approved_by')
      or (v_new ->> 'approved_at') is distinct from (v_old ->> 'approved_at')
      or (v_new ->> 'scheduled_at') is distinct from (v_old ->> 'scheduled_at')
      or (v_new ->> 'published_at') is distinct from (v_old ->> 'published_at')
      or (v_new ->> 'instagram_media_id') is distinct from (v_old ->> 'instagram_media_id')
      or (v_new ->> 'publish_mode') is distinct from (v_old ->> 'publish_mode')
      or (v_new ->> 'publish_attempt_id') is distinct from (v_old ->> 'publish_attempt_id')
      or (v_new ->> 'publish_attempts') is distinct from (v_old ->> 'publish_attempts')
      or (v_new ->> 'publish_locked_at') is distinct from (v_old ->> 'publish_locked_at')
      or (v_new ->> 'publish_lock_token') is distinct from (v_old ->> 'publish_lock_token')
      or (v_new ->> 'publish_next_attempt_at') is distinct from (v_old ->> 'publish_next_attempt_at')
      or (v_new ->> 'publish_last_error_code') is distinct from (v_old ->> 'publish_last_error_code')
      or (v_new ->> 'publish_last_error_kind') is distinct from (v_old ->> 'publish_last_error_kind')
      or (v_new ->> 'publish_reconciliation_required_at') is distinct from (v_old ->> 'publish_reconciliation_required_at')
      or (v_new ->> 'dry_run_published_at') is distinct from (v_old ->> 'dry_run_published_at')
      or (v_new ->> 'selected_asset_id') is distinct from (v_old ->> 'selected_asset_id')
      or (v_new ->> 'schedule_timezone') is distinct from (v_old ->> 'schedule_timezone')
      or coalesce(v_new -> 'approved_snapshot', '{}'::jsonb) is distinct from coalesce(v_old -> 'approved_snapshot', '{}'::jsonb);
  end if;

  if v_requires_publish
     and not (select app.has_org_permission(new.organization_id, 'social.publish')) then
    raise exception 'La validation ou programmation Social Studio exige social.publish.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function app.enforce_social_publish_permission()
  from public, anon, authenticated;

