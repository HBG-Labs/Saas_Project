-- =============================================================================
-- 30 — Transcription : segments numérotés et résumé structuré
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. « done » avec segments et résumé structuré : les deux colonnes sont
--      posées ; la page reçoit la transcription paragraphe par paragraphe,
--      dans l'ordre des segments, et le Markdown du résumé ; l'audit compte ;
--   2. « done » sans (legacy) : colonnes nulles, page comme avant ;
--   3. des segments qui ne sont pas un tableau, un résumé qui n'est pas un
--      objet, sont refusés — par la fonction comme par la table ;
--   4. l'auteur lit segments et résumé ; il ne les modifie pas ; une autre
--      entreprise ne voit rien ;
--   5. une seule surcharge, non exécutable par un client.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000300001'),
  ('tech_a',   '00000000-0000-4000-8000-000000300002'),
  ('patron_b', '00000000-0000-4000-8000-000000300003');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, autre_org_id uuid, page uuid, rec uuid, rec_legacy uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('seg-a', 'Seg A', 'patron', 'pro'),
        pg_temp.organisation_abonnee('seg-b', 'Seg B', 'patron_b', 'pro'));
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;

select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare s public.workspace_spaces; p uuid; r public.workspace_recordings; org text; begin
  s := public.ensure_personal_workspace_space((select org_id from t_ctx));
  insert into public.workspace_pages (space_id, title) values (s.id, 'Visite') returning id into p;
  select org_id::text into org from t_ctx;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (p, org || '/' || p || '/a.webm', 'audio/webm', 90, now()) returning * into r;
  perform public.submit_workspace_recording(r.id, 1000);
  update t_ctx set page = p, rec = r.id;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (p, org || '/' || p || '/b.webm', 'audio/webm', 60, now()) returning * into r;
  perform public.submit_workspace_recording(r.id, 1000);
  update t_ctx set rec_legacy = r.id;
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — done avec segments et résumé structuré ==='; end $$;
-- =============================================================================

do $$ declare r public.workspace_recordings; pg jsonb; paras text[]; nb int; begin
  perform public.record_workspace_recording_result(
    (select rec from t_ctx), 'done',
    E'Premier paragraphe.\nSecond paragraphe.', E'## Points clés\n- Un point [§2]', null, 'gpt-transcribe',
    E'Premier paragraphe.\nSecond paragraphe.', '[]'::jsonb,
    '[{"id":"s1","start":null,"end":null,"speaker":null,"text":"Premier paragraphe."},
      {"id":"s2","start":null,"end":null,"speaker":null,"text":"Second paragraphe."}]'::jsonb,
    '{"version":1,"points_cles":[{"texte":"Un point","citations":["s2"]}],"decisions":[],"actions":[]}'::jsonb);
  select * into r from public.workspace_recordings where id = (select rec from t_ctx);
  perform pg_temp.ok(jsonb_array_length(r.segments) = 2 and r.segments->1->>'id' = 's2', 'les segments sont poses');
  perform pg_temp.ok(r.summary_json->'points_cles'->0->'citations'->>0 = 's2', 'le resume structure est pose');
  perform pg_temp.ok(r.transcript_normalized_at is not null and r.normalization_diff = '[]'::jsonb,
    'la trace vide marque une passe sans changement');

  -- La page : après le titre « Transcription », un paragraphe par segment, dans l'ordre.
  select content into pg from public.workspace_pages where id = (select page from t_ctx);
  select array_agg(b->'content'->0->>'text' order by ord) into paras
  from jsonb_array_elements(pg->'content') with ordinality as t(b, ord)
  where b->>'type' = 'paragraph';
  perform pg_temp.ok(paras = array['Premier paragraphe.', 'Second paragraphe.'],
    'la page recoit un paragraphe par segment, dans l''ordre');
  perform pg_temp.ok(pg::text like '%Un point [§2]%', 'la page recoit le resume derive, avec ses renvois');

  select count(*) into nb from public.audit_logs a
  where a.entity_id = (select rec from t_ctx) and a.action = 'workspace_recording.transcribed'
    and (a.metadata->>'segments')::int = 2 and (a.metadata->>'structured_summary')::boolean;
  perform pg_temp.ok(nb = 1, 'l''audit compte les segments et note le resume structure');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — legacy : comme avant ==='; end $$;
-- =============================================================================

do $$ declare r public.workspace_recordings; begin
  perform public.record_workspace_recording_result(
    (select rec_legacy from t_ctx), 'done', 'Bonjour à tous.', '- Rien', null, 'gpt-4o-transcribe');
  select * into r from public.workspace_recordings where id = (select rec_legacy from t_ctx);
  perform pg_temp.ok(r.segments is null and r.summary_json is null and r.transcript = 'Bonjour à tous.'
                     and r.transcript_raw = 'Bonjour à tous.',
    'sans segments ni resume structure : colonnes nulles, texte et brut comme avant');
  perform pg_temp.ok((select content::text like '%Bonjour à tous.%' from public.workspace_pages where id = (select page from t_ctx)),
    'la page recoit le texte tel quel');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — ce qui est refusé ==='; end $$;
-- =============================================================================

select pg_temp.refuses(
  format($q$select public.record_workspace_recording_result(%L, 'done', 'T', null, null, 'x', 'T', null, '{"id":"s1"}'::jsonb, null)$q$,
         (select rec_legacy from t_ctx)),
  'des segments qui ne sont pas un tableau sont refuses');
select pg_temp.refuses(
  format($q$select public.record_workspace_recording_result(%L, 'done', 'T', null, null, 'x', 'T', null, null, '[]'::jsonb)$q$,
         (select rec_legacy from t_ctx)),
  'un resume structure qui n''est pas un objet est refuse');
select pg_temp.refuses(
  format($q$update public.workspace_recordings set segments = '{}'::jsonb where id = %L$q$, (select rec from t_ctx)),
  'la table refuse des segments qui ne sont pas un tableau');
select pg_temp.refuses(
  format($q$update public.workspace_recordings set summary_json = '[]'::jsonb where id = %L$q$, (select rec from t_ctx)),
  'la table refuse un resume qui n''est pas un objet');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — lecture par l''auteur, rien pour les autres ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.ok((select jsonb_array_length(segments) = 2 and summary_json->>'version' = '1'
                   from public.workspace_recordings where id = (select rec from t_ctx)),
  'l''auteur lit segments et resume structure');
select pg_temp.refuses(
  format($q$update public.workspace_recordings set segments = '[]'::jsonb where id = %L$q$, (select rec from t_ctx)),
  'l''auteur ne modifie pas les segments (colonne non accordee)');
select pg_temp.refuses(
  format($q$update public.workspace_recordings set summary_json = '{}'::jsonb where id = %L$q$, (select rec from t_ctx)),
  'ni le resume structure');
reset role;

select pg_temp.login('patron_b'); set local role authenticated;
select pg_temp.ok((select count(*) from public.workspace_recordings where id = (select rec from t_ctx)) = 0,
  'une autre entreprise ne voit rien');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — une seule surcharge ==='; end $$;
-- =============================================================================

select pg_temp.ok((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'record_workspace_recording_result') = 1,
  'l''ancienne signature a disparu');
-- Par oid : la signature évolue d'une phase à l'autre, pas la règle.
select pg_temp.ok(not has_function_privilege('authenticated',
  (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'record_workspace_recording_result'), 'execute'),
  'un client n''execute pas le resultat');

select 'TOUS LES TESTS PASSENT' as resultat;
