-- =============================================================================
-- Nettoyage : le chemin annuel mort, et la rétention du journal Stripe
-- =============================================================================
--
-- 1. `app.org_monthly_amount_cents` gardait un paramètre `p_interval` capable
--    de calculer un montant annuel. Plus personne ne l'appelle ainsi : l'annuel
--    a été retiré de la grille, faute de pouvoir mélanger deux périodicités
--    dans un même abonnement Stripe.
--
--    Un chemin de calcul qu'aucun appelant n'emprunte mais qui produirait un
--    montant DIFFÉRENT est exactement le genre de code qu'on réactive par
--    inadvertance — et ici, l'inadvertance se lit sur une facture.
--
-- 2. `stripe_events` n'avait aucune purge. Elle croît d'une ligne par événement
--    reçu, indéfiniment. Sur un compte actif, cela fait quelques milliers de
--    lignes par an — pas un problème de volume, mais une table qui n'a aucune
--    raison de conserver l'historique de 2026 en 2030.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Le montant est mensuel, un point c'est tout
-- -----------------------------------------------------------------------------
drop function if exists app.org_monthly_amount_cents(uuid, text);

create or replace function app.org_monthly_amount_cents(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.code = 'free' then 0
    else p.price_monthly_cents
         + app.org_extra_seats(p_organization_id) * p.extra_user_price_cents
  end
  from public.plans p
  where p.code = app.org_effective_plan(p_organization_id);
$$;

revoke all on function app.org_monthly_amount_cents(uuid) from public, anon;
grant execute on function app.org_monthly_amount_cents(uuid) to authenticated;

-- La synthèse suit la nouvelle signature.
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
    app.org_monthly_amount_cents(p_organization_id),
    p.max_users
  from public.plans p
  where p.code = app.org_effective_plan(p_organization_id);
end;
$$;

revoke all on function public.organization_billing_summary(uuid) from public, anon;
grant execute on function public.organization_billing_summary(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Rétention du journal des événements Stripe
-- -----------------------------------------------------------------------------
--
-- Quatre-vingt-dix jours : au-delà, Stripe lui-même ne rejoue plus, et le
-- journal n'a plus de rôle à tenir. Sa seule utilité résiduelle serait le
-- diagnostic, que les journaux de la fonction Edge couvrent mieux.
--
-- Déclenchée par l'écriture, comme la purge des relevés GPS l'était : une
-- tâche programmée dépend d'une extension à activer et d'un planificateur à
-- surveiller. Celle-ci ne peut pas être oubliée, puisqu'elle s'exécute là où la
-- donnée naît.
create or replace function app.prune_stripe_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.stripe_events
  where received_at < now() - interval '90 days';

  return null;
end;
$$;

drop trigger if exists stripe_events_prune on public.stripe_events;
create trigger stripe_events_prune
  after insert on public.stripe_events
  for each statement execute function app.prune_stripe_events();
