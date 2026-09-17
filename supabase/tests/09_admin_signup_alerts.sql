-- =============================================================================
-- SUITE DE TESTS — alerte administrateur à l'inscription
-- =============================================================================
-- Rejoue les garanties posées par `20260915090000_admin_signup_alerts.sql` :
--
--   une inscription réelle sur auth.users → EXACTEMENT une ligne en file
--   d'attente, jamais recréée par ce qui suit une inscription (profil,
--   entreprise, appartenance), jamais posée pour un compte de démonstration ou
--   un collaborateur ajouté par un client existant.
--
-- Complète les tests Deno (`supabase/functions/_shared/admin-signup-alerts.test.ts`,
-- `supabase/functions/notify-admin-signup-worker/handler.test.ts`), qui
-- couvrent le contenu du courriel/push et l'envoi lui-même sans base de
-- données. Ici, seul le TRIGGER et le TIRAGE ATOMIQUE sont en jeu.
--
--   npm run test:sql
--
-- Le script se termine par `rollback` : aucune ligne ne survit, y compris dans
-- `auth.users`.
-- =============================================================================

begin;

set local search_path = pg_temp, public;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'ECHEC : % (condition %)', p_label, coalesce(p_condition::text, 'NULL')
      using errcode = 'assert_failure';
  end if;
  raise notice '  OK  %', p_label;
end;
$$;

-- -----------------------------------------------------------------------------
-- Comptes utilisateurs — même patron que 01_multitenant_scenario.sql
-- -----------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);
insert into t_ids (k, v) values
  ('organique',     '00000000-0000-4000-8000-0000000d0001'),
  ('second',        '00000000-0000-4000-8000-0000000d0002'),
  ('demo',          '00000000-0000-4000-8000-0000000d0003'),
  ('collaborateur', '00000000-0000-4000-8000-0000000d0004');

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', pg_temp.uid('organique'), 'authenticated', 'authenticated',
   'organique@exemple.fr', '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
   now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', pg_temp.uid('second'), 'authenticated', 'authenticated',
   'second@exemple.fr', '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
   now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  -- Compte de démonstration : jamais une inscription réelle.
  ('00000000-0000-0000-0000-000000000000', pg_temp.uid('demo'), 'authenticated', 'authenticated',
   'quelquun@rezo360.test', '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
   now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  -- Collaborateur ajouté par un client existant : marqué comme tel, comme le
  -- font réellement `accept-invitation-signup` et `create-member`.
  ('00000000-0000-0000-0000-000000000000', pg_temp.uid('collaborateur'), 'authenticated', 'authenticated',
   'collaborateur@exemple.fr', '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"rezo360_member_added_by_admin": true}'::jsonb, now(), now());

do $$ begin raise notice '=== PARTIE 1 — le trigger d''inscription ==='; end $$;

-- -----------------------------------------------------------------------------
-- 1.1 — Une inscription réelle met en file exactement une alerte
-- -----------------------------------------------------------------------------
do $$ begin
perform pg_temp.ok(
  (select count(*) from public.admin_signup_alerts where user_id = pg_temp.uid('organique')) = 1,
  'l''inscription organique cree une ligne en file');
end $$;

do $$ begin
perform pg_temp.ok(
  (select email_status = 'pending' and push_status = 'pending' and email = 'organique@exemple.fr'
   from public.admin_signup_alerts where user_id = pg_temp.uid('organique')),
  'la ligne part en attente, avec l''adresse capturee a l''inscription');
end $$;

-- -----------------------------------------------------------------------------
-- 1.2 — Un compte de démonstration ne déclenche rien
-- -----------------------------------------------------------------------------
do $$ begin
perform pg_temp.ok(
  not exists (select 1 from public.admin_signup_alerts where user_id = pg_temp.uid('demo')),
  'un compte @rezo360.test ne cree aucune alerte');
end $$;

-- -----------------------------------------------------------------------------
-- 1.3 — Un collaborateur ajouté par un client existant ne déclenche rien
-- -----------------------------------------------------------------------------
do $$ begin
perform pg_temp.ok(
  not exists (select 1 from public.admin_signup_alerts where user_id = pg_temp.uid('collaborateur')),
  'un compte marque rezo360_member_added_by_admin ne cree aucune alerte');
end $$;

-- -----------------------------------------------------------------------------
-- 1.4 — Une deuxième inscription réelle produit une alerte INDÉPENDANTE
-- -----------------------------------------------------------------------------
-- Limité aux deux comptes de CE test, jamais un COUNT(*) sans filtre sur une
-- table de production partagée : une vraie inscription concurrente (hors de
-- cette transaction, donc jamais annulée par son `rollback`) ferait échouer
-- une assertion sur le total absolu sans que rien ici ne soit en cause.
do $$ begin
perform pg_temp.ok(
  (select count(*) from public.admin_signup_alerts
   where user_id in (pg_temp.uid('organique'), pg_temp.uid('second'))) = 2,
  'deux inscriptions reelles (et deux comptes exclus) -> exactement deux lignes pour ces comptes');
end $$;

do $$ begin raise notice '=== PARTIE 2 — ce qui ne doit JAMAIS recreer ou dupliquer une alerte ==='; end $$;

-- -----------------------------------------------------------------------------
-- 2.1 — Modifier le profil de l'inscrit ne touche pas la file
-- -----------------------------------------------------------------------------
update public.profiles set display_name = 'Nom modifie apres inscription'
where id = pg_temp.uid('organique');

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.admin_signup_alerts where user_id = pg_temp.uid('organique')) = 1,
  'modifier le profil ne cree pas de doublon et ne supprime rien');
