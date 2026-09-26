-- Phase E Social Studio : moteur prive de generation visuelle.
-- Migration additive uniquement : suivi usage dedie + reservation atomique.

create table if not exists public.social_image_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  post_id uuid not null references public.social_posts (id) on delete cascade,
  starts_on date not null,
  generation_id uuid not null,
  provider text not null,
  model text not null,
  status text not null default 'processing',
  variant_count smallint not null default 0,
  prompt_chars integer not null default 0,
  estimated_cost numeric(12,6) not null default 0,
  latency_ms integer,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint social_image_usage_status check (
    status in ('processing', 'success', 'provider_error', 'invalid_response', 'timeout', 'cancelled')
  ),
  constraint social_image_usage_provider_not_blank check (length(btrim(provider)) between 1 and 80),
  constraint social_image_usage_model_not_blank check (length(btrim(model)) between 1 and 160),
  constraint social_image_usage_variant_count check (variant_count between 0 and 10),
  constraint social_image_usage_prompt_chars check (prompt_chars >= 0),
  constraint social_image_usage_error_code_not_blank check (
    error_code is null or length(btrim(error_code)) between 1 and 120
  )
);

create index if not exists social_image_usage_org_week_idx
  on public.social_image_usage (organization_id, starts_on, created_at desc);

create index if not exists social_image_usage_post_status_idx
  on public.social_image_usage (organization_id, post_id, status, created_at desc);

create unique index if not exists social_image_usage_generation_idx
  on public.social_image_usage (organization_id, generation_id);

alter table public.social_image_usage enable row level security;

revoke all on public.social_image_usage from public, anon, authenticated;
grant select on public.social_image_usage to authenticated;
grant all on public.social_image_usage to service_role;

drop policy if exists "social_image_usage_select" on public.social_image_usage;
create policy "social_image_usage_select"
  on public.social_image_usage for select
  to authenticated
  using (
    (select app.org_has_feature(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

create or replace function public.reserve_social_image_generation(
  p_organization_id uuid,
  p_user_id uuid,
  p_post_id uuid,
  p_generation_id uuid,
  p_provider text,
  p_model text,
  p_weekly_limit integer default 21
)
returns table (
  reservation_status text,
  usage_id uuid,
  starts_on date,
  used_before integer,
  remaining_after integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_starts_on date;
  v_used integer;
  v_limit integer := least(greatest(coalesce(p_weekly_limit, 21), 1), 70);
begin
  if not (select app.org_has_feature(p_organization_id, 'social_studio')) then
    raise exception 'Social Studio non disponible pour cette organisation.'
      using errcode = 'insufficient_privilege';
  end if;

  select om.role into v_role
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = p_user_id
    and om.status = 'active';

  if v_role is null or not exists (
    select 1
    from public.role_permissions rp
    where rp.role = v_role
      and rp.permission = 'social.manage'
  ) then
    raise exception 'Permission social.manage requise pour generer des visuels.'
      using errcode = 'insufficient_privilege';
  end if;

  select week.starts_on into v_starts_on
  from public.social_posts post
  join public.social_weeks week
    on week.id = post.week_id
   and week.organization_id = post.organization_id
  where post.id = p_post_id
    and post.organization_id = p_organization_id;

  if v_starts_on is null then
    raise exception 'Publication Social Studio introuvable.'
      using errcode = 'foreign_key_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':social-image:' || p_post_id::text, 0));

  if exists (
    select 1
    from public.social_image_usage usage
    where usage.organization_id = p_organization_id
      and usage.post_id = p_post_id
      and usage.status = 'processing'
      and usage.created_at > now() - interval '15 minutes'
  ) then
    return query select 'in_progress'::text, null::uuid, v_starts_on, 0, 0;
    return;
  end if;

  select count(*)::integer into v_used
  from public.social_image_usage usage
  where usage.organization_id = p_organization_id
    and usage.starts_on = v_starts_on
    and usage.status in ('processing', 'success');

  if v_used >= v_limit then
    return query select 'limit_reached'::text, null::uuid, v_starts_on, v_used, 0;
    return;
  end if;

  insert into public.social_image_usage (
    organization_id,
    user_id,
    post_id,
    starts_on,
    generation_id,
    provider,
    model,
    status
  )
  values (
    p_organization_id,
    p_user_id,
    p_post_id,
    v_starts_on,
    p_generation_id,
    nullif(btrim(p_provider), ''),
    nullif(btrim(p_model), ''),
    'processing'
  )
  returning id into usage_id;

  return query select 'reserved'::text, usage_id, v_starts_on, v_used, v_limit - v_used - 1;
end;
$$;

revoke all on function public.reserve_social_image_generation(uuid, uuid, uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_social_image_generation(uuid, uuid, uuid, uuid, text, text, integer)
  to service_role;

comment on table public.social_image_usage is
  'Suivi interne des generations visuelles Social Studio. Separe de social_ai_usage et de l''Assistant utilisateur.';

do $$
begin
  if has_table_privilege('authenticated', 'public.social_image_usage', 'INSERT')
     or has_table_privilege('authenticated', 'public.social_image_usage', 'UPDATE')
     or has_table_privilege('authenticated', 'public.social_image_usage', 'DELETE') then
    raise exception 'social_image_usage doit rester ecrite uniquement par service_role.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.reserve_social_image_generation(uuid, uuid, uuid, uuid, text, text, integer)',
    'EXECUTE'
  ) then
    raise exception 'reserve_social_image_generation ne doit pas etre executable par authenticated.';
  end if;
end;
$$;
