-- =============================================================================
-- Quota IA atomique
-- =============================================================================
-- Vérifier COUNT puis appeler le fournisseur laissait deux requêtes parallèles
-- franchir la dernière place du quota. Cette fonction réserve la place sous un
-- verrou d'organisation avant tout appel payant. Le rôle de service est le seul
-- appelant ; les autorisations utilisateur sont néanmoins revérifiées ici.

create or replace function public.reserve_ai_usage(
  p_organization_id uuid,
  p_user_id uuid
)
returns table (
  reservation_id uuid,
  used_before integer,
  quota_limit integer,
  remaining_after integer,
  unlimited boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_used integer;
  v_reservation uuid;
begin
  if not exists (
    select 1
    from public.organization_members m
    join public.role_permissions rp
      on rp.role = m.role and rp.permission = 'ai.use'
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    return;
  end if;

  if not app.org_has_feature(p_organization_id, 'ai_assistant') then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text, 0)
  );

  -- Une exécution interrompue avant l'appel fournisseur ne doit pas bloquer le
  -- quota définitivement. Une complétion normale dure bien moins de 15 min.
  delete from public.ai_usage
  where organization_id = p_organization_id
    and request_type = 'chat_reserved'
    and input_tokens = 0
    and output_tokens = 0
    and created_at < now() - interval '15 minutes';

  v_limit := app.org_feature_limit(p_organization_id, 'ai_assistant');

  select count(*)::integer into v_used
  from public.ai_usage u
  where u.organization_id = p_organization_id
    and u.created_at >= pg_catalog.date_trunc('month', now());

  if v_limit is not null and v_used >= v_limit then
    return;
  end if;

  insert into public.ai_usage (
    organization_id,
    user_id,
    request_type
  ) values (
    p_organization_id,
    p_user_id,
    'chat_reserved'
  )
  returning id into v_reservation;

  return query select
    v_reservation,
    v_used,
    v_limit,
    case when v_limit is null then null else greatest(v_limit - v_used - 1, 0) end,
    v_limit is null;
end;
$$;

revoke all on function public.reserve_ai_usage(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, uuid)
  to service_role;

comment on function public.reserve_ai_usage(uuid, uuid) is
  'Réserve atomiquement une requête IA après contrôle du plan, du membre actif et de sa permission.';