end $$;

-- -----------------------------------------------------------------------------
-- 2.2 — Créer une entreprise et y rattacher l'inscrit ne touche pas la file
-- -----------------------------------------------------------------------------
-- `organizations_create_owner` rattache déjà automatiquement `created_by` comme
-- propriétaire : pas besoin (et pas question, sous peine de doublon rejeté par
-- le quota de la formule Gratuite) d'insérer nous-mêmes dans organization_members.
insert into public.organizations (slug, name, created_by)
values ('signup-alerts-test', 'Entreprise de test', pg_temp.uid('organique'));

do $$ begin
perform pg_temp.ok(
  (select count(*) from public.admin_signup_alerts
   where user_id in (pg_temp.uid('organique'), pg_temp.uid('second'))) = 2,
  'creer une entreprise et y rattacher l''inscrit ne cree ni doublon ni ligne supplementaire');
end $$;

-- -----------------------------------------------------------------------------
-- 2.3 — Aucun trigger n'existe ailleurs dans le cycle de connexion
-- -----------------------------------------------------------------------------
-- Une reconnexion ou un rafraîchissement de jeton n'écrivent JAMAIS dans
-- `auth.users` (GoTrue les tient dans `auth.sessions` / `auth.refresh_tokens`) :
-- structurellement, rien ne peut y réveiller ce trigger. On vérifie l'inverse —
-- qu'aucun trigger de ce nom n'existe sur ces tables, au cas où une évolution
-- future le poserait par erreur au mauvais endroit.
do $$ begin
perform pg_temp.ok(
  not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'on_auth_user_created_signup_alert'
      and not (n.nspname = 'auth' and c.relname = 'users')
  ),
  'le trigger d''alerte n''existe que sur auth.users, nulle part ailleurs');
end $$;

do $$ begin raise notice '=== PARTIE 3 — le tirage atomique du worker ==='; end $$;

-- -----------------------------------------------------------------------------
-- 3.1 — Une ligne due est tirée
-- -----------------------------------------------------------------------------
do $$ begin
perform pg_temp.ok(
  pg_temp.uid('organique') in (select user_id from public.claim_admin_signup_alerts(10)),
  'une alerte due est renvoyee par le tirage');
end $$;

-- Le tirage pose le verrou : reclamer IMMEDIATEMENT ne la renvoie plus.
do $$ begin
perform pg_temp.ok(
  pg_temp.uid('organique') not in (select user_id from public.claim_admin_signup_alerts(10)),
  'une ligne fraichement verrouillee n''est pas retiree tout de suite apres');
end $$;

-- -----------------------------------------------------------------------------
-- 3.2 — Une ligne planifiée dans le futur n'est pas tirée
-- -----------------------------------------------------------------------------
update public.admin_signup_alerts
   set next_attempt_at = now() + interval '1 hour', locked_at = null
 where user_id = pg_temp.uid('second');

do $$ begin
perform pg_temp.ok(
  pg_temp.uid('second') not in (select user_id from public.claim_admin_signup_alerts(10)),
  'une reprise planifiee dans le futur n''est pas tiree avant son heure');
end $$;

update public.admin_signup_alerts
   set next_attempt_at = now() - interval '1 minute'
 where user_id = pg_temp.uid('second');

do $$ begin
perform pg_temp.ok(
  pg_temp.uid('second') in (select user_id from public.claim_admin_signup_alerts(10)),
  'la meme ligne, une fois son heure passee, est tiree normalement');
end $$;

-- -----------------------------------------------------------------------------
-- 3.3 — Une ligne dont les DEUX canaux sont acquis n'est plus jamais tirée
-- -----------------------------------------------------------------------------
update public.admin_signup_alerts
   set email_status = 'sent', push_status = 'sent', locked_at = null, next_attempt_at = now() - interval '1 minute'
 where user_id = pg_temp.uid('second');

do $$ begin
perform pg_temp.ok(
  pg_temp.uid('second') not in (select user_id from public.claim_admin_signup_alerts(10)),
  'une ligne entierement envoyee (les deux canaux) n''est plus jamais retiree');
end $$;

-- -----------------------------------------------------------------------------
-- 3.4 — Un verrou périmé (mort du worker précédent) est récupérable
-- -----------------------------------------------------------------------------
update public.admin_signup_alerts
   set email_status = 'pending', push_status = 'pending',
       locked_at = now() - interval '10 minutes', next_attempt_at = now() - interval '1 minute'
 where user_id = pg_temp.uid('organique');

do $$ begin
perform pg_temp.ok(
  pg_temp.uid('organique') in (select user_id from public.claim_admin_signup_alerts(10)),
  'un verrou vieux de plus de 5 minutes est considere libre, pas occupe');
end $$;

update public.admin_signup_alerts
   set locked_at = now()
 where user_id = pg_temp.uid('organique');

do $$ begin
perform pg_temp.ok(
  pg_temp.uid('organique') not in (select user_id from public.claim_admin_signup_alerts(10)),
  'un verrou recent (moins de 5 minutes) n''est pas recupere');
end $$;

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
