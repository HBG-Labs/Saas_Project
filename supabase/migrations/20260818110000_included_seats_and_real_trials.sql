-- =============================================================================
-- Sièges inclus : une seule vérité — et l'essai redevient un essai
-- =============================================================================
--
-- Deux corrections sans rapport de nature, mais nées de la même vérification :
-- le branchement de Stripe étant terminé, on a relu ce que la base raconte
-- vraiment à une entreprise.
--
-- -----------------------------------------------------------------------------
-- A. « 0 siège inclus » sur un plan qui en autorise 1
-- -----------------------------------------------------------------------------
--
-- Free n'a pas de ligne `members` dans `plan_features` : la formule Gratuite ne
-- donne accès à aucun module d'organisation, seulement aux calculatrices. Son
-- effectif est plafonné ailleurs, par `plans.max_users = 1`.
--
-- Conséquence : les trois endroits qui calculent les « sièges inclus » font tous
-- `coalesce(plan_features.members, 0)` et annoncent donc ZÉRO siège inclus, alors
-- que le plan en autorise un. C'était sans effet tant que Free restait théorique.
-- Ce n'est plus le cas : depuis `20260818100000`, toute organisation dont
-- l'abonnement expire retombe sur Free. L'écran de facturation qu'elle découvre
-- à ce moment précis lui annonce « 0 siège inclus » pour son unique compte, et
-- lui compte « 1 siège supplémentaire » facturé 0 €.
--
-- POURQUOI PAS SIMPLEMENT AJOUTER LA LIGNE ('free', 'members', 1)
--
-- Parce que `app.org_has_feature` s'ouvre dès qu'une ligne existe avec
-- `limit_value > 0`. Ajouter cette ligne déverrouillerait, pour tout compte
-- Gratuit, les destinations gardées par `feature: 'members'` — Techniciens ET
-- Véhicules. Un correctif d'affichage qui élargit les droits n'est pas un
-- correctif d'affichage.
--
-- On introduit donc `app.org_included_seats`, qui dit où lire l'information :
-- la limite du plan si elle existe, sinon le plafond dur, sinon zéro. Les trois
-- copies disparaissent au profit de cet appel. Ce dépôt a déjà payé le prix
-- d'une même donnée calculée à deux endroits ; on ne recommence pas à trois.
--
-- CE QUI NE CHANGE PAS : pour les quatre plans payants, `plan_features.members`
-- est renseigné (2 / 5 / 10 / 20) et `max_users` est NULL. Le `coalesce` retient
-- donc la même valeur qu'avant, et aucun montant facturé ne bouge.
--
-- RÉSERVE ASSUMÉE : une ligne `members` présente avec `limit_value` à NULL
-- signifie « illimité » pour `org_has_feature`, mais retombe ici sur le plafond
-- puis sur zéro — donc tous les sièges deviendraient supplémentaires. Aucun plan
-- n'est dans ce cas aujourd'hui, et c'est déjà le comportement actuel : on le
-- signale plutôt que de le changer en passant.
--
-- -----------------------------------------------------------------------------
-- B. L'essai d'un an n'a plus lieu d'être
-- -----------------------------------------------------------------------------
--
-- `20260814100000` a porté à douze mois les essais alors en cours. La raison
-- était juste, et cette migration la formulait elle-même : le paiement n'était
-- pas branché, laisser les essais expirer revenait à « programmer une panne ».
-- Elle annonçait aussi sa propre fin : « le jour où le paiement sera branché il
-- faudra que le mécanisme d'expiration ait toujours fonctionné. »
--
-- Ce jour est arrivé. Les quatre fonctions Edge sont en ligne, la grille est en
-- base, un abonnement réel a été encaissé et le webhook l'a écrit. Le motif de
-- la prolongation a disparu ; la prolongation aussi.
--
-- CE QUI EST TOUCHÉ, EXACTEMENT
--
-- Les abonnements `trialing` dont l'essai court au-delà de quatorze jours — la
-- signature exacte de la prolongation de douze mois. Un essai normal, ouvert
-- récemment, se termine par construction dans moins de quatorze jours et n'est
-- donc pas concerné. Les organisations de démonstration sont en `active` et
-- restent hors de portée : les suites SQL s'appuient sur elles.
--
-- Aucune donnée n'est supprimée. Une organisation dont l'essai arrive à terme
-- retombe sur Free : ses missions, ses clients et ses équipes restent en base,
-- simplement masqués par les policies jusqu'à souscription.
-- =============================================================================

-- ─────────────────────────────────────────────── A. les sièges inclus

create or replace function app.org_included_seats(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    -- 1. ce que la formule inclut, quand elle le dit
    (select f.limit_value
       from public.plan_features f
      where f.plan_code = app.org_effective_plan(p_organization_id)
        and f.feature_key = 'members'),
    -- 2. à défaut, le plafond dur du plan : c'est le cas de Free, qui autorise
    --    un compte sans pour autant ouvrir le module d'effectifs
    (select p.max_users
       from public.plans p
      where p.code = app.org_effective_plan(p_organization_id)),
    -- 3. plan inconnu : rien d'inclus, et tout siège compte comme supplément
    0
  );
$$;

revoke all on function app.org_included_seats(uuid) from public, anon;

create or replace function app.org_extra_seats(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    0,
    app.org_billable_seats(p_organization_id) - app.org_included_seats(p_organization_id)
  );
$$;

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
    app.org_included_seats(p_organization_id),
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

-- ─────────────────────────────────────────────── B. le retour aux 14 jours

with ramenes as (
  update public.subscriptions
     set trial_ends_at      = now() + interval '14 days',
         current_period_end = now() + interval '14 days',
         updated_at         = now()
   where status = 'trialing'
     and trial_ends_at > now() + interval '14 days'
  returning id, organization_id, trial_ends_at
)
-- La décision est tracée au journal, comme l'était la prolongation qu'elle
-- annule. `user_id` reste NULL : cette écriture n'a pas d'acteur humain, et
-- `actor_label` porte l'information à sa place.
insert into public.audit_logs (
  organization_id, user_id, actor_label, action, entity_type, entity_id, metadata
)
select
  r.organization_id,
  null,
  'Migration 20260818110000',
  'subscription.trial_shortened',
  'subscription',
  r.id,
  jsonb_build_object(
    'reason', 'Le paiement est branché : la prolongation de douze mois n''a plus d''objet',
    'supersedes', '20260814100000',
    'new_trial_end', r.trial_ends_at
  )
from ramenes r
where r.organization_id is not null;
