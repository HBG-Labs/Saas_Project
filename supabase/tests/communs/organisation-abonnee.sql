-- =============================================================================
-- Socle commun des suites SQL — inclus par `-- @inclure communs/organisation-abonnee.sql`
-- =============================================================================
--
-- POURQUOI CE FICHIER EXISTE
--
-- Chaque suite recopiait quatre-vingts lignes de fixture : les comptes, les
-- aides d'assertion, la création d'organisation, l'abonnement, les membres.
-- Deux suites de suite (18 puis 19) ont échoué AVANT leur première assertion
-- pour une ligne oubliée dans cette copie — l'abonnement, puis un `grant`. Un
-- test qui ne démarre pas rassure autant qu'un test vert : il ne dit rien.
--
-- Ce socle est inséré tel quel par `scripts/run-sql-tests.mjs` à l'endroit de
-- la directive. La suite reste un fichier autonome à la lecture ; seul le
-- lanceur assemble.
--
-- CE QU'IL FOURNIT
--
--   t_ids                                  la table des comptes, VIDE : la suite y insère ses acteurs
--   pg_temp.uid(cle)                       l'identifiant d'un acteur
--   pg_temp.login(cle)                     poser le JWT de cet acteur (à combiner avec `set local role authenticated`)
--   pg_temp.ok(condition, libelle)         assertion
--   pg_temp.refuses(sql, libelle)          assertion qu'une instruction est REFUSÉE
--   pg_temp.creer_comptes()                les lignes auth.users de tous les acteurs de t_ids
--   pg_temp.organisation_abonnee(slug, nom, cle_proprietaire, formule)
--                                          une organisation créée PAR son propriétaire (le trigger
--                                          `organizations_create_owner` le rattache), abonnée, renseignée
--                                          (raison sociale, TVA, adresse) — ce que la facturation exige
--   pg_temp.ajouter_membre(org, cle, role) un membre actif
--
-- CE QU'IL NE FAIT PAS
--
-- Il ne choisit ni les acteurs, ni les organisations, ni les formules : c'est
-- la suite qui décide, explicitement. Un socle qui déciderait à sa place
-- rendrait chaque suite dépendante d'un contexte qu'elle ne montre pas.
-- =============================================================================

create temporary table t_ids (k text primary key, v uuid);
grant select on t_ids to authenticated;

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

create function pg_temp.login(p_key text) returns void
language plpgsql as $$
begin
  if pg_temp.uid(p_key) is null then
    raise exception 'FIXTURE : acteur « % » inconnu de t_ids', p_key;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(p_key), 'email', p_key || '@test.local', 'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'ECHEC : % (condition %)', p_label, coalesce(p_condition::text, 'NULL') using errcode = 'assert_failure';
  end if;
  raise notice '  OK  %', p_label;
end;
$$;

create function pg_temp.refuses(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ECHEC : % (l''instruction a ete ACCEPTEE)', p_label using errcode = 'assert_failure';
exception
  when assert_failure then raise;
  when others then raise notice '  OK  % (refuse : %)', p_label, left(sqlerrm, 90);
end;
$$;

create function pg_temp.creer_comptes() returns void
language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', k || '@test.local',
         '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte', now(),
         '{"provider":"email","providers":["email"]}'::jsonb, json_build_object('display_name', k)::jsonb, now(), now()
  from pg_temp.t_ids;
end;
$$;

-- Créée PAR le propriétaire, sous le rôle authenticated : c'est ainsi que le
-- trigger `organizations_create_owner` le rattache, comme en production.
-- L'abonnement vient ensuite, posé par le rôle de la migration : sans lui,
-- `app.can_use_pro_module` refuse tout et `app.enforce_member_quota` limite
-- une organisation Gratuite à un seul membre.
create function pg_temp.organisation_abonnee(
  p_slug text, p_nom text, p_cle_proprietaire text, p_formule text default 'pro'
) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  perform pg_temp.login(p_cle_proprietaire);
  set local role authenticated;
  -- Sans `returning` : la politique de lecture exige d'être membre, et le
  -- trigger qui rattache le propriétaire est un trigger AFTER — `returning`
  -- serait évalué avant lui, et refusé. On relit par le slug, hors RLS.
  insert into public.organizations (slug, name, created_by, industry)
  values (p_slug, p_nom, pg_temp.uid(p_cle_proprietaire), 'fiber_telecom');
  reset role;
  select id into strict v_id from public.organizations where slug = p_slug;

  delete from public.subscriptions where organization_id = v_id;
  insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
  values (v_id, p_formule, 'active'::public.subscription_status, now() + interval '30 days');

  -- Ce que la facturation exige d'un émetteur : sans ces champs, une facture
  -- ne peut pas être émise, et une suite qui en a besoin le découvrirait
  -- trente lignes plus loin.
  update public.organizations set legal_form = 'SARL', share_capital_cents = 100000,
    registration_number = '12345678900012', vat_regime = 'reel_normal', vat_number = 'FR12345678901',
    address_line1 = '1 rue du Test', postal_code = '97200', city = 'Fort-de-France', country = 'FR'
  where id = v_id;

  return v_id;
end;
$$;

create function pg_temp.ajouter_membre(p_org uuid, p_cle text, p_role text) returns void
language plpgsql as $$
begin
  insert into public.organization_members (organization_id, user_id, role, status)
  values (p_org, pg_temp.uid(p_cle), p_role::public.org_role, 'active'::public.member_status);
end;
$$;
