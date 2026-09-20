-- =============================================================================
-- 20 — Workspace : espaces, pages, tâches — chacun chez soi, rien ne se perd
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. les droits : voir et éditer pour tous les membres, gérer les espaces au
--      chef d'équipe et au-dessus ; une autre organisation ne voit rien ;
--   2. la formule : la clé `workspace` est accordée jusqu'à Gratuit (D6) ;
--   3. rien ne traverse une organisation — page parente, mission, personne
--      assignée ;
--   4. chaque modification laisse sa révision, et la révision survit à la page ;
--   5. enregistrer une page refuse d'écraser ce qu'on n'a pas vu ;
--   6. un espace s'archive, ne se supprime pas ; l'archivage est journalisé.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',      '00000000-0000-4000-8000-000000200001'),
  ('chef',        '00000000-0000-4000-8000-000000200002'),   -- team_leader : workspace.manage
  ('technicien',  '00000000-0000-4000-8000-000000200003'),   -- workspace.edit, pas manage
  ('patron_b',    '00000000-0000-4000-8000-000000200004');   -- autre organisation, GRATUITE
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, autre_org_id uuid, espace uuid, page uuid, mission uuid, membre_tech uuid, autre_membre uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('workspace-a', 'Workspace A', 'patron', 'pro'),
        pg_temp.organisation_abonnee('workspace-b', 'Workspace B', 'patron_b', 'free'));

select pg_temp.ajouter_membre(org_id, 'chef', 'team_leader') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'technicien', 'technician') from t_ctx;

update t_ctx set
  membre_tech = (select id from public.organization_members where user_id = pg_temp.uid('technicien')),
  autre_membre = (select id from public.organization_members where user_id = pg_temp.uid('patron_b'));

-- Une mission dans A, une dans B : le pont Gestion ↔ Workspace se teste des deux côtés.
insert into public.missions (organization_id, created_by, title)
select org_id, pg_temp.uid('patron'), 'Raccordement immeuble C' from t_ctx;
update t_ctx set mission = (select id from public.missions where title = 'Raccordement immeuble C');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — les droits ==='; end $$;
-- =============================================================================

select pg_temp.login('technicien'); set local role authenticated;
do $$ begin
  perform pg_temp.refuses(
    format($q$insert into public.workspace_spaces (organization_id, name) values (%L, 'Espace du technicien')$q$, (select org_id from t_ctx)),
    'un technicien (workspace.edit) ne cree pas d''espace : manage manque');
end $$;
reset role;

select pg_temp.login('chef'); set local role authenticated;
do $$ declare v uuid; begin
  insert into public.workspace_spaces (organization_id, name, description)
  select org_id, 'Chantier Les Tilleuls', 'Suivi du raccordement' from t_ctx returning id into v;
  update t_ctx set espace = v;
  perform pg_temp.ok(v is not null, 'un chef d''equipe (workspace.manage) cree un espace');
end $$;
reset role;

select pg_temp.login('technicien'); set local role authenticated;
do $$ declare p public.workspace_pages; t public.workspace_tasks; begin
  perform pg_temp.ok(
    (select count(*) = 1 from public.workspace_spaces),
    'le technicien voit l''espace de son organisation');

  insert into public.workspace_pages (space_id, title) select espace, 'Compte rendu de visite' from t_ctx returning * into p;
  update t_ctx set page = p.id;
  perform pg_temp.ok(
    p.organization_id = (select org_id from t_ctx) and p.created_by = pg_temp.uid('technicien') and p.updated_by = pg_temp.uid('technicien'),
    'il cree une page ; l''organisation vient de l''espace, l''auteur de la session');

  insert into public.workspace_tasks (space_id, title, assignee_member_id, mission_id)
  select espace, 'Photographier le PBO', membre_tech, mission from t_ctx returning * into t;
  perform pg_temp.ok(
    t.organization_id = (select org_id from t_ctx) and t.status = 'todo' and t.completed_at is null,
    'il cree une tache, assignee a lui-meme, liee a une mission de la meme organisation');

  update public.workspace_tasks set status = 'done' where id = t.id;
  perform pg_temp.ok(
    (select completed_at is not null from public.workspace_tasks where id = t.id),
    '« terminee » pose completed_at');
  update public.workspace_tasks set status = 'in_progress' where id = t.id;
  perform pg_temp.ok(
    (select completed_at is null from public.workspace_tasks where id = t.id),
    'et le retour en cours l''efface : les deux disent toujours la meme chose');
