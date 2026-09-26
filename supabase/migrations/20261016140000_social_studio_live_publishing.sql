-- =============================================================================
-- Social Studio — publication Instagram live verrouillée
-- =============================================================================
--
-- Migration additive uniquement.
-- Elle ne crée aucun cron et ne publie rien : elle prépare les primitives DB
-- nécessaires au worker live, distinctes du dry-run Phase F.
-- =============================================================================

alter table public.social_posts
  add column if not exists instagram_container_id text,
  add column if not exists instagram_container_status text,
  add column if not exists instagram_container_checked_at timestamptz,
  add column if not exists instagram_permalink text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'social_posts_instagram_container_id_not_blank'
      and conrelid = 'public.social_posts'::regclass
  ) then
    alter table public.social_posts
      add constraint social_posts_instagram_container_id_not_blank
      check (instagram_container_id is null or length(btrim(instagram_container_id)) between 1 and 180);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'social_posts_instagram_media_id_not_blank'
      and conrelid = 'public.social_posts'::regclass
  ) then
    alter table public.social_posts
      add constraint social_posts_instagram_media_id_not_blank
      check (instagram_media_id is null or length(btrim(instagram_media_id)) between 1 and 180);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'social_posts_instagram_container_status_not_blank'
      and conrelid = 'public.social_posts'::regclass
  ) then
    alter table public.social_posts
      add constraint social_posts_instagram_container_status_not_blank
      check (
        instagram_container_status is null
        or length(btrim(instagram_container_status)) between 1 and 80
      );
  end if;
end;
$$;

create index if not exists social_posts_instagram_container_idx
  on public.social_posts (organization_id, instagram_container_id)
  where instagram_container_id is not null;

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
      or (v_new ? 'instagram_container_id' and nullif(v_new ->> 'instagram_container_id', '') is not null)
      or (v_new ? 'instagram_permalink' and nullif(v_new ->> 'instagram_permalink', '') is not null)
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
      or (v_new ->> 'instagram_container_id') is distinct from (v_old ->> 'instagram_container_id')
      or (v_new ->> 'instagram_container_status') is distinct from (v_old ->> 'instagram_container_status')
      or (v_new ->> 'instagram_container_checked_at') is distinct from (v_old ->> 'instagram_container_checked_at')
      or (v_new ->> 'instagram_permalink') is distinct from (v_old ->> 'instagram_permalink')
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

create or replace function public.validate_and_schedule_social_week_live(
  p_organization_id uuid,
  p_week_id uuid,
  p_timezone text default 'Europe/Paris'
)
returns table (
  week_id uuid,
  scheduled_count integer,
  schedule_status text,
  schedule_timezone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_result record;
  v_account public.social_accounts%rowtype;
  v_updated integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  if not (select app.can_use_pro_module(p_organization_id, 'social_studio')) then
    raise exception 'Social Studio non disponible pour cette organisation.'
      using errcode = 'insufficient_privilege';
  end if;

  if not (select app.has_org_permission(p_organization_id, 'social.publish')) then
    raise exception 'La publication Instagram live exige social.publish.'
      using errcode = 'insufficient_privilege';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':social-week-live:' || p_week_id::text, 0));

  select *
    into v_account
  from public.social_accounts
  where organization_id = p_organization_id
    and provider = 'instagram'
    and status = 'connected'
    and provider_account_id is not null
    and publishing_suspended_at is null
  order by last_synced_at desc nulls last, connected_at desc nulls last, created_at desc
  limit 1;

  if not found then
    raise exception 'Aucun compte Instagram connecte et actif pour publier cette semaine.'
      using errcode = 'foreign_key_violation';
  end if;

  select *
    into v_result
  from public.validate_and_schedule_social_week(p_organization_id, p_week_id, p_timezone);

  update public.social_posts post
     set account_id = v_account.id,
         publish_mode = 'live',
         publish_state = 'scheduled',
         publish_attempt_id = null,
         publish_locked_at = null,
         publish_lock_token = null,
         publish_next_attempt_at = null,
         publish_last_error_code = null,
         publish_last_error_kind = null,
         instagram_container_id = null,
         instagram_container_status = null,
         instagram_container_checked_at = null,
         instagram_media_id = null,
         instagram_permalink = null,
         approved_snapshot = coalesce(post.approved_snapshot, '{}'::jsonb)
           || jsonb_build_object(
             'mode', 'live',
             'instagram_account', jsonb_build_object(
               'id', v_account.id,
               'provider_account_id', v_account.provider_account_id,
               'username', v_account.username
             )
           )
   where post.organization_id = p_organization_id
     and post.week_id = p_week_id
     and post.status = 'scheduled'
     and post.publish_state = 'scheduled';

  get diagnostics v_updated = row_count;
  if v_updated <> 7 then
    raise exception 'Les 7 publications doivent etre programmees avant activation live.'
      using errcode = 'check_violation';
  end if;

  update public.social_weeks week
     set account_id = v_account.id,
         strategy = coalesce(week.strategy, '{}'::jsonb) || jsonb_build_object(
           'approval', coalesce(week.strategy -> 'approval', '{}'::jsonb)
             || jsonb_build_object(
               'mode', 'live',
               'instagram_account_id', v_account.id,
               'instagram_username', v_account.username
             )
         )
   where week.id = p_week_id
     and week.organization_id = p_organization_id;

  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id,
    v_actor,
    'social.week_scheduled_live',
    'social_week',
    p_week_id,
    jsonb_build_object('posts', 7, 'mode', 'live', 'account_id', v_account.id)
  );

  return query select
    p_week_id,
    v_result.scheduled_count::integer,
    v_result.schedule_status::text,
    v_result.schedule_timezone::text;
