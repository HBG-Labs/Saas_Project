-- =============================================================================
-- 24 — Workspace v2 : espace personnel, récentes, favoris, modèles, recherche, IA
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. un espace personnel se crée à la demande, une fois, et n'est visible que
--      de son propriétaire — pas même de qui gère le Workspace ; pages, tâches
--      et révisions suivent ; au départ du membre il est archivé, pas supprimé ;
--   2. les récentes gardent la dernière ouverture, bornée à cinquante ; on ne
--      « touche » pas une page qu'on ne voit pas ;
--   3. un favori porte sur une page visible, et n'appartient qu'à soi ;
--   4. les modèles système sont lus par tous, ceux d'une entreprise par elle
--      seule ; une page naît d'un modèle avec son contenu et son icône ;
--   5. la recherche trouve dans le titre et dans le corps, en français, et ne
--      remonte jamais une page privée d'autrui ;
--   6. l'IA du Workspace : un technicien ouvre une conversation attachée à une
--      page (ai.workspace), pas une conversation générale (ai.use) ; la
--      réservation de quota suit la même règle.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000240001'),
  ('chef',     '00000000-0000-4000-8000-000000240002'),
  ('tech_a',   '00000000-0000-4000-8000-000000240003'),
  ('tech_b',   '00000000-0000-4000-8000-000000240004'),
  ('patron_b', '00000000-0000-4000-8000-000000240005');
select pg_temp.creer_comptes();

create temporary table t_ctx (
  org_id uuid, autre_org_id uuid, membre_a uuid, membre_b uuid,
  partage uuid, perso_a uuid, page_partagee uuid, page_privee uuid, page_modele uuid
);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('wsv2-a', 'Workspace v2 A', 'patron', 'business'),
        pg_temp.organisation_abonnee('wsv2-b', 'Workspace v2 B', 'patron_b', 'business'));

select pg_temp.ajouter_membre(org_id, 'chef', 'team_leader') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_b', 'technician') from t_ctx;
update t_ctx set
  membre_a = (select id from public.organization_members where user_id = pg_temp.uid('tech_a')),
  membre_b = (select id from public.organization_members where user_id = pg_temp.uid('tech_b'));

-- Un espace partagé et une page dedans, par le chef.
select pg_temp.login('chef'); set local role authenticated;
do $$ declare s uuid; p uuid; begin
  insert into public.workspace_spaces (organization_id, name) select org_id, 'Équipe' from t_ctx returning id into s;
  insert into public.workspace_pages (space_id, title, content)
  values (s, 'Procédure de mise en service fibre',
          '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Vérifier la continuité optique avant le raccordement du boîtier."}]}]}')
  returning id into p;
  update t_ctx set partage = s, page_partagee = p;
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — l''espace personnel ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare s public.workspace_spaces; s2 public.workspace_spaces; p uuid; begin
  perform pg_temp.refuses(
    format($q$insert into public.workspace_spaces (organization_id, name) values (%L, 'Perso a la main')$q$, (select org_id from t_ctx)),
    'un technicien ne cree pas d''espace a la main');

  s := public.ensure_personal_workspace_space((select org_id from t_ctx));
  perform pg_temp.ok(s.owner_member_id = (select membre_a from t_ctx) and s.name = 'Mes pages', 'l''espace personnel est cree a la demande');
  s2 := public.ensure_personal_workspace_space((select org_id from t_ctx));
  perform pg_temp.ok(s2.id = s.id, 'une seconde demande rend le meme espace');
  update t_ctx set perso_a = s.id;

  insert into public.workspace_pages (space_id, title, content)
  values (s.id, 'Mes notes de terrain',
          '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Le client de la rue des Flamboyants veut un rappel jeudi."}]}]}')
  returning id into p;
  update t_ctx set page_privee = p;
  insert into public.workspace_tasks (space_id, title) values (s.id, 'Rappeler jeudi');

  update public.workspace_spaces set name = 'Mon carnet' where id = s.id;
  perform pg_temp.ok((select name from public.workspace_spaces where id = s.id) = 'Mon carnet', 'le proprietaire renomme son espace');
  perform pg_temp.ok((select count(*) from public.workspace_spaces) = 2, 'tech_a voit l''espace partage et le sien');
