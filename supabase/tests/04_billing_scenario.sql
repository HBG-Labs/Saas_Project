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
