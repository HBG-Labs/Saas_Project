-- =============================================================================
-- Correctif : une organisation sans abonnement est en Free, pas hors-grille
-- =============================================================================
--
-- LE DÉFAUT, TROUVÉ EN EXÉCUTANT LA SUITE DE TESTS
--
-- `app.org_plan_code` renvoie NULL quand aucun abonnement n'est actif — c'est
-- son contrat, et il est juste. Mais les fonctions écrites par
-- `20260817101100_seat_billing.sql` en tiraient toutes la mauvaise conclusion :
--
--     select p.max_users from public.plans p
--     where p.code = app.org_plan_code(...)   -- aucune ligne
--
-- `v_max` restait NULL, et `enforce_member_quota` interprétait cette absence
-- comme « plan payant, aucune limite ». Une organisation SANS abonnement
-- pouvait donc ajouter autant de membres qu'elle voulait — exactement l'inverse
-- de ce que le plafond Free doit produire.
--
-- Mesuré : la suite 04 a vu passer le deuxième utilisateur d'une organisation
-- Free.
--
-- LA CORRECTION
--
-- `coalesce(app.org_plan_code(org), 'free')` partout. C'est déjà la convention
-- du reste du système : `DEFAULT_PLAN = 'free'` côté TypeScript, et
-- `app.can_use_pro_module` refuse tout en l'absence de plan. Ces trois
-- fonctions étaient les seules à en déduire le contraire.
-- =============================================================================

/** Le plan effectif d'une organisation — jamais NULL. */
create or replace function app.org_effective_plan(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.org_plan_code(p_organization_id), 'free');
$$;

revoke all on function app.org_effective_plan(uuid) from public, anon;
grant execute on function app.org_effective_plan(uuid) to authenticated;

-- -----------------------------------------------------------------------------
create or replace function app.org_extra_seats(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    0,
    app.org_billable_seats(p_organization_id)
      - coalesce(
          (select f.limit_value
           from public.plan_features f
           where f.plan_code = app.org_effective_plan(p_organization_id)
             and f.feature_key = 'members'),
          0)
  );
$$;

create or replace function app.org_monthly_amount_cents(
  p_organization_id uuid,
  p_interval        text default 'monthly'
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.code = 'free' then 0
    else
      case when p_interval = 'annual'
        then (p.price_annual_cents / 12)::integer
        else p.price_monthly_cents
      end
      + app.org_extra_seats(p_organization_id) * p.extra_user_price_cents
  end
  from public.plans p
  where p.code = app.org_effective_plan(p_organization_id);
$$;

-- -----------------------------------------------------------------------------
create or replace function app.enforce_member_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max   integer;
  v_count integer;
begin
  select p.max_users into v_max
  from public.plans p
  where p.code = app.org_effective_plan(new.organization_id);

  if v_max is null then
    -- Plan payant : le dépassement est facturé, pas refusé.
    return new;
  end if;

  -- `invited` compte dans le plafond : sinon une organisation Free inviterait
  -- dix personnes, et la limite ne se manifesterait qu'à l'acceptation.
  select count(*) into v_count
  from public.organization_members
  where organization_id = new.organization_id
    and status in ('active', 'invited')
    and id <> new.id;

  if v_count >= v_max then
    raise exception
      'La formule Gratuite est limitée à % utilisateur. Passez à Starter pour inviter votre équipe.',
      v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function app.enforce_plan_downgrade_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max   integer;
  v_count integer;
begin
  if new.organization_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.plan_code = old.plan_code then
    return new;
  end if;

  select p.max_users into v_max from public.plans p where p.code = new.plan_code;
  if v_max is null then
    return new;
  end if;

  select count(*) into v_count
  from public.organization_members
  where organization_id = new.organization_id
    and status in ('active', 'invited');

  if v_count > v_max then
    raise exception
      'Cette formule est limitée à % utilisateur ; l''organisation en compte %. Retirez % membre(s) avant de changer de formule.',
      v_max, v_count, v_count - v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
create or replace function public.organization_billing_summary(p_organization_id uuid)
returns table (
  plan_code         text,
  plan_name         text,
  included_seats    integer,
  active_seats      integer,
  extra_seats       integer,
  extra_seat_cents  integer,
  base_cents        integer,
  total_cents       integer,
  max_users         integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not app.is_org_member(p_organization_id) then
    raise exception 'Organisation inconnue ou accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.code,
    p.name,
    coalesce(
      (select f.limit_value from public.plan_features f
       where f.plan_code = p.code and f.feature_key = 'members'),
      0),
    app.org_billable_seats(p_organization_id),
    app.org_extra_seats(p_organization_id),
    p.extra_user_price_cents,
    case when p.code = 'free' then 0 else p.price_monthly_cents end,
    app.org_monthly_amount_cents(p_organization_id, 'monthly'),
    p.max_users
  from public.plans p
  where p.code = app.org_effective_plan(p_organization_id);
end;
$$;

revoke all on function public.organization_billing_summary(uuid) from public, anon;
grant execute on function public.organization_billing_summary(uuid) to authenticated;
