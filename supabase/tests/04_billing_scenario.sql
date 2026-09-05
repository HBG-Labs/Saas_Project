-- =============================================================================
-- SUITE DE TESTS — tarification, sièges et facturation
-- =============================================================================
-- Rejoue la grille officielle et les règles qui la gouvernent :
--
--   plan → sièges inclus → sièges actifs → supplément → montant
--
-- CE QUE CE FICHIER PROTÈGE
--
-- Un décompte de sièges faux ne provoque aucune erreur : il produit une facture
-- fausse. Personne ne s'en aperçoit avant le prélèvement — et alors c'est un
-- client qui le signale, pas un test.
--
-- Deux renversements récents méritent d'être tenus :
--
--   • `plan_features.members` n'est plus un plafond, c'est un SEUIL. Le
--     onzième membre d'une organisation Business est accepté et facturé.
--   • Free reste plafonné à un utilisateur, et ce plafond compte les invités.
--
--   npm run test:sql
--
-- Le script se termine par `rollback` : il ne laisse AUCUNE donnée derrière lui.
-- =============================================================================

begin;

set local search_path = pg_temp, public;

-- -----------------------------------------------------------------------------
-- Utilitaires — même dispositif que les suites 01 à 03
-- -----------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);

insert into t_ids (k, v) values
  ('patron_a', '00000000-0000-4000-8000-00000000e001'),
  ('salarie',  '00000000-0000-4000-8000-00000000e002'),
  ('patron_b', '00000000-0000-4000-8000-00000000e003'),
  ('solo',     '00000000-0000-4000-8000-00000000e004');

grant select on t_ids to authenticated;

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