end $$;
reset role;

-- Le chef gère le Workspace ; il ne voit pas pour autant les pages de tech_a.
select pg_temp.login('chef'); set local role authenticated;
select pg_temp.ok((select count(*) from public.workspace_spaces where owner_member_id is not null) = 0
  and (select count(*) from public.workspace_pages where id = (select page_privee from t_ctx)) = 0
  and (select count(*) from public.workspace_tasks where space_id = (select perso_a from t_ctx)) = 0,
  'qui gere le Workspace ne voit ni l''espace personnel d''un autre, ni ses pages, ni ses taches');
select pg_temp.refuses(
  format($q$insert into public.workspace_pages (space_id, title) values (%L, 'Intrusion')$q$, (select perso_a from t_ctx)),
  'ecrire dans l''espace personnel d''un autre est refuse');
do $$ begin
  update public.workspace_spaces set name = 'Pirate' where id = (select perso_a from t_ctx);
end $$;
reset role;
select pg_temp.ok((select name from public.workspace_spaces where id = (select perso_a from t_ctx)) = 'Mon carnet',
  'la RLS a ignore le renommage par le chef');

-- tech_b, même rôle que tech_a, ne voit rien non plus.
select pg_temp.login('tech_b'); set local role authenticated;
select pg_temp.ok((select count(*) from public.workspace_pages where space_id = (select perso_a from t_ctx)) = 0,
  'un collegue ne voit pas les pages privees d''un autre');
reset role;

-- Une révision de la page privée reste privée.
select pg_temp.login('tech_a'); set local role authenticated;
update public.workspace_pages set title = 'Mes notes de terrain (v2)' where id = (select page_privee from t_ctx);
select pg_temp.ok((select count(*) from public.workspace_page_revisions where page_id = (select page_privee from t_ctx)) = 1,
  'tech_a voit la revision de sa page');
update public.workspace_pages
set font_family = 'serif', small_text = true, full_width = true, locked = true
where id = (select page_privee from t_ctx);
select pg_temp.ok((
  select font_family = 'serif' and small_text and full_width and locked
  from public.workspace_pages
  where id = (select page_privee from t_ctx)
), 'les reglages de presentation sont modifiables et persistent');
reset role;
select pg_temp.login('chef'); set local role authenticated;
select pg_temp.ok((select count(*) from public.workspace_page_revisions where page_id = (select page_privee from t_ctx)) = 0,
  'le chef ne voit pas la revision d''une page privee');
reset role;

-- Une page privée supprimée : ses révisions restent, lisibles de son
-- propriétaire seul (correctif 20261003091500).
select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare p uuid; begin
  insert into public.workspace_pages (space_id, title) select perso_a, 'Brouillon a jeter' from t_ctx returning id into p;
  update public.workspace_pages set title = 'Brouillon a jeter (v2)' where id = p;
  delete from public.workspace_pages where id = p;
  perform pg_temp.ok((select count(*) from public.workspace_page_revisions where page_id = p) = 2,
    'les revisions d''une page privee supprimee restent lisibles de son proprietaire');
  perform pg_temp.ok((select bool_and(space_id = (select perso_a from t_ctx)) from public.workspace_page_revisions where page_id = p),
    'chaque revision porte son espace');
  update t_ctx set page_modele = p;
end $$;
reset role;
select pg_temp.login('chef'); set local role authenticated;
select pg_temp.ok((select count(*) from public.workspace_page_revisions where page_id = (select page_modele from t_ctx)) = 0,
  'le chef ne voit pas les revisions d''une page privee supprimee');
reset role;

-- Départ de tech_b (qui a aussi un espace) : archivé, pas supprimé.
select pg_temp.login('tech_b'); set local role authenticated;
select public.ensure_personal_workspace_space((select org_id from t_ctx));
reset role;
-- Le garde d'escalade lit la session : c'est le patron qui suspend.
select pg_temp.login('patron');
update public.organization_members set status = 'suspended' where id = (select membre_b from t_ctx);
select pg_temp.ok((select archived_at from public.workspace_spaces where owner_member_id = (select membre_b from t_ctx)) is not null,
  'au depart du membre, son espace personnel est archive');
