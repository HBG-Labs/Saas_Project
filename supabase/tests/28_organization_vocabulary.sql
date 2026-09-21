-- =============================================================================
-- 28 — Le dictionnaire d'organisation pour la transcription
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. qui gère le Workspace ajoute, corrige, retire ; un technicien lit mais
--      n'écrit pas ; un même terme n'entre qu'une fois, quelle que soit la
--      casse ; un numéro seul ou une phrase sont refusés ; le plafond tient ;
--   2. une entreprise ne voit ni ne touche le dictionnaire d'une autre ;
--   3. la suggestion ne propose que des noms de SES données (clients, sites,
--      matériel, membres, communes), marque ceux déjà présents, et ne montre
--      rien d'une autre entreprise — ni à un non-membre.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000280001'),
  ('chef',     '00000000-0000-4000-8000-000000280002'),
  ('tech_a',   '00000000-0000-4000-8000-000000280003'),
  ('patron_b', '00000000-0000-4000-8000-000000280004');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, autre_org_id uuid, terme uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('vocab-a', 'Vocab A', 'patron', 'pro'),
        pg_temp.organisation_abonnee('vocab-b', 'Vocab B', 'patron_b', 'pro'));
select pg_temp.ajouter_membre(org_id, 'chef', 'team_leader') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;

-- Les données de A et de B : un client, un site, un matériel chacune.
do $$ declare a uuid; b uuid; ca uuid; cb uuid; begin
  select org_id, autre_org_id into a, b from t_ctx;
  insert into public.customers (organization_id, name, city, created_by) values (a, 'Caraïbe Télécom', 'Le Lamentin', pg_temp.uid('patron')) returning id into ca;
  insert into public.sites (organization_id, customer_id, name, city) values (a, ca, 'Agence du Lorrain', 'Le Lorrain');
  insert into public.equipment (organization_id, name) values (a, 'Réflectomètre EXFO');
  insert into public.customers (organization_id, name, city, created_by) values (b, 'Client Secret B', 'Cayenne', pg_temp.uid('patron_b')) returning id into cb;
  insert into public.equipment (organization_id, name) values (b, 'Machine B');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — ecrire ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.refuses(
  format($q$insert into public.organization_vocabulary (organization_id, term, type) values (%L, 'PTO', 'technique')$q$, (select org_id from t_ctx)),
  'un technicien n''ecrit pas dans le dictionnaire');
reset role;

select pg_temp.login('chef'); set local role authenticated;
do $$ declare t uuid; begin
  insert into public.organization_vocabulary (organization_id, term, type)
  select org_id, '  Karim Benali ', 'personne' from t_ctx returning id into t;
  update t_ctx set terme = t;
  perform pg_temp.ok((select term from public.organization_vocabulary where id = t) = 'Karim Benali'
    and (select created_by from public.organization_vocabulary where id = t) = pg_temp.uid('chef'),
    'le chef ajoute ; le terme est nettoye et signe');
  perform pg_temp.refuses(
    format($q$insert into public.organization_vocabulary (organization_id, term) values (%L, 'karim benali')$q$, (select org_id from t_ctx)),
    'le meme terme, autre casse, est refuse');
  perform pg_temp.refuses(
    format($q$insert into public.organization_vocabulary (organization_id, term) values (%L, '0696123456')$q$, (select org_id from t_ctx)),
    'un numero seul est refuse (minimisation)');
  perform pg_temp.refuses(
    format($q$insert into public.organization_vocabulary (organization_id, term) values (%L, E'une\nphrase')$q$, (select org_id from t_ctx)),
    'un retour a la ligne est refuse');
  perform pg_temp.refuses(
    format($q$insert into public.organization_vocabulary (organization_id, term, type) values (%L, 'X', 'inconnu')$q$, (select org_id from t_ctx)),
    'un type inconnu est refuse');
  update public.organization_vocabulary set type = 'technique', term = 'K. Benali' where id = t;
  perform pg_temp.ok((select term || '/' || type from public.organization_vocabulary where id = t) = 'K. Benali/technique', 'le chef corrige');
end $$;
reset role;

-- Le plafond : 500 termes, pas un de plus.
do $$ begin
  insert into public.organization_vocabulary (organization_id, term)
  select org_id, 'terme-' || g from t_ctx, generate_series(1, 499) g;
  perform pg_temp.refuses(
    format($q$insert into public.organization_vocabulary (organization_id, term) values (%L, 'de-trop')$q$, (select org_id from t_ctx)),
    'le 501e terme est refuse');
  delete from public.organization_vocabulary where term like 'terme-%';
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — isolation ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.ok((select count(*) from public.organization_vocabulary) = 1, 'un technicien lit le dictionnaire de son entreprise');
reset role;
select pg_temp.login('patron_b'); set local role authenticated;
select pg_temp.ok((select count(*) from public.organization_vocabulary) = 0, 'l''entreprise B ne voit pas le dictionnaire de A');
select pg_temp.refuses(
  format($q$insert into public.organization_vocabulary (organization_id, term) values (%L, 'Intrusion')$q$, (select org_id from t_ctx)),
  'B n''ecrit pas chez A');
do $$ begin
  delete from public.organization_vocabulary where id = (select terme from t_ctx);
end $$;
reset role;
select pg_temp.ok((select count(*) from public.organization_vocabulary where id = (select terme from t_ctx)) = 1,
  'B ne supprime pas chez A (RLS, en silence)');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — la suggestion ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare n int; begin
  perform pg_temp.ok(
    (select count(*) from public.suggest_organization_vocabulary((select org_id from t_ctx)) s where s.term = 'Caraïbe Télécom' and s.type = 'client') = 1
    and (select count(*) from public.suggest_organization_vocabulary((select org_id from t_ctx)) s where s.term = 'Agence du Lorrain' and s.type = 'site') = 1
    and (select count(*) from public.suggest_organization_vocabulary((select org_id from t_ctx)) s where s.term = 'Réflectomètre EXFO' and s.type = 'materiel') = 1
    and (select count(*) from public.suggest_organization_vocabulary((select org_id from t_ctx)) s where s.term = 'Le Lorrain' and s.type = 'lieu') = 1
    and (select count(*) from public.suggest_organization_vocabulary((select org_id from t_ctx)) s where s.term = 'chef' and s.type = 'personne') = 1,
    'la suggestion propose client, site, materiel, commune et membre de A');
  select count(*) into n from public.suggest_organization_vocabulary((select org_id from t_ctx)) s
  where s.term in ('Client Secret B', 'Machine B', 'Cayenne');
  perform pg_temp.ok(n = 0, 'rien des donnees de B');
  perform pg_temp.ok((select bool_and(not s.already_present) from public.suggest_organization_vocabulary((select org_id from t_ctx)) s),
    'rien n''est marque present : le dictionnaire ne contient que K. Benali');

  insert into public.organization_vocabulary (organization_id, term, type, source) select org_id, 'Caraïbe Télécom', 'client', 'auto' from t_ctx;
  perform pg_temp.ok((select s.already_present from public.suggest_organization_vocabulary((select org_id from t_ctx)) s where s.term = 'Caraïbe Télécom'),
    'un terme accepte est marque present');
  perform pg_temp.ok((select count(*) from public.suggest_organization_vocabulary((select autre_org_id from t_ctx))) = 0,
    'demander les suggestions d''une autre entreprise ne rend rien');
end $$;
reset role;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;