end $$;
reset role;

select pg_temp.login('patron_b'); set local role authenticated;
do $$ begin
  perform pg_temp.ok((select count(*) = 0 from public.workspace_spaces), 'une autre organisation ne voit aucun espace');
  perform pg_temp.ok((select count(*) = 0 from public.workspace_pages), 'ni aucune page');
  perform pg_temp.ok((select count(*) = 0 from public.workspace_tasks), 'ni aucune tache');
  perform pg_temp.refuses(
    format($q$insert into public.workspace_pages (space_id, title) values (%L, 'Intrusion')$q$, (select espace from t_ctx)),
    'et ne peut pas ecrire dans un espace qui n''est pas le sien');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — la formule : ouverte jusqu''a Gratuit ==='; end $$;
-- =============================================================================

select pg_temp.login('patron_b'); set local role authenticated;
do $$ declare v uuid; begin
  insert into public.workspace_spaces (organization_id, name) select autre_org_id, 'Espace gratuit' from t_ctx returning id into v;
  perform pg_temp.ok(v is not null, 'une organisation Gratuite cree un espace : la cle workspace est accordee a toutes les formules (D6)');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — rien ne traverse une organisation ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare v_autre_espace uuid; v_autre_page uuid; begin
  -- Un espace et une page dans B, poses hors RLS pour le test.
  reset role;
  insert into public.workspace_spaces (organization_id, name) select autre_org_id, 'Espace B' from t_ctx returning id into v_autre_espace;
  insert into public.workspace_pages (space_id, title) values (v_autre_espace, 'Page B') returning id into v_autre_page;
  perform pg_temp.login('patron'); set local role authenticated;

  perform pg_temp.refuses(
    format($q$insert into public.workspace_pages (space_id, parent_page_id, title) values (%L, %L, 'Enfant')$q$,
           (select espace from t_ctx), v_autre_page),
    'une page parente d''un autre espace est refusee');

  perform pg_temp.refuses(
    format($q$insert into public.workspace_tasks (space_id, title, assignee_member_id) values (%L, 'Tache', %L)$q$,
           (select espace from t_ctx), (select autre_membre from t_ctx)),
    'assigner une tache a un membre d''une autre organisation est refuse');

  perform pg_temp.refuses(
    format($q$insert into public.workspace_tasks (space_id, title, page_id) values (%L, 'Tache', %L)$q$,
           (select espace from t_ctx), v_autre_page),
    'lier une tache a une page d''une autre organisation est refuse');

  perform pg_temp.refuses(
    format($q$update public.workspace_pages set space_id = %L where id = %L$q$, v_autre_espace, (select page from t_ctx)),
    'une page ne change pas d''espace');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — les revisions ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare p public.workspace_pages; n int; begin
  select * into p from public.workspace_pages where id = (select page from t_ctx);
  perform pg_temp.ok((select count(*) = 0 from public.workspace_page_revisions), 'aucune revision tant que rien n''a change');

  -- Deplacer ne fait pas une revision.
  update public.workspace_pages set position = 3 where id = p.id;
  perform pg_temp.ok((select count(*) = 0 from public.workspace_page_revisions), 'un deplacement ne fait pas de revision');

  -- Modifier le contenu, si.
  p := public.save_workspace_page(p.id, (select updated_at from public.workspace_pages where id = p.id),
         'Compte rendu de visite', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"PBO pose."}]}]}'::jsonb);
  select count(*) into n from public.workspace_page_revisions where page_id = p.id;
  perform pg_temp.ok(n = 1, 'une modification de contenu archive la version precedente');
  perform pg_temp.ok(
    (select authored_by = pg_temp.uid('technicien') and replaced_by = pg_temp.uid('patron')
       from public.workspace_page_revisions where page_id = p.id),
    'la revision dit qui avait ecrit cette version, et qui l''a remplacee');
  perform pg_temp.ok(
    (select content = '{"type":"doc","content":[]}'::jsonb from public.workspace_page_revisions where page_id = p.id),
    'et porte le contenu d''avant, pas celui d''apres');
  perform pg_temp.ok(p.updated_by = pg_temp.uid('patron'), 'la page, elle, porte son nouvel auteur');

  perform pg_temp.refuses(
    format($q$delete from public.workspace_page_revisions where page_id = %L$q$, p.id),
    'une revision ne se supprime pas');
  perform pg_temp.refuses(
    format($q$update public.workspace_page_revisions set title = 'Falsifie' where page_id = %L$q$, p.id),
    'ni ne se modifie');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — enregistrer sans ecraser ==='; end $$;