update public.organization_members set status = 'active' where id = (select membre_b from t_ctx);
select pg_temp.login('tech_b'); set local role authenticated;
select pg_temp.ok((public.ensure_personal_workspace_space((select org_id from t_ctx))).archived_at is null,
  'de retour, la demande rouvre le meme espace');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — les recentes ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare i int; p uuid; begin
  perform public.touch_workspace_page((select page_partagee from t_ctx));
  perform public.touch_workspace_page((select page_privee from t_ctx));
  perform public.touch_workspace_page((select page_partagee from t_ctx));
  perform pg_temp.ok((select count(*) from public.workspace_page_visits) = 2, 'une ligne par page ouverte, pas par ouverture');

  -- Cinquante-deux pages de plus : les deux premières sortent.
  for i in 1..52 loop
    insert into public.workspace_pages (space_id, title) select perso_a, 'Page ' || i from t_ctx returning id into p;
    perform public.touch_workspace_page(p);
  end loop;
  perform pg_temp.ok((select count(*) from public.workspace_page_visits) = 50, 'cinquante recentes au plus');
  perform pg_temp.ok(not exists (select 1 from public.workspace_page_visits where page_id = (select page_partagee from t_ctx)),
    'la plus ancienne est sortie');
end $$;
reset role;

select pg_temp.login('chef'); set local role authenticated;
select pg_temp.refuses(
  format($q$select public.touch_workspace_page(%L)$q$, (select page_privee from t_ctx)),
  'toucher une page qu''on ne voit pas est refuse');
select pg_temp.ok((select count(*) from public.workspace_page_visits) = 0, 'les recentes des autres sont invisibles');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — les favoris ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
insert into public.workspace_favorites (page_id) values ((select page_privee from t_ctx));
select pg_temp.ok((select organization_id from public.workspace_favorites where page_id = (select page_privee from t_ctx)) = (select org_id from t_ctx),
  'un favori prend l''organisation de sa page');
reset role;
select pg_temp.login('chef'); set local role authenticated;
select pg_temp.refuses(
  format($q$insert into public.workspace_favorites (page_id) values (%L)$q$, (select page_privee from t_ctx)),
  'epingler une page invisible est refuse');
select pg_temp.ok((select count(*) from public.workspace_favorites) = 0, 'les favoris des autres sont invisibles');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — les modeles ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare p public.workspace_pages; begin
  perform pg_temp.ok((select count(*) from public.workspace_templates where organization_id is null) = 5, 'cinq modeles systeme lisibles');
  p := public.create_page_from_template('a0000000-0000-4000-8000-000000000001', (select perso_a from t_ctx));
  perform pg_temp.ok(p.title = 'Réunion' and p.icon = 'users' and p.content->'content'->0->>'type' = 'heading',
    'une page nait du modele avec son titre, son icone et son contenu');
  update t_ctx set page_modele = p.id;
  perform pg_temp.refuses(
    format($q$insert into public.workspace_templates (organization_id, name, content) values (%L, 'Mon modele', '{"type":"doc","content":[]}')$q$, (select org_id from t_ctx)),
    'un technicien ne cree pas de modele d''entreprise');
  -- La RLS filtre en silence : rien n'est touché.
  update public.workspace_templates set name = 'Pirate' where id = 'a0000000-0000-4000-8000-000000000001';
end $$;
reset role;
select pg_temp.ok((select name from public.workspace_templates where id = 'a0000000-0000-4000-8000-000000000001') = 'Réunion',
  'un modele systeme ne se modifie pas');