create function pg_temp.login(p_key text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(p_key), 'email', p_key || '@test.local',
                      'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  -- `is not true` et non `not p_condition` : en SQL, `not null` vaut `null`, et
  -- un `if null then` ne s'exécute pas. La version précédente laissait donc
  -- PASSER en silence toute assertion dont l'expression valait NULL — le cas le
  -- plus courant étant une sous-requête qui ne ramène aucune ligne.
  --
  -- Trouvé en écrivant la suite 04 : `app.org_plan_code()` renvoyait NULL pour
  -- une organisation sans abonnement, `NULL = 'free'` valait NULL, et le test
  -- affichait « OK » sur une comparaison qui n'avait jamais été vraie.
  if p_condition is not true then
    raise exception 'ECHEC : % (condition %)', p_label,
      coalesce(p_condition::text, 'NULL')
      using errcode = 'assert_failure';
  end if;
  raise notice '  OK  %', p_label;
end;
$$;

create function pg_temp.refuses(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ECHEC : % (l''instruction a ete ACCEPTEE)', p_label
    using errcode = 'assert_failure';
exception
  when assert_failure then raise;
  when others then raise notice '  OK  % (refuse : %)', p_label, left(sqlerrm, 60);
end;
$$;

/** Montant attendu pour un plan et un effectif, sans toucher aux données. */
create function pg_temp.grille(p_plan text, p_sieges integer) returns integer
language sql stable as $$
  select case when p_plan = 'free' then 0
              else p.price_monthly_cents
                   + greatest(0, p_sieges - coalesce(f.limit_value, 0))
                     * p.extra_user_price_cents
         end / 100
  from public.plans p
  left join public.plan_features f
         on f.plan_code = p.code and f.feature_key = 'members'
  where p.code = p_plan;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated',
       k || '@test.local', '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
       now(), '{"provider":"email","providers":["email"]}'::jsonb,
       json_build_object('display_name', k)::jsonb, now(), now()
from pg_temp.t_ids;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — La grille officielle, quatorze cas ==='; end $$;
-- =============================================================================

do $$
declare c record;
begin
  for c in
    select * from (values
      ('free',        1,   0), ('starter',    2,  19), ('starter',   3,  24),
      ('starter',    10,  59), ('pro',        5,  39), ('pro',       6,  44),
      ('pro',        10,  64), ('business',  10,  69), ('business', 11,  74),
      ('business',   20, 119), ('enterprise',20,  99), ('enterprise',21, 104),
      ('enterprise', 50, 249), ('enterprise',100, 499)
    ) as t(plan, sieges, attendu)
  loop
    perform pg_temp.ok(
      pg_temp.grille(c.plan, c.sieges) = c.attendu,
      format('%s + %s sieges = %s EUR', c.plan, c.sieges, c.attendu)
    );
  end loop;
end
$$;

-- Le modèle lui-même, pas seulement l'arithmétique.
do $$
begin
  perform pg_temp.ok(
    (select count(*) from public.plans where status = 'active') = 5,
    'Cinq formules actives'
  );
  perform pg_temp.ok(
    not exists (select 1 from public.plans where code = 'ultimate'),
    'La formule « ultimate » n''existe plus'
  );
  perform pg_temp.ok(
    (select max_users from public.plans where code = 'free') = 1,
    'Free porte un plafond dur de 1'
  );
  perform pg_temp.ok(
    not exists (select 1 from public.plans where code <> 'free' and max_users is not null),
    'Aucun plan payant n''a de plafond'
  );
  perform pg_temp.ok(
    (select count(*) from public.plans
      where code <> 'free' and extra_user_price_cents = 500) = 4,
    'Le siege supplementaire vaut 5 EUR sur les quatre plans payants'
  );
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 2 — Free est plafonne a un utilisateur ==='; end $$;
-- =============================================================================

select pg_temp.login('solo');
set local role authenticated;
insert into public.organizations (slug, name, created_by, industry)
values ('essai-solo', 'Essai Solo', pg_temp.uid('solo'), 'fiber_telecom');
reset role;

-- `handle_new_organization` ouvre un essai : on le retire pour éprouver Free.
delete from public.subscriptions
where organization_id in (select id from public.organizations where slug = 'essai-solo');

do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-solo';

  -- `org_plan_code` renvoie NULL sans abonnement ; c'est `org_effective_plan`
  -- qui traduit cette absence en « Free ». La distinction n'est pas cosmétique :
  -- c'est elle que les fonctions de facturation lisaient de travers.
  perform pg_temp.ok(app.org_plan_code(v_org) is null,
    'Sans abonnement, org_plan_code ne renvoie rien');
  perform pg_temp.ok(app.org_effective_plan(v_org) = 'free',
    'L''absence d''abonnement se lit « Free »');
  perform pg_temp.ok(app.org_billable_seats(v_org) = 1,
    'Le createur compte pour un siege');
  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 0,
    'Free ne coute rien');

  -- Le deuxième utilisateur est refusé, et le message doit être exploitable.
  perform pg_temp.refuses(
    format($sql$ insert into public.organization_members (organization_id, user_id, role, status)
                 values (%L, %L, 'technician', 'active') $sql$,
           v_org, pg_temp.uid('salarie')),
    'Free refuse le deuxieme utilisateur'
  );

  -- Une INVITATION compte aussi : sinon le plafond ne mordrait qu'à
  -- l'acceptation, une personne à la fois.
  perform pg_temp.refuses(
    format($sql$ insert into public.organization_members (organization_id, user_id, role, status)
                 values (%L, %L, 'technician', 'invited') $sql$,
           v_org, pg_temp.uid('salarie')),
    'Free refuse aussi une invitation en attente'
  );
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 3 — Le depassement est FACTURE, pas refuse ==='; end $$;
-- =============================================================================

select pg_temp.login('patron_a');
set local role authenticated;
insert into public.organizations (slug, name, created_by, industry)
values ('essai-factu', 'Essai Facturation', pg_temp.uid('patron_a'), 'hvac');
reset role;

delete from public.subscriptions
where organization_id in (select id from public.organizations where slug = 'essai-factu');

insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select id, 'starter', 'active', now() + interval '30 days'
from public.organizations where slug = 'essai-factu';

do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-factu';

  perform pg_temp.ok(app.org_feature_limit(v_org, 'members') = 2,
    'Starter inclut deux sieges');
  perform pg_temp.ok(app.org_billable_seats(v_org) = 1, 'Un seul membre pour l''instant');
  perform pg_temp.ok(app.org_extra_seats(v_org) = 0, 'Aucun supplement sous le seuil');
  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 1900, 'Starter seul : 19 EUR');

  -- Deuxième membre : encore inclus.
  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org, pg_temp.uid('salarie'), 'technician', 'active');

  perform pg_temp.ok(app.org_billable_seats(v_org) = 2, 'Deux sieges actifs');
  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 1900, 'Toujours 19 EUR au seuil');

  -- Troisième : ACCEPTÉ, et facturé. C'est le renversement de sémantique.
  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org, pg_temp.uid('patron_b'), 'technician', 'active');

  perform pg_temp.ok(app.org_billable_seats(v_org) = 3, 'Le troisieme membre est ACCEPTE');
  perform pg_temp.ok(app.org_extra_seats(v_org) = 1, 'Il compte pour un siege supplementaire');
  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 2400, 'Le montant passe a 24 EUR');