end;
$$;

revoke all on function public.validate_and_schedule_social_week_live(uuid, uuid, text)
  from public, anon;
grant execute on function public.validate_and_schedule_social_week_live(uuid, uuid, text)
  to authenticated;

create or replace function public.claim_due_social_posts_for_publisher(
  p_limit integer default 10,
  p_worker_id uuid default gen_random_uuid(),
  p_now timestamptz default now(),
  p_publish_mode text default 'dry_run',
  p_publisher text default 'mock'
)
returns table (
  post_id uuid,
  organization_id uuid,
  week_id uuid,
  account_id uuid,
  scheduled_at timestamptz,
  attempt_id uuid,
  attempts integer,
  publish_mode text,
  approved_snapshot jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 25);
  v_mode text := coalesce(nullif(btrim(p_publish_mode), ''), 'dry_run');
  v_publisher text := coalesce(nullif(btrim(p_publisher), ''), 'mock');
begin
  if v_mode not in ('dry_run', 'live') then
    raise exception 'Mode de publication Social Studio invalide.' using errcode = 'invalid_parameter_value';
  end if;

  return query
  with due as (
    select
      post.id,
      gen_random_uuid() as attempt_id
    from public.social_posts post
    join public.social_weeks week
      on week.id = post.week_id
     and week.organization_id = post.organization_id
    left join public.social_accounts account
      on account.id = post.account_id
     and account.organization_id = post.organization_id
    where post.status = 'scheduled'
      and post.publish_state = 'scheduled'
      and post.publish_mode = v_mode
      and post.scheduled_at <= p_now
      and (post.publish_next_attempt_at is null or post.publish_next_attempt_at <= p_now)
      and post.publish_attempts < 5
      and post.instagram_media_id is null
      and week.publishing_suspended_at is null
      and coalesce(account.publishing_suspended_at, null) is null
      and (
        v_mode = 'dry_run'
        or (
          account.id is not null
          and account.provider = 'instagram'
          and account.status = 'connected'
          and account.provider_account_id is not null
        )
      )
    order by post.scheduled_at, post.created_at
    limit v_limit
    for update of post skip locked
  ),
  updated as (
    update public.social_posts post
       set status = 'processing',
           publish_state = 'processing',
           publish_attempt_id = due.attempt_id,
           publish_attempts = post.publish_attempts + 1,
           publish_locked_at = p_now,
           publish_lock_token = p_worker_id,
           publish_last_error_code = null,
           publish_last_error_kind = null
      from due
     where post.id = due.id
     returning
       post.id,
       post.organization_id,
       post.week_id,
       post.account_id,
       post.scheduled_at,
       due.attempt_id,
       post.publish_attempts,
       post.publish_mode,
       post.approved_snapshot
  ),
  inserted as (
    insert into public.social_publish_attempts (
      organization_id,
      week_id,
      post_id,
      attempt_id,
      mode,
      publisher,
      status,
      metadata,
      started_at
    )
    select
      updated.organization_id,
      updated.week_id,
      updated.id,
      updated.attempt_id,
      updated.publish_mode,
      v_publisher,
      'claimed',
      jsonb_build_object('worker_id', p_worker_id),
      p_now
    from updated
    on conflict (organization_id, attempt_id) do nothing
    returning social_publish_attempts.post_id
  )
  select
    updated.id,
    updated.organization_id,
    updated.week_id,
    updated.account_id,
    updated.scheduled_at,
    updated.attempt_id,
    updated.publish_attempts,
    updated.publish_mode,
    updated.approved_snapshot
  from updated
  where exists (select 1 from inserted where inserted.post_id = updated.id);
