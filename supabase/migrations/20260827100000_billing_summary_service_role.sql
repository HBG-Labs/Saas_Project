-- Autorise le rôle interne `service_role` (utilisé par les Edge Functions) à calculer la synthèse de facturation.
create or replace function public.organization_billing_summary(p_organization_id uuid)
returns table (
  plan_code text,
  plan_name text,
  included_seats integer,
  active_seats integer,
  extra_seats integer,
  extra_seat_cents integer,
  base_cents integer,
  total_cents integer,
  max_users integer,
  subscription_status text,
  is_billed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Cloisonnement : la facturation d'une entreprise ne regarde qu'elle (autorise aussi le service_role interne).
  if (select auth.role()) <> 'service_role' and not app.is_org_member(p_organization_id) then
    raise exception 'Organisation inconnue ou accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.code,
    p.name,
    app.org_included_seats(p_organization_id),
    app.org_billable_seats(p_organization_id),
    app.org_extra_seats(p_organization_id),
    p.extra_user_price_cents,
    case when p.code = 'free' then 0 else p.price_monthly_cents end,
    app.org_monthly_amount_cents(p_organization_id),
    p.max_users,
    app.org_subscription_status(p_organization_id),
    app.org_is_billed(p_organization_id)
  from public.plans p
  where p.code = app.org_effective_plan(p_organization_id);
end;
$$;
