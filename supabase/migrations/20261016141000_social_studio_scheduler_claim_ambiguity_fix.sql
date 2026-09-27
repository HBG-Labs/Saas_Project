-- =============================================================================
-- Social Studio Phase F — correction idempotence claim worker
-- =============================================================================
--
-- Migration additive : les migrations deja committees restent immuables.
-- Corrige l'ambiguite PL/pgSQL entre la colonne organization_id et le parametre
-- de retour homonyme dans les fonctions de claim.
-- =============================================================================

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
    on conflict on constraint social_publish_attempts_attempt_unique do nothing
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
    on conflict on constraint social_publish_attempts_attempt_unique do nothing
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