select pg_temp.login('chef'); set local role authenticated;
insert into public.workspace_templates (organization_id, name, content)
select org_id, 'Fiche de visite', (select content from public.workspace_pages where id = (select page_partagee from t_ctx)) from t_ctx;
reset role;
select pg_temp.login('patron_b'); set local role authenticated;
select pg_temp.ok((select count(*) from public.workspace_templates where organization_id is not null) = 0
  and (select count(*) from public.workspace_templates where organization_id is null) = 5,
  'l''entreprise B voit les modeles systeme, pas ceux de A');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — la recherche ==='; end $$;
-- =============================================================================

select pg_temp.ok((select search_text from public.workspace_pages where id = (select page_partagee from t_ctx))
  like 'Vérifier la continuité optique%', 'le texte est extrait du JSON TipTap');

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.ok((select count(*) from public.search_workspace_pages((select org_id from t_ctx), 'raccordement boîtier')) = 1
  and (select snippet from public.search_workspace_pages((select org_id from t_ctx), 'raccordement boîtier')) like '%«raccordement»%',
  'la recherche trouve dans le corps et surligne');
select pg_temp.ok((select count(*) from public.search_workspace_pages((select org_id from t_ctx), 'Flamboyants')) = 1,
  'tech_a trouve sa page privee');
select pg_temp.ok((select count(*) from public.search_workspace_pages((select org_id from t_ctx), 'continuités optiques')) = 1,
  'le francais est lemmatise : le pluriel trouve le singulier');
select pg_temp.ok((select count(*) from public.search_workspace_pages((select org_id from t_ctx), 'fibre -boîtier')) = 0,
  'l''exclusion fonctionne');
reset role;
select pg_temp.login('chef'); set local role authenticated;
select pg_temp.ok((select count(*) from public.search_workspace_pages((select org_id from t_ctx), 'Flamboyants')) = 0,
  'la recherche ne remonte jamais la page privee d''un autre');
reset role;
select pg_temp.login('patron_b'); set local role authenticated;
select pg_temp.ok((select count(*) from public.search_workspace_pages((select org_id from t_ctx), 'fibre')) = 0,
  'l''entreprise B ne cherche pas chez A');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 6 — l''IA du Workspace ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.refuses(
  format($q$insert into public.ai_conversations (organization_id, user_id, title) values (%L, %L, 'Generale')$q$, (select org_id from t_ctx), pg_temp.uid('tech_a')),
  'un technicien n''ouvre pas de conversation generale (ai.use)');
select pg_temp.refuses(
  format($q$insert into public.ai_conversations (organization_id, user_id, title, scope) values (%L, %L, 'Sans page', 'workspace')$q$, (select org_id from t_ctx), pg_temp.uid('tech_a')),
  'une conversation Workspace sans page est refusee');
reset role;
select pg_temp.login('tech_b'); set local role authenticated;
select pg_temp.refuses(
  format($q$insert into public.ai_conversations (organization_id, user_id, title, scope, page_id) values (%L, %L, 'Sur la page privee d''un autre', 'workspace', %L)$q$,
    (select org_id from t_ctx), pg_temp.uid('tech_b'), (select page_privee from t_ctx)),
  'une conversation sur une page d''autrui est refusee');
reset role;
select pg_temp.login('tech_a'); set local role authenticated;
insert into public.ai_conversations (organization_id, user_id, title, scope, page_id)
select org_id, pg_temp.uid('tech_a'), 'Résume ma page', 'workspace', page_privee from t_ctx;
select pg_temp.ok((select count(*) from public.ai_conversations where scope = 'workspace' and page_id = (select page_privee from t_ctx)) = 1,
  'un technicien ouvre une conversation attachee a sa page (ai.workspace)');
reset role;

select pg_temp.ok((select reservation_id from public.reserve_ai_usage((select org_id from t_ctx), pg_temp.uid('tech_a'))) is null,
  'la reservation generale est refusee au technicien');
select pg_temp.ok((select reservation_id from public.reserve_ai_usage((select org_id from t_ctx), pg_temp.uid('tech_a'), 'workspace')) is not null,
  'la reservation Workspace est accordee au technicien');
select pg_temp.ok((select reservation_id from public.reserve_ai_usage((select org_id from t_ctx), pg_temp.uid('patron'))) is not null,
  'la reservation generale reste accordee au proprietaire');

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;
