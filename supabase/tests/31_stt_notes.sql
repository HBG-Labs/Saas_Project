-- =============================================================================
-- 31 — Transcription : les notes de la personne
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. l'auteur pose ses notes à la création de la ligne, les modifie, les
--      efface ; le plafond de 20 000 caractères tient ;
--   2. qui gère le Workspace peut les corriger ; un autre membre les lit
--      (page partagée) mais ne les touche pas (RLS, en silence) ; une autre
--      entreprise ne voit rien ;
--   3. le tirage du worker ne porte pas les notes : elles ne partent jamais
--      chez le fournisseur ;
--   4. à la transcription, les notes sont copiées dans la page sous « Notes »,
--      avant le résumé ; sans notes, la page est comme avant ; l'audit le note.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000310001'),
  ('tech_a',   '00000000-0000-4000-8000-000000310002'),
  ('tech_b',   '00000000-0000-4000-8000-000000310003'),
  ('patron_b', '00000000-0000-4000-8000-000000310004');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, autre_org_id uuid, espace uuid, page uuid, rec uuid, rec_sans uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('notes-a', 'Notes A', 'patron', 'pro'),
        pg_temp.organisation_abonnee('notes-b', 'Notes B', 'patron_b', 'pro'));
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_b', 'technician') from t_ctx;

-- Un espace partagé (le patron), pour que la page soit visible des autres membres.
select pg_temp.login('patron'); set local role authenticated;
do $$ declare v uuid; begin
  insert into public.workspace_spaces (organization_id, name) select org_id, 'Chantiers' from t_ctx returning id into v;
  update t_ctx set espace = v;
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — l''auteur et ses notes ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare p uuid; r public.workspace_recordings; org text; begin
  insert into public.workspace_pages (space_id, title) values ((select espace from t_ctx), 'Chantier') returning id into p;
  select org_id::text into org from t_ctx;
  -- Avec notes, dès l'insertion (le hook les envoie avec la ligne).
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at, notes)
  values (p, org || '/' || p || '/a.webm', 'audio/webm', 90, now(), E'PTO au salon\nKarim repasse jeudi') returning * into r;
  perform pg_temp.ok(r.notes = E'PTO au salon\nKarim repasse jeudi', 'les notes entrent avec la ligne');
  perform public.submit_workspace_recording(r.id, 1000);
  update t_ctx set page = p, rec = r.id;
  -- Sans notes.
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (p, org || '/' || p || '/b.webm', 'audio/webm', 60, now()) returning * into r;
  perform public.submit_workspace_recording(r.id, 1000);
  update t_ctx set rec_sans = r.id;
end $$;

update public.workspace_recordings set notes = 'PTO au salon, client d''accord' where id = (select rec from t_ctx);
select pg_temp.ok((select notes from public.workspace_recordings where id = (select rec from t_ctx)) = 'PTO au salon, client d''accord',
  'l''auteur modifie ses notes');
select pg_temp.refuses(
  format($q$update public.workspace_recordings set notes = repeat('x', 20001) where id = %L$q$, (select rec from t_ctx)),
  'le plafond de 20 000 caracteres tient');
update public.workspace_recordings set notes = null where id = (select rec_sans from t_ctx);
select pg_temp.ok((select notes is null from public.workspace_recordings where id = (select rec_sans from t_ctx)),
  'l''auteur efface ses notes');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — les autres ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_b'); set local role authenticated;
select pg_temp.ok((select notes from public.workspace_recordings where id = (select rec from t_ctx)) = 'PTO au salon, client d''accord',
  'un autre membre lit les notes (page partagee, visible)');
do $$ begin
  update public.workspace_recordings set notes = 'Intrusion' where id = (select rec from t_ctx);
end $$;
reset role;
select pg_temp.ok((select notes from public.workspace_recordings where id = (select rec from t_ctx)) = 'PTO au salon, client d''accord',
  'un autre membre ne modifie pas les notes (RLS, en silence)');

select pg_temp.login('patron'); set local role authenticated;
update public.workspace_recordings set notes = 'PTO au salon — vérifié' where id = (select rec from t_ctx);
reset role;
select pg_temp.ok((select notes from public.workspace_recordings where id = (select rec from t_ctx)) = 'PTO au salon — vérifié',
  'qui gere le Workspace corrige les notes');

select pg_temp.login('patron_b'); set local role authenticated;
select pg_temp.ok((select count(*) from public.workspace_recordings where id = (select rec from t_ctx)) = 0,
  'une autre entreprise ne voit rien');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — le worker ne reçoit pas les notes ==='; end $$;
-- =============================================================================

select set_config('request.jwt.claims', '', true);
select pg_temp.ok(not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
         unnest(p.proargnames) as arg
    where n.nspname = 'public' and p.proname = 'claim_workspace_recordings' and arg = 'notes'),
  'le tirage ne porte aucune colonne « notes »');
do $$ declare c record; begin
  select * into c from public.claim_workspace_recordings(20) x where x.id = (select rec from t_ctx);
  perform pg_temp.ok(c.id is not null and c.title is not null, 'le tirage rend bien l''enregistrement, sans ses notes');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — les notes rejoignent la page ==='; end $$;
-- =============================================================================

do $$ declare pg jsonb; titres text[]; nb int; begin
  perform public.record_workspace_recording_result((select rec from t_ctx), 'done', 'Texte.', '- Point', null, 'gpt-transcribe');
  select content into pg from public.workspace_pages where id = (select page from t_ctx);
  select array_agg(b->'content'->0->>'text' order by ord) into titres
  from jsonb_array_elements(pg->'content') with ordinality as t(b, ord)
  where b->>'type' = 'heading' and (b->'attrs'->>'level')::int = 3;
  perform pg_temp.ok(titres = array['Notes', 'Résumé', 'Transcription'], 'Notes, puis Résumé, puis Transcription');
  perform pg_temp.ok(pg::text like '%PTO au salon — vérifié%', 'les notes sont dans la page, telles quelles');
  select count(*) into nb from public.audit_logs a
  where a.entity_id = (select rec from t_ctx) and a.action = 'workspace_recording.transcribed'
    and (a.metadata->>'with_notes')::boolean;
  perform pg_temp.ok(nb = 1, 'l''audit note la presence de notes (pas leur contenu)');
  perform pg_temp.ok(not exists (select 1 from public.audit_logs a where a.entity_id = (select rec from t_ctx)
                                 and a.metadata::text like '%PTO au salon%'),
    'l''audit ne contient pas le texte des notes');

  perform public.record_workspace_recording_result((select rec_sans from t_ctx), 'done', 'Autre.', null, null, 'gpt-transcribe');
  select content into pg from public.workspace_pages where id = (select page from t_ctx);
  select count(*) into nb from jsonb_array_elements(pg->'content') b
  where b->>'type' = 'heading' and b->'content'->0->>'text' = 'Notes';
  perform pg_temp.ok(nb = 1, 'sans notes, pas de section Notes (une seule, celle du premier)');
end $$;

select 'TOUS LES TESTS PASSENT' as resultat;