end
$$;

-- Une invitation en attente n'est PAS facturée.
do $$
declare v_org uuid; v_avant integer;
begin
  select id into v_org from public.organizations where slug = 'essai-factu';
  v_avant := app.org_monthly_amount_cents(v_org);

  update public.organization_members set status = 'invited'
  where organization_id = v_org and user_id = pg_temp.uid('patron_b');

  perform pg_temp.ok(app.org_billable_seats(v_org) = 2,
    'Un membre repasse en « invite » : il sort du decompte facturable');
  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 1900,
    'Le montant redescend a 19 EUR');
  perform pg_temp.ok(v_avant = 2400, 'Il etait bien facture tant qu''il etait actif');

  -- Retour à l'état actif : le siège redevient payant.
  update public.organization_members set status = 'active'
  where organization_id = v_org and user_id = pg_temp.uid('patron_b');

  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 2400,
    'L''acceptation rend le siege payant');
end
$$;

-- Le retrait d'un membre fait redescendre le montant, sans jamais passer sous zéro.
do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-factu';

  delete from public.organization_members
  where organization_id = v_org and user_id = pg_temp.uid('patron_b');

  perform pg_temp.ok(app.org_extra_seats(v_org) = 0, 'Le supplement retombe a zero');
  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 1900, 'Retour a 19 EUR');

  delete from public.organization_members
  where organization_id = v_org and user_id = pg_temp.uid('salarie');

  perform pg_temp.ok(app.org_extra_seats(v_org) = 0,
    'Sous le seuil, le supplement reste a zero et ne devient jamais negatif');
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 4 — Changement de formule ==='; end $$;
-- =============================================================================

do $$
declare v_org uuid; v_i integer;
begin
  select id into v_org from public.organizations where slug = 'essai-factu';

  -- Sept membres au total : le créateur plus six.
  for v_i in 1..6 loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
            'authenticated', 'equipe' || v_i || '@test.local',
            '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte', now(),
            '{"provider":"email","providers":["email"]}'::jsonb, now(), now());
  end loop;

  insert into public.organization_members (organization_id, user_id, role, status)
  select v_org, u.id, 'technician', 'active'
  from auth.users u where u.email like 'equipe%@test.local';

  perform pg_temp.ok(app.org_billable_seats(v_org) = 7, 'Sept membres actifs');
  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 1900 + 5 * 500,
    'Starter a sept : 19 + 5x5 = 44 EUR');

  -- Montée en Pro : le seuil passe de 2 à 5, le supplément fond.
  update public.subscriptions set plan_code = 'pro' where organization_id = v_org;

  perform pg_temp.ok(app.org_feature_limit(v_org, 'members') = 5, 'Pro inclut cinq sieges');
  perform pg_temp.ok(app.org_extra_seats(v_org) = 2, 'Deux sieges au-dela');
  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 4900,
    'Pro a sept : 39 + 2x5 = 49 EUR');

  -- Montée en Business : sept membres tiennent dans les dix inclus.
  update public.subscriptions set plan_code = 'business' where organization_id = v_org;

  perform pg_temp.ok(app.org_extra_seats(v_org) = 0, 'Business absorbe les sept');
  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 6900, 'Business : 69 EUR');
end
$$;

-- On ne redescend pas vers Free avec sept personnes.
do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-factu';

  perform pg_temp.refuses(
    format($sql$ update public.subscriptions set plan_code = 'free'
                 where organization_id = %L $sql$, v_org),
    'Le retour a Free est refuse tant que l''effectif depasse le plafond'
  );

  -- Une redescente vers un plan payant, en revanche, est permise : elle coûte
  -- plus cher, elle ne casse rien.
  update public.subscriptions set plan_code = 'starter' where organization_id = v_org;
  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 4400,
    'Redescente en Starter : 44 EUR, sans suppression de membre');
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 5 — Cloisonnement et droits ==='; end $$;
-- =============================================================================

select pg_temp.login('patron_b');
set local role authenticated;
insert into public.organizations (slug, name, created_by, industry)
values ('essai-voisin-b', 'Essai Voisin B', pg_temp.uid('patron_b'), 'landscaping');
reset role;

select pg_temp.login('patron_b');
set local role authenticated;

