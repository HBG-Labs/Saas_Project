-- =============================================================================
-- La synthèse dit enfin si l'organisation PAIE réellement
-- =============================================================================
--
-- LE CONSTAT, VENU D'UN UTILISATEUR
--
-- Une entreprise en période d'essai ajoute un onzième collaborateur. La barre
-- de quota lui annonce « 11 utilisateurs — 10 inclus, +1 supplémentaire
-- (+5 €/mois) ». Elle va voir chez Stripe : rien n'a bougé. Elle conclut à une
-- panne de synchronisation.
--
-- Il n'y en avait pas. Cette organisation n'a AUCUN abonnement Stripe — elle
-- est en essai, et le prestataire n'a rien à modifier. Le calcul du serveur est
-- juste : 79 € par mois. Simplement, ce montant ne sera dû qu'à la souscription.
--
-- Le défaut n'est donc pas dans la facturation, il est dans ce qu'on affiche :
-- l'interface énonce un prix au présent pour une somme qui n'est pas encore
-- réclamée. C'est la troisième fois que ce même travers se manifeste — après la
-- fenêtre d'invitation, qui annonçait une facturation immédiate pour un siège
-- payable à l'acceptation.
--
-- CE QU'IL MANQUAIT POUR LE DIRE
--
-- L'écran des membres n'a aucun moyen de savoir si un abonnement Stripe existe.
-- La table `subscriptions` est réservée à `billing.view` : un administrateur qui
-- gère les effectifs sans gérer le paiement lit `null` et ne peut pas faire la
-- différence entre « pas d'abonnement » et « pas le droit de regarder ».
--
-- La synthèse, elle, est lisible par tout membre — c'est justement son rôle.
-- Elle porte désormais deux informations de plus : le statut de l'abonnement, et
-- s'il est effectivement pris en charge par un prestataire de paiement.
--
-- POURQUOI DEUX FONCTIONS `app.*` PLUTÔT QU'UNE JOINTURE
--
-- La synthèse est `security invoker` : une lecture directe de `subscriptions`
-- y serait filtrée par la RLS, et rendrait `null` à qui n'a pas `billing.view`
-- — exactement le trou qu'on cherche à combler. Les deux helpers sont
-- `security definer`, comme `app.org_plan_code` dont ils reprennent le filtre à
-- l'identique : ils décrivent le MÊME abonnement que celui qui détermine la
-- formule, et non un autre.
-- =============================================================================

create or replace function app.org_subscription_status(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.status::text
  from public.subscriptions s
  where s.organization_id = p_organization_id
    and s.status in ('trialing', 'active', 'past_due')
    and (s.current_period_end is null or s.current_period_end > now())
  order by s.created_at desc
  limit 1;
$$;

/**
 * Un prestataire de paiement encaisse-t-il pour cette organisation ?
 *
 * `false` en période d'essai, sur la formule Gratuite, et sur les comptes
 * accordés à la main. Dans ces trois cas, un changement d'effectif ne produit
 * aucun mouvement chez Stripe — et l'interface doit le dire au lieu de laisser
 * croire à un prélèvement.
 */
create or replace function app.org_is_billed(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.provider_subscription_id is not null
     from public.subscriptions s
     where s.organization_id = p_organization_id
       and s.status in ('trialing', 'active', 'past_due')
       and (s.current_period_end is null or s.current_period_end > now())
     order by s.created_at desc
     limit 1),
    false
  );
$$;

revoke all on function app.org_subscription_status(uuid) from public, anon;
revoke all on function app.org_is_billed(uuid) from public, anon;
grant execute on function app.org_subscription_status(uuid) to authenticated;
grant execute on function app.org_is_billed(uuid) to authenticated;

-- La signature change : `create or replace` ne suffit pas pour ajouter des
-- colonnes à un `returns table`. On supprime et recrée — une fonction, jamais
-- une donnée — puis on repose les droits, que le `drop` emporte avec lui.
drop function if exists public.organization_billing_summary(uuid);

create function public.organization_billing_summary(p_organization_id uuid)
returns table (
  plan_code           text,
  plan_name           text,
  included_seats      integer,
  active_seats        integer,
  extra_seats         integer,
  extra_seat_cents    integer,
  base_cents          integer,
  total_cents         integer,
  max_users           integer,
  subscription_status text,
  is_billed           boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  -- Cloisonnement : la facturation d'une entreprise ne regarde qu'elle.
  if not app.is_org_member(p_organization_id) then
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

revoke all on function public.organization_billing_summary(uuid) from public, anon;
grant execute on function public.organization_billing_summary(uuid) to authenticated;
