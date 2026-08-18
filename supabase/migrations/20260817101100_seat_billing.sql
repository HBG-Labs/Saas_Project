-- =============================================================================
-- Sièges facturables — le serveur compte, calcule et décide
-- =============================================================================
--
-- LE RENVERSEMENT
--
-- `plan_features.members` était un PLAFOND DUR : `app.enforce_member_quota`
-- refusait le onzième membre d'une organisation Business. La nouvelle grille en
-- fait un SEUIL DE FACTURATION — le onzième est accepté et coûte 5 €.
--
-- Une seule exception, et elle reste absolue : Free est plafonné à un
-- utilisateur. C'est ce que porte désormais `plans.max_users`, renseigné pour
-- Free seulement.
--
-- Mesuré avant migration : `hbzindustrie` compte exactement dix membres actifs
-- sur un quota de dix. Elle est bloquée aujourd'hui ; elle pourra croître
-- demain, en payant.
--
-- DEUX COMPTAGES, ET L'ASYMÉTRIE EST VOULUE
--
--   facturation   → membres `active` UNIQUEMENT
--   plafond Free  → membres `active` + `invited`
--
-- Facturer une invitation en attente reviendrait à faire payer un siège pour
-- quelqu'un qui n'a pas encore accepté, et qui n'acceptera peut-être jamais.
-- À l'inverse, ne compter que les actifs pour le plafond Free le rendrait
-- inopérant : l'organisation inviterait dix personnes, et la limite ne mordrait
-- qu'une par une, à l'acceptation.
--
-- Le passage `invited` → `active` a lieu dans
-- `public.accept_organization_invitation`, et nulle part ailleurs. C'est là,
-- précisément, qu'un siège devient payant.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Combien de sièges sont facturés
-- -----------------------------------------------------------------------------
create or replace function app.org_billable_seats(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.organization_members m
  where m.organization_id = p_organization_id
    and m.status = 'active';
$$;

/**
 * Sièges au-delà de ceux compris dans la formule.
 *
 * `coalesce(…, 0)` sur les sièges inclus : un plan sans clé `members` n'inclut
 * aucun siège, il n'en offre pas une infinité. Renvoyer `null` ferait remonter
 * un montant `null` jusqu'à la facture.
 */
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
      - coalesce(app.org_feature_limit(p_organization_id, 'members'), 0)
  );
$$;

/**
 * Montant mensuel dû, en centimes.
 *
 * Free reste à zéro quel que soit l'effectif : son plafond dur garantit qu'il
 * n'y a jamais de dépassement, et un supplément sur une offre gratuite serait
 * une contradiction.
 *
 * En facturation annuelle, le prix affiché est l'ÉQUIVALENT MENSUEL — c'est ce
 * que l'interface annonce, et ce que Stripe facturera douze fois. Le siège
 * supplémentaire, lui, garde son tarif mensuel : la grille ne prévoit pas de
 * remise annuelle dessus.
 */
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
  where p.code = app.org_plan_code(p_organization_id);
$$;

revoke all on function app.org_billable_seats(uuid) from public, anon;
revoke all on function app.org_extra_seats(uuid) from public, anon;
revoke all on function app.org_monthly_amount_cents(uuid, text) from public, anon;

grant execute on function app.org_billable_seats(uuid) to authenticated;
grant execute on function app.org_extra_seats(uuid) to authenticated;
grant execute on function app.org_monthly_amount_cents(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Le plafond ne vaut plus que pour Free
-- -----------------------------------------------------------------------------
--
-- L'ancienne version lisait `plan_features.members` et refusait au-delà. Elle
-- lit maintenant `plans.max_users`, renseigné pour Free seulement.
--
-- CONSÉQUENCE ASSUMÉE : rien n'empêche plus une organisation payante d'ajouter
-- cent membres et de recevoir une facture de 499 €. C'est ce que demande la
-- grille — « aucune limite maximale ». Un garde-fou non demandé serait une
-- décision produit prise ici, au mauvais endroit.
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
  where p.code = app.org_plan_code(new.organization_id);

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

-- -----------------------------------------------------------------------------
-- On ne redescend pas vers Free avec une équipe
-- -----------------------------------------------------------------------------
--
-- Free plafonne à un utilisateur. Y ramener une organisation de sept personnes
-- laisserait un état que le plafond interdit de créer — et la seule sortie
-- serait de supprimer des membres automatiquement, ce qu'aucun logiciel ne
-- devrait faire dans le dos de son utilisateur.
--
-- Le changement est donc REFUSÉ tant que l'effectif dépasse le plafond visé.
-- Le message dit combien de personnes retirer : une erreur qui n'indique pas
-- l'issue oblige à deviner.
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
    return new;  -- abonnement personnel : pas d'effectif à contrôler
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

drop trigger if exists subscriptions_downgrade_capacity on public.subscriptions;
create trigger subscriptions_downgrade_capacity
  before insert or update of plan_code on public.subscriptions
  for each row execute function app.enforce_plan_downgrade_capacity();

-- -----------------------------------------------------------------------------
-- La synthèse lue par l'interface
-- -----------------------------------------------------------------------------
--
-- Une seule RPC plutôt qu'un calcul en TypeScript, pour la raison déjà retenue
-- sur le décompte des congés : deux implémentations du même barème divergent, et
-- celle qui diverge en silence est celle qu'on affiche. Ici, ce serait le
-- montant d'une facture.
--
-- `security invoker` : la fonction n'expose que ce que l'appelant a le droit de
-- lire, et le contrôle d'appartenance est explicite.
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
  -- Cloisonnement : la facturation d'une entreprise ne regarde qu'elle.
  if not app.is_org_member(p_organization_id) then
    raise exception 'Organisation inconnue ou accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.code,
    p.name,
    coalesce(app.org_feature_limit(p_organization_id, 'members'), 0),
    app.org_billable_seats(p_organization_id),
    app.org_extra_seats(p_organization_id),
    p.extra_user_price_cents,
    case when p.code = 'free' then 0 else p.price_monthly_cents end,
    app.org_monthly_amount_cents(p_organization_id, 'monthly'),
    p.max_users
  from public.plans p
  where p.code = app.org_plan_code(p_organization_id);
end;
$$;

revoke all on function public.organization_billing_summary(uuid) from public, anon;
grant execute on function public.organization_billing_summary(uuid) to authenticated;