do $$
declare v_autre uuid;
begin
  select id into v_autre from public.organizations where slug = 'essai-factu';

  -- La synthèse de facturation d'une autre entreprise est inaccessible.
  perform pg_temp.refuses(
    format($sql$ select * from public.organization_billing_summary(%L) $sql$, v_autre),
    'La facturation d''une autre organisation est refusee'
  );

  -- Et l'abonnement lui-même reste invisible.
  perform pg_temp.ok(
    not exists (select 1 from public.subscriptions where organization_id = v_autre),
    'L''abonnement d''une autre organisation n''est pas lisible'
  );
end
$$;

reset role;

-- Aucun client ne peut s'attribuer une formule : `subscriptions` n'a pas de
-- policy d'écriture. C'est la garantie qui rend inutile toute validation du
-- corps de requête côté fonction Edge.
select pg_temp.login('patron_a');
set local role authenticated;

do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-factu';

  perform pg_temp.refuses(
    format($sql$ insert into public.subscriptions (organization_id, plan_code, status)
                 values (%L, 'enterprise', 'active') $sql$, v_org),
    'Un client ne peut pas s''attribuer la formule Enterprise'
  );

  perform pg_temp.refuses(
    format($sql$ update public.subscriptions set plan_code = 'enterprise'
                 where organization_id = %L $sql$, v_org),
    'Un client ne peut pas modifier sa propre formule'
  );

  perform pg_temp.refuses(
    $sql$ update public.plans set price_monthly_cents = 100 where code = 'enterprise' $sql$,
    'Un client ne peut pas modifier les tarifs'
  );
end
$$;

-- La synthèse de SA propre organisation, en revanche, est lisible.
do $$
declare v_org uuid; v_row record;
begin
  select id into v_org from public.organizations where slug = 'essai-factu';
  select * into v_row from public.organization_billing_summary(v_org);

  perform pg_temp.ok(v_row.plan_code = 'starter', 'La synthese annonce la bonne formule');
  perform pg_temp.ok(v_row.included_seats = 2, 'Elle annonce les sieges inclus');
  perform pg_temp.ok(v_row.active_seats = 7, 'Elle annonce l''effectif reel');
  perform pg_temp.ok(v_row.extra_seats = 5, 'Elle annonce le depassement');
  perform pg_temp.ok(v_row.total_cents = 4400, 'Elle annonce le montant du');
end
$$;

reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 6 — Idempotence du webhook ==='; end $$;
-- =============================================================================

do $$
declare v_insere integer;
begin
  insert into public.stripe_events (id, type) values ('evt_test_rejeu', 'customer.subscription.updated');

  -- Le rejeu doit être refusé par la clé primaire : c'est tout le dispositif.
  begin
    insert into public.stripe_events (id, type) values ('evt_test_rejeu', 'customer.subscription.updated');
    raise exception 'ECHEC : un evenement Stripe rejoue a ete accepte deux fois'
      using errcode = 'assert_failure';
  exception
    when unique_violation then
      raise notice '  OK  Un evenement Stripe rejoue est refuse';
    when assert_failure then raise;
  end;

  select count(*) into v_insere from public.stripe_events where id = 'evt_test_rejeu';
  perform pg_temp.ok(v_insere = 1, 'Une seule trace subsiste apres le rejeu');
end
$$;

-- Aucun accès client au journal, même pour son propre compte.
--
-- Le refus est plus net que prévu : le privilège `select` est RÉVOQUÉ, donc la
-- requête échoue au lieu de renvoyer un ensemble vide. C'est mieux — une table
-- vide se confond avec une table sans données, un refus ne se confond avec
-- rien.
set local role authenticated;
select pg_temp.refuses(
  $sql$ select count(*) from public.stripe_events $sql$,
  'Le journal des evenements Stripe est inaccessible aux clients'
);
reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 7 — L''ecriture du webhook, telle qu''elle se produit ==='; end $$;
-- =============================================================================
--
-- CE QUE CETTE PARTIE PROTÈGE, ET POURQUOI ELLE EXISTE
--
-- Au premier paiement réel, le webhook a répondu 200, journalisé l'événement
-- comme traité — et n'a rien écrit. Deux causes conjuguées :
--
--   1. `subscriptions_active_org_idx` n'admet qu'UN abonnement vivant par
--      organisation, et `app.start_organization_trial` en avait déjà ouvert un.
--      L'insertion violait l'index.
--   2. L'erreur n'était pas contrôlée : `supabase-js` ne lève pas, il renvoie
--      `{ data, error }`. L'échec passait en silence sur la seule écriture qui
--      compte de tout le système de facturation.
--
-- Un paiement encaissé, aucun droit accordé, et aucune alarme. Le rejeu n'y
-- pouvait rien : Stripe avait reçu un 200.
--
-- On reproduit ici la séquence exacte que la fonction exécute, en SQL, pour que
-- la contrainte d'unicité soit éprouvée sans dépendre d'un paiement.