end;
$$;

revoke all on function public.claim_due_social_posts_for_publisher(integer, uuid, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_due_social_posts_for_publisher(integer, uuid, timestamptz, text, text)
  to service_role;

create or replace function public.mark_social_post_instagram_container(
  p_post_id uuid,
  p_attempt_id uuid,
  p_container_id text,
  p_status text default 'IN_PROGRESS',
  p_now timestamptz default now()
)
returns public.social_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.social_posts%rowtype;
begin
  select *
    into v_post
  from public.social_posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'Publication Social Studio introuvable.' using errcode = 'foreign_key_violation';
  end if;

  if v_post.publish_attempt_id is distinct from p_attempt_id
     or v_post.status <> 'processing'
     or v_post.publish_state <> 'processing'
     or v_post.publish_mode <> 'live' then
    raise exception 'Tentative de publication Instagram obsolete ou non live.'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.social_posts
     set instagram_container_id = left(nullif(btrim(p_container_id), ''), 180),
         instagram_container_status = left(nullif(btrim(coalesce(p_status, 'IN_PROGRESS')), ''), 80),
         instagram_container_checked_at = p_now
   where id = p_post_id
   returning * into v_post;

  update public.social_publish_attempts attempt
     set metadata = coalesce(attempt.metadata, '{}'::jsonb)
       || jsonb_build_object(
         'instagram_container_id', v_post.instagram_container_id,
         'instagram_container_status', v_post.instagram_container_status,
         'container_recorded_at', p_now
       )
   where attempt.organization_id = v_post.organization_id
     and attempt.post_id = p_post_id
     and attempt.attempt_id = p_attempt_id;

  return v_post;
end;
$$;

revoke all on function public.mark_social_post_instagram_container(uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mark_social_post_instagram_container(uuid, uuid, text, text, timestamptz)
  to service_role;

create or replace function public.mark_social_post_publish_live_success(
  p_post_id uuid,
  p_attempt_id uuid,
  p_media_id text,
  p_permalink text default null,
  p_provider_metadata jsonb default '{}'::jsonb,
  p_now timestamptz default now()
)
returns public.social_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.social_posts%rowtype;
begin
  select *
    into v_post
  from public.social_posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'Publication Social Studio introuvable.' using errcode = 'foreign_key_violation';
  end if;

  if v_post.publish_attempt_id is distinct from p_attempt_id
     or v_post.status <> 'processing'
     or v_post.publish_state <> 'processing'
     or v_post.publish_mode <> 'live' then
    raise exception 'Tentative de publication Instagram obsolete ou deja traitee.'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.social_posts
     set status = 'published',
         publish_state = 'published_live',
         published_at = p_now,
         dry_run_published_at = null,
         instagram_media_id = left(nullif(btrim(p_media_id), ''), 180),
         instagram_permalink = left(nullif(btrim(coalesce(p_permalink, '')), ''), 500),
         publish_locked_at = null,
         publish_lock_token = null,
         publish_next_attempt_at = null,
         publish_last_error_code = null,
         publish_last_error_kind = null,
         last_error = null
   where id = p_post_id
   returning * into v_post;

  update public.social_publish_attempts attempt
     set status = 'published_live',
         error_kind = null,
         error_code = null,
         error_message = null,
         metadata = coalesce(attempt.metadata, '{}'::jsonb)
           || coalesce(p_provider_metadata, '{}'::jsonb)
           || jsonb_build_object('instagram_media_id', v_post.instagram_media_id),
         completed_at = p_now
   where attempt.organization_id = v_post.organization_id
     and attempt.post_id = p_post_id
     and attempt.attempt_id = p_attempt_id;

  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
  values (
    v_post.organization_id,
    null,
    'social.post_published_live',
    'social_post',
    v_post.id,
    jsonb_build_object(
      'attempt_id', p_attempt_id,
      'mode', 'live',
      'instagram_media_id', v_post.instagram_media_id
    )
  );

  return v_post;
end;
$$;

revoke all on function public.mark_social_post_publish_live_success(uuid, uuid, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mark_social_post_publish_live_success(uuid, uuid, text, text, jsonb, timestamptz)
  to service_role;
