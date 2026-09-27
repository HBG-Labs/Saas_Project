-- Corrige la reservation des visuels lorsque organization_members.role est un enum.
-- La migration d'origine comparait public.org_role a une variable text.

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
  v_starts_on date;
  v_used integer;
  v_usage_id uuid;
  v_limit integer := least(greatest(coalesce(p_weekly_limit, 21), 1), 70);
begin
  if not (select app.org_has_feature(p_organization_id, 'social_studio')) then
    raise exception 'Social Studio non disponible pour cette organisation.'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1
    from public.organization_members member
    join public.role_permissions permission
      on permission.role = member.role
     and permission.permission = 'social.manage'
    where member.organization_id = p_organization_id
      and member.user_id = p_user_id
      and member.status = 'active'
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':social-image:' || p_post_id::text, 0)
  );

  if exists (
    select 1
    from public.social_image_usage usage
    where usage.organization_id = p_organization_id
      and usage.post_id = p_post_id
      and usage.status = 'processing'
      and usage.created_at > pg_catalog.now() - interval '15 minutes'
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
  returning id into v_usage_id;

  return query select
    'reserved'::text,
    v_usage_id,
    v_starts_on,
    v_used,
    greatest(v_limit - v_used - 1, 0);
end;
$$;

revoke all on function public.reserve_social_image_generation(uuid, uuid, uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_social_image_generation(uuid, uuid, uuid, uuid, text, text, integer)
  to service_role;

comment on function public.reserve_social_image_generation(uuid, uuid, uuid, uuid, text, text, integer) is
  'Reserve atomiquement une generation visuelle Social Studio apres controle du feature gate, de social.manage et du budget hebdomadaire.';