do $$
declare v_org uuid; v_vivants integer; v_essai text;
begin
  select id into v_org from public.organizations where slug = 'essai-factu';

  -- Remise en situation : un essai en cours, comme après création d'entreprise.
  delete from public.subscriptions where organization_id = v_org;
  insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
  values (v_org, 'starter', 'trialing', now() + interval '30 days');

  perform pg_temp.ok(app.org_effective_plan(v_org) = 'starter',
    'L''organisation est en essai avant paiement');

  -- ÉTAPE 1 du webhook : refermer ce qui occupe la place unique.
  --
  -- Le FILTRE est reproduit tel quel, et pas seulement son intention. Le
  -- webhook écrivait d'abord `neq(sub_id) AND is null` — deux conditions qui ne
  -- peuvent jamais être vraies ensemble, puisque `NULL <> 'sub_x'` vaut NULL et
  -- non TRUE. L'essai n'était donc jamais refermé, et l'insertion suivante
  -- violait l'index.
  --
  -- Ce test ne l'avait pas vu parce qu'il reproduisait la SÉQUENCE sans le
  -- filtre. Un test qui simplifie ce qu'il éprouve n'éprouve plus grand-chose.
  update public.subscriptions
  set status = 'canceled', canceled_at = now()
  where organization_id = v_org
    and status in ('trialing', 'active', 'past_due')
    and (provider_subscription_id is null or provider_subscription_id <> 'sub_essai');

  -- ÉTAPE 2 : écrire l'abonnement payé.
  insert into public.subscriptions
    (organization_id, plan_code, status, current_period_start, current_period_end,
     provider, provider_customer_id, provider_subscription_id)
  values (v_org, 'pro', 'active', now(), now() + interval '30 days',
          'stripe', 'cus_essai', 'sub_essai')
  on conflict (provider_subscription_id) do update set
    plan_code = excluded.plan_code,
    status    = excluded.status;

  select count(*) into v_vivants from public.subscriptions
  where organization_id = v_org and status in ('trialing', 'active', 'past_due');

  perform pg_temp.ok(v_vivants = 1,
    'Un seul abonnement vivant subsiste apres le paiement');

  select status into v_essai from public.subscriptions
  where organization_id = v_org and provider_subscription_id is null;

  perform pg_temp.ok(v_essai = 'canceled', 'L''essai est referme, pas supprime');

  -- La formulation fautive, mise à l'épreuve : elle ne doit toucher AUCUNE
  -- ligne. Si un jour elle en touchait une, c'est que la logique à trois
  -- valeurs de PostgreSQL aurait changé — et le webhook pourrait revenir à
  -- l'ancienne écriture sans qu'on s'en aperçoive.
  declare v_touchees integer;
  begin
    with faux as (
      update public.subscriptions set status = status
      where organization_id = v_org
        and provider_subscription_id <> 'sub_essai'
        and provider_subscription_id is null
      returning 1
    )
    select count(*) into v_touchees from faux;

    perform pg_temp.ok(v_touchees = 0,
      '`neq` ET `is null` combines ne selectionnent rien : c''est la faute d''origine');
  end;
  perform pg_temp.ok(app.org_effective_plan(v_org) = 'pro',
    'La formule payee gouverne desormais les droits');
end
$$;

-- Le REJEU du même abonnement ne doit rien dupliquer.
do $$
declare v_org uuid; v_lignes integer;
begin
  select id into v_org from public.organizations where slug = 'essai-factu';

  insert into public.subscriptions
    (organization_id, plan_code, status, current_period_start, current_period_end,
     provider, provider_customer_id, provider_subscription_id)
  values (v_org, 'pro', 'active', now(), now() + interval '30 days',
          'stripe', 'cus_essai', 'sub_essai')
  on conflict (provider_subscription_id) do update set
    plan_code = excluded.plan_code,
    status    = excluded.status;

  select count(*) into v_lignes from public.subscriptions
  where provider_subscription_id = 'sub_essai';

  perform pg_temp.ok(v_lignes = 1, 'Le rejeu du meme abonnement ne cree pas de doublon');
end
$$;

