-- =============================================================================
-- Social Studio Phase F — validation hebdomadaire + worker dry-run
-- =============================================================================
--
-- Migration additive uniquement.
-- Aucun cron n'est enregistré ici : le worker pourra être réveillé plus tard
-- dans un environnement non-production sûr, puis en production après accord.
-- =============================================================================

alter table public.social_weeks
  add column if not exists timezone text not null default 'Europe/Paris',
  add column if not exists publishing_suspended_at timestamptz,
  add column if not exists publishing_suspended_by uuid references auth.users (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'social_weeks_timezone_not_blank'
      and conrelid = 'public.social_weeks'::regclass
  ) then
    alter table public.social_weeks
      add constraint social_weeks_timezone_not_blank
      check (length(btrim(timezone)) between 1 and 80);
  end if;
end;
$$;

alter table public.social_posts
  add column if not exists publish_mode text not null default 'dry_run',
  add column if not exists publish_state text not null default 'not_scheduled',
  add column if not exists selected_asset_id uuid references public.social_post_assets (id) on delete set null,
  add column if not exists schedule_timezone text,
  add column if not exists approved_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists publish_attempt_id uuid,
  add column if not exists publish_attempts integer not null default 0,
  add column if not exists publish_locked_at timestamptz,
  add column if not exists publish_lock_token uuid,
  add column if not exists publish_next_attempt_at timestamptz,
  add column if not exists publish_last_error_code text,
  add column if not exists publish_last_error_kind text,
  add column if not exists publish_reconciliation_required_at timestamptz,
  add column if not exists dry_run_published_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'social_posts_publish_mode_check'
      and conrelid = 'public.social_posts'::regclass
  ) then
    alter table public.social_posts
      add constraint social_posts_publish_mode_check
      check (publish_mode in ('dry_run', 'live'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'social_posts_publish_state_check'
      and conrelid = 'public.social_posts'::regclass
  ) then
    alter table public.social_posts
      add constraint social_posts_publish_state_check
      check (
        publish_state in (
          'not_scheduled',
          'scheduled',
          'processing',
          'published_simulated',
          'published_live',
          'failed',
          'cancelled',
          'skipped',
          'reconciliation_required'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'social_posts_publish_attempts_check'
      and conrelid = 'public.social_posts'::regclass
  ) then
    alter table public.social_posts
      add constraint social_posts_publish_attempts_check
      check (publish_attempts >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'social_posts_schedule_timezone_not_blank'
      and conrelid = 'public.social_posts'::regclass
  ) then
    alter table public.social_posts
      add constraint social_posts_schedule_timezone_not_blank
      check (schedule_timezone is null or length(btrim(schedule_timezone)) between 1 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'social_posts_snapshot_object'
      and conrelid = 'public.social_posts'::regclass
  ) then
    alter table public.social_posts
      add constraint social_posts_snapshot_object
      check (jsonb_typeof(approved_snapshot) = 'object');
  end if;
end;
$$;

create index if not exists social_posts_scheduler_due_idx
  on public.social_posts (publish_state, scheduled_at, publish_next_attempt_at)
  where status = 'scheduled';

create index if not exists social_posts_week_publish_state_idx
  on public.social_posts (organization_id, week_id, publish_state);

create or replace function app.enforce_social_post_selected_asset_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.selected_asset_id is not null and not exists (
    select 1
    from public.social_post_assets asset
    where asset.id = new.selected_asset_id
      and asset.organization_id = new.organization_id
      and asset.post_id = new.id
      and asset.kind = 'selected'
  ) then
    raise exception 'L''asset selectionne ne correspond pas a la publication Social Studio.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

revoke all on function app.enforce_social_post_selected_asset_scope()
  from public, anon, authenticated;

drop trigger if exists social_posts_selected_asset_scope on public.social_posts;
create trigger social_posts_selected_asset_scope
  before insert or update of selected_asset_id, organization_id, id on public.social_posts
  for each row execute function app.enforce_social_post_selected_asset_scope();

create table if not exists public.social_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  week_id uuid references public.social_weeks (id) on delete set null,
  post_id uuid not null references public.social_posts (id) on delete cascade,
  attempt_id uuid not null,
  mode text not null default 'dry_run',
  publisher text not null,
  status text not null default 'claimed',
  error_kind text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint social_publish_attempts_mode_check check (mode in ('dry_run', 'live')),
  constraint social_publish_attempts_status_check check (
    status in (
      'claimed',
      'published_simulated',
      'published_live',
      'temporary_failure',
      'permanent_failure',
      'reconciliation_required'
    )
  ),
  constraint social_publish_attempts_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint social_publish_attempts_publisher_not_blank check (length(btrim(publisher)) between 1 and 80),
  constraint social_publish_attempts_attempt_unique unique (organization_id, attempt_id)
);

create index if not exists social_publish_attempts_post_idx
  on public.social_publish_attempts (organization_id, post_id, started_at desc);

alter table public.social_publish_attempts enable row level security;

revoke all on public.social_publish_attempts from public, anon, authenticated;
grant select on public.social_publish_attempts to authenticated;
grant all on public.social_publish_attempts to service_role;

drop policy if exists "social_publish_attempts_select" on public.social_publish_attempts;
create policy "social_publish_attempts_select"
  on public.social_publish_attempts for select
  to authenticated
  using (
    (select app.org_has_feature(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.view'))
  );

create or replace function app.enforce_social_publish_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_requires_publish boolean := false;
begin
  -- Les workers et Edge Functions internes utilisent service_role : ils n'ont
  -- pas d'utilisateur courant et franchissent les états techniques côté serveur.
  if v_actor is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_requires_publish :=
      new.status in ('scheduled', 'processing', 'published', 'cancelled')
      or new.approved_by is not null
      or new.approved_at is not null
      or new.scheduled_at is not null
      or new.published_at is not null
      or new.instagram_media_id is not null
      or coalesce(new.publish_state, 'not_scheduled') <> 'not_scheduled'
      or new.selected_asset_id is not null
      or coalesce(new.approved_snapshot, '{}'::jsonb) <> '{}'::jsonb;
  elsif tg_op = 'UPDATE' then
    v_requires_publish :=
      old.status in ('scheduled', 'processing', 'published')
      or new.status in ('scheduled', 'processing', 'published', 'cancelled')
      or old.publish_state in (
        'scheduled',
        'processing',
        'published_simulated',
        'published_live',
        'failed',
        'cancelled',
        'skipped',
        'reconciliation_required'
      )
      or new.publish_state in (
        'scheduled',
        'processing',
        'published_simulated',
        'published_live',
        'failed',
        'cancelled',
        'skipped',
        'reconciliation_required'
      )
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at
      or new.scheduled_at is distinct from old.scheduled_at
      or new.published_at is distinct from old.published_at
      or new.instagram_media_id is distinct from old.instagram_media_id
      or new.publish_mode is distinct from old.publish_mode
      or new.publish_attempt_id is distinct from old.publish_attempt_id
      or new.publish_attempts is distinct from old.publish_attempts
      or new.publish_locked_at is distinct from old.publish_locked_at
      or new.publish_lock_token is distinct from old.publish_lock_token
      or new.publish_next_attempt_at is distinct from old.publish_next_attempt_at
      or new.publish_last_error_code is distinct from old.publish_last_error_code
      or new.publish_last_error_kind is distinct from old.publish_last_error_kind
      or new.publish_reconciliation_required_at is distinct from old.publish_reconciliation_required_at
      or new.dry_run_published_at is distinct from old.dry_run_published_at
      or new.selected_asset_id is distinct from old.selected_asset_id
      or new.schedule_timezone is distinct from old.schedule_timezone
      or new.approved_snapshot is distinct from old.approved_snapshot;
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

create or replace function public.validate_and_schedule_social_week(
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
  v_now timestamptz := now();
  v_week public.social_weeks%rowtype;
  v_timezone text := nullif(btrim(coalesce(p_timezone, '')), '');
  v_total integer;
  v_valid integer;
begin
  if v_actor is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  if v_timezone is null then
    v_timezone := 'Europe/Paris';
  end if;

  if not (select app.can_use_pro_module(p_organization_id, 'social_studio')) then
    raise exception 'Social Studio non disponible pour cette organisation.'
      using errcode = 'insufficient_privilege';
  end if;

  if not (select app.has_org_permission(p_organization_id, 'social.publish')) then
    raise exception 'La validation hebdomadaire exige social.publish.'
      using errcode = 'insufficient_privilege';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':social-week:' || p_week_id::text, 0));

  select *
    into v_week
  from public.social_weeks
  where id = p_week_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Semaine Social Studio introuvable.' using errcode = 'foreign_key_violation';
  end if;

  select count(*)::integer
    into v_total
  from public.social_posts post
  where post.organization_id = p_organization_id
    and post.week_id = p_week_id;

  if v_week.status = 'scheduled' and v_total = 7 and not exists (
    select 1
    from public.social_posts post
    where post.organization_id = p_organization_id
      and post.week_id = p_week_id
      and (post.status <> 'scheduled' or post.publish_state <> 'scheduled' or post.scheduled_at is null)
  ) then
    return query select p_week_id, 7, 'already_scheduled'::text, v_week.timezone;
    return;
  end if;

  if v_week.status in ('published', 'partially_published', 'cancelled') then
    raise exception 'Cette semaine ne peut plus etre programmee.' using errcode = 'invalid_parameter_value';
  end if;

  if v_total <> 7 then
    raise exception 'La semaine doit contenir exactement 7 publications.' using errcode = 'check_violation';
  end if;

  select count(*)::integer
    into v_valid
  from public.social_posts post
  join lateral (
    select asset.id, asset.storage_path, asset.mime_type, asset.width, asset.height, asset.size_bytes, asset.provider
    from public.social_post_assets asset
    where asset.organization_id = post.organization_id
      and asset.post_id = post.id
      and asset.kind = 'selected'
    order by asset.position
    limit 1
  ) asset on true
  where post.organization_id = p_organization_id
    and post.week_id = p_week_id
    and post.status = 'ready'
    and post.format = 'image'
    and nullif(btrim(coalesce(post.hook, '')), '') is not null
    and nullif(btrim(coalesce(post.caption, '')), '') is not null
    and nullif(btrim(coalesce(post.cta, '')), '') is not null
    and post.content ? 'planned_for'
    and nullif(btrim(coalesce(post.content ->> 'planned_for', '')), '') is not null
    and (post.content ->> 'planned_for') ~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
    and asset.width = 1080
    and asset.height = 1350
    and asset.mime_type in ('image/png', 'image/jpeg', 'image/webp')
    and coalesce(asset.size_bytes, 1) > 0;

  if v_valid <> 7 then
    raise exception 'Les 7 publications doivent etre READY avec un asset final 1080x1350 selectionne.'
      using errcode = 'check_violation';
  end if;

  with eligible as (
    select
      post.id,
      post.hook,
      post.caption,
      post.cta,
      post.hashtags,
      post.visual_text,
      post.visual_brief,
      post.marketing_angle,
      post.concept,
      post.content,
      (post.content ->> 'planned_for')::timestamptz as planned_at,
      asset.id as asset_id,
      asset.storage_path,
      asset.mime_type,
      asset.width,
      asset.height,
      asset.size_bytes,
      asset.provider
    from public.social_posts post
    join lateral (
      select *
      from public.social_post_assets asset
      where asset.organization_id = post.organization_id
        and asset.post_id = post.id
        and asset.kind = 'selected'
      order by asset.position
      limit 1
    ) asset on true
    where post.organization_id = p_organization_id
      and post.week_id = p_week_id
      and post.status = 'ready'
      and (post.content ->> 'planned_for') ~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
  )
  update public.social_posts post
     set status = 'scheduled',
         scheduled_at = eligible.planned_at,
         approved_by = v_actor,
         approved_at = v_now,
         selected_asset_id = eligible.asset_id,
         schedule_timezone = v_timezone,
         publish_mode = 'dry_run',
         publish_state = 'scheduled',
         publish_attempt_id = null,
         publish_locked_at = null,
         publish_lock_token = null,
         publish_next_attempt_at = null,
         publish_last_error_code = null,
         publish_last_error_kind = null,
         publish_reconciliation_required_at = null,
         dry_run_published_at = null,
         last_error = null,
         approved_snapshot = jsonb_build_object(
           'version', 1,
           'mode', 'dry_run',
           'approved_at', v_now,
           'approved_by', v_actor,
           'timezone', v_timezone,
           'scheduled_at', eligible.planned_at,
           'hook', eligible.hook,
           'caption', eligible.caption,
           'cta', eligible.cta,
           'hashtags', to_jsonb(eligible.hashtags),
           'visual_text', eligible.visual_text,
           'visual_brief', eligible.visual_brief,
           'marketing_angle', eligible.marketing_angle,
           'concept', eligible.concept,
           'objective', eligible.content ->> 'objective',
           'audience', eligible.content ->> 'audience',
           'asset', jsonb_build_object(
             'id', eligible.asset_id,
             'storage_path', eligible.storage_path,
             'mime_type', eligible.mime_type,
             'width', eligible.width,
             'height', eligible.height,
             'size_bytes', eligible.size_bytes,
             'provider', eligible.provider
           )
         )
    from eligible
   where post.id = eligible.id;

  update public.social_weeks
     set status = 'scheduled',
         approved_by = v_actor,
         approved_at = v_now,
         timezone = v_timezone,
         strategy = coalesce(strategy, '{}'::jsonb) || jsonb_build_object(
           'approval', jsonb_build_object(
             'mode', 'dry_run',
             'approved_at', v_now,
             'approved_by', v_actor,
             'timezone', v_timezone
           )
         )
   where id = p_week_id
     and organization_id = p_organization_id;

  insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
  values
    (p_organization_id, v_actor, 'social.week_approved', 'social_week', p_week_id,
     jsonb_build_object('mode', 'dry_run', 'timezone', v_timezone)),
    (p_organization_id, v_actor, 'social.week_scheduled', 'social_week', p_week_id,
     jsonb_build_object('posts', 7, 'mode', 'dry_run'));

  return query select p_week_id, 7, 'scheduled'::text, v_timezone;
end;
$$;

revoke all on function public.validate_and_schedule_social_week(uuid, uuid, text)
  from public, anon;
grant execute on function public.validate_and_schedule_social_week(uuid, uuid, text)
  to authenticated;

create or replace function public.set_social_week_publishing_suspended(
  p_organization_id uuid,
  p_week_id uuid,
  p_suspended boolean
)
returns table (
  week_id uuid,
  suspended boolean,
  skipped_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := now();
  v_skipped integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  if not (select app.can_use_pro_module(p_organization_id, 'social_studio')) then
    raise exception 'Social Studio non disponible pour cette organisation.'
      using errcode = 'insufficient_privilege';
  end if;

  if not (select app.has_org_permission(p_organization_id, 'social.publish')) then
    raise exception 'La suspension des publications exige social.publish.'
      using errcode = 'insufficient_privilege';
  end if;

  perform 1
  from public.social_weeks week
  where week.id = p_week_id
    and week.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Semaine Social Studio introuvable.' using errcode = 'foreign_key_violation';
  end if;

  if p_suspended then
    update public.social_weeks
       set publishing_suspended_at = v_now,
           publishing_suspended_by = v_actor
     where id = p_week_id
       and organization_id = p_organization_id;

    insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
    values (p_organization_id, v_actor, 'social.week_suspended', 'social_week', p_week_id, '{}'::jsonb);
  else
    update public.social_posts
       set status = 'failed',
           publish_state = 'skipped',
           publish_last_error_code = 'missed_while_suspended',
           publish_last_error_kind = 'permanent',
           last_error = 'Publication depassee pendant suspension : reprogrammation requise.',
           publish_next_attempt_at = null,
           publish_locked_at = null,
           publish_lock_token = null
     where organization_id = p_organization_id
       and week_id = p_week_id
       and status = 'scheduled'
       and publish_state = 'scheduled'
       and scheduled_at < v_now;

    get diagnostics v_skipped = row_count;

    update public.social_weeks
       set publishing_suspended_at = null,
           publishing_suspended_by = null
     where id = p_week_id
       and organization_id = p_organization_id;

    insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
    values (
      p_organization_id,
      v_actor,
      'social.week_resumed',
      'social_week',
      p_week_id,
      jsonb_build_object('skipped_overdue_posts', v_skipped)
    );
  end if;

  return query select p_week_id, p_suspended, v_skipped;
end;
$$;

revoke all on function public.set_social_week_publishing_suspended(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.set_social_week_publishing_suspended(uuid, uuid, boolean)
  to authenticated;

create or replace function public.cancel_social_post(
  p_organization_id uuid,
  p_post_id uuid
)
returns public.social_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_now timestamptz := now();
  v_post public.social_posts%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  if not (select app.can_use_pro_module(p_organization_id, 'social_studio')) then
    raise exception 'Social Studio non disponible pour cette organisation.'
      using errcode = 'insufficient_privilege';
  end if;

  if not (select app.has_org_permission(p_organization_id, 'social.publish')) then
    raise exception 'L''annulation d''une publication programmee exige social.publish.'
      using errcode = 'insufficient_privilege';
  end if;

  select *
    into v_post
  from public.social_posts
  where id = p_post_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Publication Social Studio introuvable.' using errcode = 'foreign_key_violation';
  end if;

  if v_post.status in ('processing', 'published') then
    raise exception 'Cette publication est deja en traitement ou publiee.' using errcode = 'invalid_parameter_value';
  end if;

  if v_post.status <> 'cancelled' then
    update public.social_posts
       set status = 'cancelled',
           publish_state = 'cancelled',
           cancelled_by = v_actor,
           cancelled_at = v_now,
           publish_next_attempt_at = null,
           publish_locked_at = null,
           publish_lock_token = null,
           last_error = null
     where id = p_post_id
       and organization_id = p_organization_id
     returning * into v_post;

    insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
    values (p_organization_id, v_actor, 'social.post_cancelled', 'social_post', p_post_id, '{}'::jsonb);
  end if;

  return v_post;
end;
$$;

revoke all on function public.cancel_social_post(uuid, uuid) from public, anon;
grant execute on function public.cancel_social_post(uuid, uuid) to authenticated;

create or replace function public.claim_due_social_posts(
  p_limit integer default 10,
  p_worker_id uuid default gen_random_uuid(),
  p_now timestamptz default now()
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
begin
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
      and post.publish_mode = 'dry_run'
      and post.scheduled_at <= p_now
      and (post.publish_next_attempt_at is null or post.publish_next_attempt_at <= p_now)
      and post.publish_attempts < 5
      and week.publishing_suspended_at is null
      and coalesce(account.publishing_suspended_at, null) is null
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
      'mock',
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

revoke all on function public.claim_due_social_posts(integer, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_due_social_posts(integer, uuid, timestamptz)
  to service_role;

create or replace function public.mark_social_post_publish_result(
  p_post_id uuid,
  p_attempt_id uuid,
  p_result text,
  p_error_kind text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_now timestamptz default now(),
  p_max_attempts integer default 5
)
returns public.social_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.social_posts%rowtype;
  v_final_status text;
  v_attempt_status text;
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
     or v_post.publish_state <> 'processing' then
    raise exception 'Tentative de publication Social Studio obsolete ou deja traitee.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_result = 'simulated_success' then
    update public.social_posts
       set status = 'published',
           publish_state = 'published_simulated',
           published_at = p_now,
           dry_run_published_at = p_now,
           instagram_media_id = 'dry_run:' || p_attempt_id::text,
           publish_locked_at = null,
           publish_lock_token = null,
           publish_next_attempt_at = null,
           publish_last_error_code = null,
           publish_last_error_kind = null,
           last_error = null
     where id = p_post_id
     returning * into v_post;

    v_attempt_status := 'published_simulated';

    insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
    values (
      v_post.organization_id,
      null,
      'social.post_publish_simulated',
      'social_post',
      v_post.id,
      jsonb_build_object('attempt_id', p_attempt_id, 'mode', 'dry_run')
    );
  elsif p_result = 'temporary_failure' then
    if v_post.publish_attempts >= greatest(coalesce(p_max_attempts, 5), 1) then
      v_final_status := 'failed';
      v_attempt_status := 'permanent_failure';
      update public.social_posts
         set status = 'failed',
             publish_state = 'failed',
             publish_locked_at = null,
             publish_lock_token = null,
             publish_next_attempt_at = null,
             publish_last_error_kind = 'temporary_exhausted',
             publish_last_error_code = left(coalesce(p_error_code, 'temporary_failure'), 120),
             last_error = left(coalesce(p_error_message, 'Publication Social Studio echouee apres retries.'), 500)
       where id = p_post_id
       returning * into v_post;
    else
      v_final_status := 'scheduled';
      v_attempt_status := 'temporary_failure';
      update public.social_posts
         set status = 'scheduled',
             publish_state = 'scheduled',
             publish_locked_at = null,
             publish_lock_token = null,
             publish_next_attempt_at = p_now + (interval '1 minute' * least(15, greatest(1, v_post.publish_attempts * 2))),
             publish_last_error_kind = left(coalesce(p_error_kind, 'temporary'), 120),
             publish_last_error_code = left(coalesce(p_error_code, 'temporary_failure'), 120),
             last_error = left(coalesce(p_error_message, 'Publication Social Studio temporairement indisponible.'), 500)
       where id = p_post_id
       returning * into v_post;
    end if;
  elsif p_result = 'permanent_failure' then
    v_final_status := 'failed';
    v_attempt_status := 'permanent_failure';
    update public.social_posts
       set status = 'failed',
           publish_state = 'failed',
           publish_locked_at = null,
           publish_lock_token = null,
           publish_next_attempt_at = null,
           publish_last_error_kind = left(coalesce(p_error_kind, 'permanent'), 120),
           publish_last_error_code = left(coalesce(p_error_code, 'permanent_failure'), 120),
           last_error = left(coalesce(p_error_message, 'Publication Social Studio impossible.'), 500)
     where id = p_post_id
     returning * into v_post;
  elsif p_result = 'ambiguous_timeout' then
    v_final_status := 'reconciliation_required';
    v_attempt_status := 'reconciliation_required';
    update public.social_posts
       set status = 'failed',
           publish_state = 'reconciliation_required',
           publish_locked_at = null,
           publish_lock_token = null,
           publish_next_attempt_at = null,
           publish_reconciliation_required_at = p_now,
           publish_last_error_kind = 'ambiguous_timeout',
           publish_last_error_code = left(coalesce(p_error_code, 'ambiguous_timeout'), 120),
           last_error = left(coalesce(p_error_message, 'Etat Instagram ambigu : reconciliation requise avant tout retry.'), 500)
     where id = p_post_id
     returning * into v_post;
  else
    raise exception 'Resultat de publication inconnu.' using errcode = 'invalid_parameter_value';
  end if;

  update public.social_publish_attempts attempt
     set status = v_attempt_status,
         error_kind = left(p_error_kind, 120),
         error_code = left(p_error_code, 120),
         error_message = left(p_error_message, 500),
         completed_at = p_now
   where attempt.organization_id = v_post.organization_id
     and attempt.post_id = p_post_id
     and attempt.attempt_id = p_attempt_id;

  if p_result <> 'simulated_success' then
    insert into public.audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
    values (
      v_post.organization_id,
      null,
      'social.post_failed',
      'social_post',
      v_post.id,
      jsonb_build_object(
        'attempt_id', p_attempt_id,
        'result', p_result,
        'final_status', v_final_status,
        'error_code', left(coalesce(p_error_code, 'unknown'), 120)
      )
    );
  end if;

  if v_post.week_id is not null and not exists (
    select 1
    from public.social_posts sibling
    where sibling.organization_id = v_post.organization_id
      and sibling.week_id = v_post.week_id
      and sibling.status in ('draft', 'ready', 'scheduled', 'processing')
  ) then
    update public.social_weeks week
       set status = case
         when exists (
           select 1 from public.social_posts failed
           where failed.organization_id = v_post.organization_id
             and failed.week_id = v_post.week_id
             and failed.status in ('failed', 'cancelled')
         ) then 'partially_published'
         else 'published'
       end
     where week.id = v_post.week_id
       and week.organization_id = v_post.organization_id;
  end if;

  return v_post;
end;
$$;

revoke all on function public.mark_social_post_publish_result(uuid, uuid, text, text, text, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.mark_social_post_publish_result(uuid, uuid, text, text, text, text, timestamptz, integer)
  to service_role;

comment on column public.social_posts.publish_state is
  'Etat de publication technique. En Phase F, published_simulated est un dry-run explicite, distinct de published_live.';
comment on column public.social_posts.approved_snapshot is
  'Snapshot immutable de ce qui a ete approuve pour publication : texte, caption, CTA, horaires et asset final.';
comment on table public.social_publish_attempts is
  'Tentatives du worker Social Studio. En Phase F, seul le publisher mock/dry-run est autorise.';

do $$
begin
  if has_table_privilege('authenticated', 'public.social_publish_attempts', 'INSERT')
     or has_table_privilege('authenticated', 'public.social_publish_attempts', 'UPDATE')
     or has_table_privilege('authenticated', 'public.social_publish_attempts', 'DELETE') then
    raise exception 'social_publish_attempts doit rester ecrite uniquement par service_role.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.claim_due_social_posts(integer, uuid, timestamp with time zone)',
    'EXECUTE'
  ) then
    raise exception 'claim_due_social_posts ne doit pas etre executable par authenticated.';
  end if;
end;
$$;