-- =============================================================================

select pg_temp.login('technicien'); set local role authenticated;
do $$ declare v_page uuid; v_avant timestamptz; begin
  select page into v_page from t_ctx;
  select updated_at into v_avant from public.workspace_pages where id = v_page;

  -- Le patron enregistre entre-temps (hors RLS, pour simuler l'autre session).
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid('patron'), 'role', 'authenticated')::text, true);
  update public.workspace_pages set title = 'Compte rendu (relu)' where id = v_page;
  perform pg_temp.login('technicien'); set local role authenticated;

  perform pg_temp.refuses(
    format($q$select public.save_workspace_page(%L, %L, 'Ma version', '{"type":"doc","content":[]}'::jsonb)$q$, v_page, v_avant),
    'enregistrer avec un updated_at perime est refuse : quelqu''un d''autre a modifie la page');
  perform pg_temp.ok(
    (select title = 'Compte rendu (relu)' from public.workspace_pages where id = v_page),
    'et rien n''a ete ecrase');

  -- Avec le bon updated_at, ca passe.
  perform public.save_workspace_page(v_page, (select updated_at from public.workspace_pages where id = v_page),
    '  Compte rendu final  ', '{"type":"doc","content":[]}'::jsonb);
  perform pg_temp.ok(
    (select title = 'Compte rendu final' from public.workspace_pages where id = v_page),
    'avec l''updated_at courant, l''enregistrement passe (titre nettoye)');

  -- Avec l'updated_at COURANT, pour que le refus vienne bien du contenu et
  -- non d'un horodatage perime.
  perform pg_temp.refuses(
    format($q$select public.save_workspace_page(%L, (select updated_at from public.workspace_pages where id = %L), 'x', '{"type":"paragraph"}'::jsonb)$q$, v_page, v_page),
    'un contenu qui n''est pas un document TipTap est refuse');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 6 — la revision survit a la page ==='; end $$;
-- =============================================================================

select pg_temp.login('technicien'); set local role authenticated;
do $$ declare v_page uuid; n_avant int; n_apres int; begin
  select page into v_page from t_ctx;
  select count(*) into n_avant from public.workspace_page_revisions where page_id = v_page;

  delete from public.workspace_pages where id = v_page;
  perform pg_temp.ok(not exists (select 1 from public.workspace_pages where id = v_page), 'la page est supprimee');

  select count(*) into n_apres from public.workspace_page_revisions where page_id = v_page;
  perform pg_temp.ok(n_apres = n_avant + 1, 'sa derniere version est archivee au passage, et les revisions restent');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 7 — un espace s''archive, ne se supprime pas ==='; end $$;
-- =============================================================================

select pg_temp.login('chef'); set local role authenticated;
do $$ begin
  perform pg_temp.refuses(
    format($q$delete from public.workspace_spaces where id = %L$q$, (select espace from t_ctx)),
    'supprimer un espace est refuse, meme a qui le gere');

  update public.workspace_spaces set archived_at = now() where id = (select espace from t_ctx);
  perform pg_temp.ok(
    (select archived_at is not null from public.workspace_spaces where id = (select espace from t_ctx)),
    'l''archiver, oui');
end $$;
reset role;

do $$ begin
  perform pg_temp.ok(
    (select count(*) = 1 from public.audit_logs where action = 'workspace_space.created' and entity_id = (select espace from t_ctx) and user_id = pg_temp.uid('chef')),
    'la creation est journalisee, avec son auteur');
  perform pg_temp.ok(
    (select count(*) = 1 from public.audit_logs where action = 'workspace_space.archived' and entity_id = (select espace from t_ctx)),
    'l''archivage aussi');
end $$;

do $$ begin
  raise notice '';
  raise notice ' TOUS LES TESTS PASSENT';
end $$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;