-- Sans refermer l'essai, l'ecriture DOIT echouer : c'est la contrainte qui a
-- fait echouer le premier paiement, et elle doit continuer de mordre.
do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-voisin-b';

  delete from public.subscriptions where organization_id = v_org;
  insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
  values (v_org, 'starter', 'trialing', now() + interval '30 days');

  perform pg_temp.refuses(
    format($sql$ insert into public.subscriptions
                   (organization_id, plan_code, status, current_period_end,
                    provider, provider_subscription_id)
                 values (%L, 'pro', 'active', now() + interval '30 days',
                         'stripe', 'sub_conflit') $sql$, v_org),
    'Deux abonnements vivants sur la meme organisation sont refuses'
  );
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 8 — Resilier, et se raviser ==='; end $$;
-- =============================================================================
--
-- La resiliation ne coupe rien : elle leve un drapeau, et c'est l'echeance deja
-- inscrite qui eteint l'acces. On eprouve donc surtout ce qui NE doit PAS
-- changer au moment du clic.

select pg_temp.login('patron_a');
set local role authenticated;
insert into public.organizations (slug, name, created_by, industry)
values ('essai-resil', 'Essai Resiliation', pg_temp.uid('patron_a'), 'hvac');
reset role;

-- Une organisation neuve est désormais en Gratuit. Cette fixture représente
-- un abonnement non-Stripe encore en cours, seul type que la RPC locale de
-- résiliation est autorisée à gérer.
insert into public.subscriptions
  (organization_id, plan_code, status, current_period_start,
   current_period_end, trial_ends_at)
select id, 'business', 'trialing', now(),
       now() + interval '30 days', now() + interval '30 days'
from public.organizations
where slug = 'essai-resil';

do $$
declare
  v_org  uuid;
  v_fin  timestamptz;
  v_rend timestamptz;
begin
  select id into v_org from public.organizations where slug = 'essai-resil';
  select current_period_end into v_fin from public.subscriptions where organization_id = v_org;

  -- ---- le proprietaire resilie
  perform pg_temp.login('patron_a');
  v_rend := public.cancel_organization_subscription(v_org);

  perform pg_temp.ok(v_rend = v_fin, 'La date de fin d''acces est rendue a l''appelant');
  perform pg_temp.ok(
    (select cancel_at_period_end from public.subscriptions where organization_id = v_org),
    'Le drapeau de resiliation est leve');

  -- CE QUI NE DOIT PAS AVOIR BOUGE : couper l'acces au clic serait une punition,
  -- pas une resiliation. L'entreprise garde ce qui lui a ete promis.
  perform pg_temp.ok(app.org_effective_plan(v_org) = 'business',
    'La formule reste la meme jusqu''a l''echeance');
  perform pg_temp.ok(app.org_has_feature(v_org, 'missions'),
    'Les missions restent accessibles apres la resiliation');
  perform pg_temp.ok(
    (select current_period_end from public.subscriptions where organization_id = v_org) = v_fin,
    'L''echeance n''est pas avancee');
  perform pg_temp.ok(
    (select status from public.subscriptions where organization_id = v_org) = 'trialing',
    'Le statut n''est pas force a canceled');

  -- ---- l'echeance passee, l'acces tombe de lui-meme
  update public.subscriptions
     set current_period_end = now() - interval '1 day',
         trial_ends_at      = now() - interval '1 day'
   where organization_id = v_org;

  perform pg_temp.ok(app.org_effective_plan(v_org) = 'free',
    'Passee l''echeance, l''organisation retombe sur Free');
  perform pg_temp.ok(app.org_has_feature(v_org, 'missions'),
    'Le coeur terrain plafonne reste disponible en Gratuit');
  perform pg_temp.ok(not app.org_has_feature(v_org, 'teams'),
    'Le pilotage des equipes reste reserve aux offres payantes');

  -- ---- on ne reprend pas un abonnement deja eteint
  perform pg_temp.refuses(
    format($sql$ select public.resume_organization_subscription(%L) $sql$, v_org),
    'Reprendre apres l''echeance est refuse');

  -- ---- se raviser AVANT l'echeance, en revanche, doit marcher
  update public.subscriptions
     set current_period_end = now() + interval '10 days',
         trial_ends_at      = now() + interval '10 days'
   where organization_id = v_org;

  perform public.resume_organization_subscription(v_org);
  perform pg_temp.ok(
    not (select cancel_at_period_end from public.subscriptions where organization_id = v_org),
    'Le drapeau retombe quand on se ravise');
end
$$;

