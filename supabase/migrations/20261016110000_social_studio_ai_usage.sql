-- =============================================================================
-- Social Studio — IA privee et suivi de consommation
-- =============================================================================
--
-- Migration additive uniquement.
--
-- Le Social Studio ne consomme pas le quota de l'Assistant IA utilisateur :
-- il possède son propre journal de génération, ses propres statuts et une
-- réservation interne limitée par semaine cible.
-- =============================================================================

create table if not exists public.social_ai_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  request_type text not null default 'weekly_content_generation',
  starts_on date not null,
  generation_id uuid not null,
  provider text not null,
  model text not null,
  status text not null default 'processing',
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost numeric(10, 6) not null default 0 check (estimated_cost >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint social_ai_usage_request_type check (request_type in ('weekly_content_generation')),
  constraint social_ai_usage_provider_not_blank check (length(btrim(provider)) between 1 and 80),
  constraint social_ai_usage_model_not_blank check (length(btrim(model)) between 1 and 160),
  constraint social_ai_usage_status check (
    status in ('processing', 'success', 'provider_error', 'invalid_response', 'timeout', 'cancelled')
  ),
  constraint social_ai_usage_error_code_not_blank check (
    error_code is null or length(btrim(error_code)) between 1 and 120
  )
);

create index if not exists social_ai_usage_org_week_idx
  on public.social_ai_usage (organization_id, starts_on, created_at desc);

create index if not exists social_ai_usage_generation_idx
  on public.social_ai_usage (organization_id, generation_id);

alter table public.social_ai_usage enable row level security;

revoke all on public.social_ai_usage from public, anon, authenticated;
grant select on public.social_ai_usage to authenticated;
grant all on public.social_ai_usage to service_role;

drop policy if exists "social_ai_usage_select" on public.social_ai_usage;
create policy "social_ai_usage_select"
  on public.social_ai_usage for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

create or replace function public.reserve_social_ai_generation(
  p_organization_id uuid,
  p_user_id uuid,
  p_starts_on date,
  p_generation_id uuid,
  p_provider text,
  p_model text,
  p_weekly_limit integer default 3
)
returns table (
  usage_id uuid,
  used_before integer,
  remaining_after integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
  v_usage_id uuid;
  v_limit integer := least(greatest(coalesce(p_weekly_limit, 3), 1), 20);
begin
  if not app.org_has_feature(p_organization_id, 'social_studio') then
    return;
  end if;

  if not exists (
    select 1
    from public.organization_members m
    join public.role_permissions rp
      on rp.role = m.role and rp.permission = 'social.manage'
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_starts_on::text, 0)
  );

  select count(*)::integer into v_used
  from public.social_ai_usage u
  where u.organization_id = p_organization_id
    and u.starts_on = p_starts_on
    and u.request_type = 'weekly_content_generation';

  if v_used >= v_limit then
    return;
  end if;

  insert into public.social_ai_usage (
    organization_id,
    user_id,
    starts_on,
    generation_id,
    provider,
    model,
    status
  )
  values (
    p_organization_id,
    p_user_id,
    p_starts_on,
    p_generation_id,
    nullif(btrim(p_provider), ''),
    nullif(btrim(p_model), ''),
    'processing'
  )
  returning id into v_usage_id;

  return query select
    v_usage_id,
    v_used,
    greatest(v_limit - v_used - 1, 0);
end;
$$;

revoke all on function public.reserve_social_ai_generation(uuid, uuid, date, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_social_ai_generation(uuid, uuid, date, uuid, text, text, integer)
  to service_role;

comment on table public.social_ai_usage is
  'Suivi interne des generations IA Social Studio. Ne contient pas les prompts complets et ne consomme pas le quota Assistant IA.';

comment on function public.reserve_social_ai_generation(uuid, uuid, date, uuid, text, text, integer) is
  'Reserve une generation Social Studio apres controle social.manage, feature social_studio et limite interne par semaine cible.';

do $$
begin
  if has_table_privilege('authenticated', 'public.social_ai_usage', 'INSERT')
     or has_table_privilege('authenticated', 'public.social_ai_usage', 'UPDATE')
     or has_table_privilege('authenticated', 'public.social_ai_usage', 'DELETE') then
    raise exception 'social_ai_usage doit rester ecrite uniquement par service_role.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.reserve_social_ai_generation(uuid,uuid,date,uuid,text,text,integer)',
    'EXECUTE'
  ) then
    raise exception 'reserve_social_ai_generation doit rester service_role uniquement.';
  end if;
end
$$;