-- ---- qui n'a pas le droit de facturer n'a pas le droit de resilier
do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-resil';

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org, pg_temp.uid('salarie'), 'technician', 'active');

  perform pg_temp.login('salarie');
  perform pg_temp.refuses(
    format($sql$ select public.cancel_organization_subscription(%L) $sql$, v_org),
    'Un technicien ne peut pas resilier');

  -- Et un tiers complet ne peut rien non plus : le cloisonnement d'abord.
  perform pg_temp.login('patron_b');
  perform pg_temp.refuses(
    format($sql$ select public.cancel_organization_subscription(%L) $sql$, v_org),
    'Le patron d''une autre entreprise ne peut pas resilier celle-ci');
end
$$;

-- ---- Stripe garde la main sur ce qu'il encaisse
do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-resil';

  update public.subscriptions
     set provider = 'stripe', provider_subscription_id = 'sub_test_resil'
   where organization_id = v_org;

  perform pg_temp.login('patron_a');
  perform pg_temp.refuses(
    format($sql$ select public.cancel_organization_subscription(%L) $sql$, v_org),
    'Un abonnement Stripe ne se resilie pas hors du portail');
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 9 — Ce que Gratuit laisse, apres la resiliation ==='; end $$;
-- =============================================================================
--
-- Une resiliation qui laisserait l'entreprise devant une application morte ne
-- serait pas une sortie, mais une porte muree. On eprouve donc ce qui RESTE :
-- les outils, la lisibilite de la facturation, et surtout le chemin du retour.
-- Sans ce dernier, une organisation qui se ravise apres l'echeance serait
-- enfermee dehors.

-- On repart d'un etat propre : plus de Stripe, et l'echeance derriere nous.
update public.subscriptions
   set provider = null, provider_subscription_id = null,
       cancel_at_period_end = true,
       current_period_end = now() - interval '1 day',
       trial_ends_at = now() - interval '1 day'
 where organization_id in (select id from public.organizations where slug = 'essai-resil');

-- Une mission ecrite AVANT l'echeance : elle doit survivre a la bascule.
insert into public.missions (organization_id, created_by, title)
select id, pg_temp.uid('patron_a'), 'Mission anterieure a la resiliation'
from public.organizations where slug = 'essai-resil';

do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-resil';

  perform pg_temp.ok(app.org_effective_plan(v_org) = 'free',
    'L''organisation est bien retombee sur Gratuit');

  -- CE QUI RESTE. Gratuit n'est pas un mur : il conserve les outils et un
  -- coeur terrain plafonne.
  perform pg_temp.ok(app.org_has_feature(v_org, 'catalog_access'),
    'Gratuit conserve l''acces au catalogue d''outils');
  perform pg_temp.ok(app.org_feature_limit(v_org, 'favorites') = 3,
    'Gratuit conserve trois favoris');
  perform pg_temp.ok(app.org_feature_limit(v_org, 'calculation_history') = 10,
    'Gratuit conserve dix calculs d''historique');

  perform pg_temp.ok(app.org_has_feature(v_org, 'missions'),
    'Gratuit conserve les missions dans la limite de son quota');

  -- CE QUI SE FERME, et c'est voulu : le pilotage avance reste payant.
  perform pg_temp.ok(not app.org_has_feature(v_org, 'teams'),
    'La gestion des equipes est bien fermee');

  -- RIEN N'EST SUPPRIME : c'est ce que promet la fenetre de confirmation, et
  -- une promesse d'interface qui n'est pas verifiee en base n'engage personne.
  perform pg_temp.ok(
    (select count(*) from public.missions m where m.organization_id = v_org) = 1,
    'La mission ecrite avant l''echeance est toujours en base');

  -- LE CHEMIN DU RETOUR. La synthese alimente l'ecran de facturation ET la
  -- fonction de paiement : si elle ne repondait pas, l'organisation ne pourrait
  -- plus se reabonner du tout.
  perform pg_temp.ok(
    (select count(*) from public.plans p where p.code = app.org_effective_plan(v_org)) = 1,
    'La synthese de facturation trouve encore une formule a decrire');
  perform pg_temp.ok(app.org_monthly_amount_cents(v_org) = 0,
    'Et n''annonce aucun montant du');
  perform pg_temp.ok(app.org_included_seats(v_org) = 1,
    'Gratuit annonce son unique siege, et non zero');
end
$$;

-- La synthese repond-elle a un VRAI appelant, et pas seulement a postgres ?
-- C'est la question qui a deja piege une fois : la RPC est `security invoker`.
select pg_temp.login('patron_a');
set local role authenticated;

do $$
declare v_org uuid; v_plan text; v_total integer;
begin
  select id into v_org from public.organizations where slug = 'essai-resil';

  select plan_code, total_cents into v_plan, v_total
  from public.organization_billing_summary(v_org);

  perform pg_temp.ok(v_plan = 'free',
    'Le proprietaire lit sa formule Gratuite depuis l''ecran de facturation');
  perform pg_temp.ok(v_total = 0, 'Aucun montant ne lui est reclame');

  -- La mission existante reste visible dans le coeur terrain de Gratuit.
  perform pg_temp.ok(
    (select count(*) from public.missions m where m.organization_id = v_org) = 1,
    'La mission reste visible apres le retour a Gratuit');
end
$$;
reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 10 — L essai porte par Stripe ==='; end $$;
-- =============================================================================
--
-- Souscrire pendant l'essai ne ferme plus l'essai : la session de paiement
-- reprend le reliquat, et l'abonnement Stripe naît en `trialing`. Deux essais
-- coexistent donc dans la base, de meme statut mais d'issue opposee — l'un
-- s'eteint sur Gratuit, l'autre se transforme en prelevement. On eprouve que la
-- base sait les distinguer, et qu'elle traite le second comme un abonnement.

select pg_temp.login('patron_a');
set local role authenticated;
insert into public.organizations (slug, name, created_by, industry)
values ('essai-stripe', 'Essai Paye', pg_temp.uid('patron_a'), 'hvac');
reset role;

-- Depuis 20260830100000, il n'existe plus d'essai d'origine sans carte : le
-- webhook Stripe crée directement l'abonnement d'essai qui porte les droits.
insert into public.subscriptions
  (organization_id, plan_code, status, current_period_start,
   current_period_end, trial_ends_at, provider, provider_subscription_id)
select id, 'pro', 'trialing', now(), now() + interval '14 days',
       now() + interval '14 days', 'stripe', 'sub_essai_paye'
from public.organizations
where slug = 'essai-stripe';

do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-stripe';

  -- L'ACCES EST OUVERT PENDANT L'ESSAI PAYE, comme pendant l'autre.
  perform pg_temp.ok(app.org_effective_plan(v_org) = 'pro',
    'Un essai porte par Stripe donne les droits de sa formule');
  perform pg_temp.ok(app.org_has_feature(v_org, 'missions'),
    'Les modules professionnels sont ouverts des l''essai');

  -- ET LA BASE SAIT QU'UNE CARTE REPOND. C'est ce signal qui permet a
  -- l'interface d'annoncer un prelevement plutot qu'un retour sur Gratuit.
  perform pg_temp.ok(app.org_is_billed(v_org),
    'La synthese signale que l''essai est adosse a un moyen de paiement');
  perform pg_temp.ok(app.org_subscription_status(v_org) = 'trialing',
    'Le statut reste bien un essai');

  -- LA SORTIE PASSE PAR STRIPE. Resilier ici ecrirait une decision que la
  -- prochaine notification ecraserait.
  perform pg_temp.login('patron_a');
  perform pg_temp.refuses(
    format($sql$ select public.cancel_organization_subscription(%L) $sql$, v_org),
    'Un essai paye ne se resilie pas hors du portail');
end
$$;

-- Contre-exemple : un abonnement géré manuellement, sans identifiant Stripe,
-- reste résiliable ici. Ce n'est pas un essai automatique à la création : ce
-- modèle a été supprimé par 20260830100000.
select pg_temp.login('patron_a');
set local role authenticated;
insert into public.organizations (slug, name, created_by, industry)
values ('abonnement-manuel', 'Abonnement Manuel', pg_temp.uid('patron_a'), 'hvac');
reset role;

insert into public.subscriptions
  (organization_id, plan_code, status, current_period_start, current_period_end)
select id, 'starter', 'active', now(), now() + interval '30 days'
from public.organizations
where slug = 'abonnement-manuel';

do $$
declare v_org uuid;
begin
  select id into v_org from public.organizations where slug = 'abonnement-manuel';

  perform pg_temp.ok(not app.org_is_billed(v_org),
    'Un abonnement manuel n''est pas adosse a Stripe');

  perform pg_temp.login('patron_a');
  perform public.cancel_organization_subscription(v_org);
  perform pg_temp.ok(
    (select cancel_at_period_end from public.subscriptions where organization_id = v_org),
    'Il se resilie sans passer par le portail Stripe');
end
$$;

-- =============================================================================
do $$
begin
  raise notice '';
  raise notice '=============================================';
  raise notice ' TOUS LES TESTS PASSENT';
  raise notice '=============================================';
end
$$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;
