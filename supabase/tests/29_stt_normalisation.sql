-- =============================================================================
-- 29 — Transcription : la normalisation contrôlée laisse une trace vérifiable
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. « done » avec brut + trace : le texte est le normalisé, le brut est
--      celui du moteur, l'instant et la trace sont posés, la page reçoit le
--      texte normalisé ; l'audit compte les remplacements ;
--   2. « done » sans trace (legacy, ou v2 sans passe) : brut = texte, rien de
--      normalisé — comme avant la phase 7 ;
--   3. une trace sans brut, ou qui n'est pas un tableau, est refusée ;
--      un texte marqué normalisé sans brut ni trace est refusé par la table ;
--   4. l'auteur LIT le brut et la trace (« je dois toujours pouvoir retrouver
--      le transcript original ») ; il ne les modifie pas ; une autre
--      entreprise ne voit rien ;
--   5. une reprise après échec garde le brut de la première passe ;
--   6. l'ancienne signature a disparu : une seule surcharge.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000290001'),
  ('tech_a',   '00000000-0000-4000-8000-000000290002'),
  ('patron_b', '00000000-0000-4000-8000-000000290003');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, autre_org_id uuid, page uuid, rec uuid, rec_legacy uuid, rec_brut uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('norm-a', 'Norm A', 'patron', 'pro'),
        pg_temp.organisation_abonnee('norm-b', 'Norm B', 'patron_b', 'pro'));
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;
update public.organizations set stt_engine = 'v2' where id = (select org_id from t_ctx);

-- Une page et trois enregistrements en attente, de tech_a.
select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare s public.workspace_spaces; p uuid; r public.workspace_recordings; org text; begin
  s := public.ensure_personal_workspace_space((select org_id from t_ctx));
  insert into public.workspace_pages (space_id, title) values (s.id, 'Chantier') returning id into p;
  select org_id::text into org from t_ctx;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (p, org || '/' || p || '/a.webm', 'audio/webm', 90, now()) returning * into r;
  perform public.submit_workspace_recording(r.id, 1000);
  update t_ctx set page = p, rec = r.id;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (p, org || '/' || p || '/b.webm', 'audio/webm', 60, now()) returning * into r;
  perform public.submit_workspace_recording(r.id, 1000);
  update t_ctx set rec_legacy = r.id;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (p, org || '/' || p || '/c.webm', 'audio/webm', 10, now()) returning * into r;
  perform public.submit_workspace_recording(r.id, 1000);
  update t_ctx set rec_brut = r.id;
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — done avec brut et trace ==='; end $$;
-- =============================================================================

do $$ declare r public.workspace_recordings; pg jsonb; nb int; begin
  perform public.record_workspace_recording_result(
    (select rec from t_ctx), 'done',
    'La PTO est posée chez Caraïbe Télécom.', '- PTO posée', null, 'gpt-transcribe',
    'La pto est posée chez caraibe telecom.',
    '[{"de":"pto","vers":"PTO","occurrences":1,"couche":"orthographe"},
      {"de":"caraibe telecom","vers":"Caraïbe Télécom","occurrences":1,"couche":"orthographe"}]'::jsonb);
  select * into r from public.workspace_recordings where id = (select rec from t_ctx);
  perform pg_temp.ok(r.transcript = 'La PTO est posée chez Caraïbe Télécom.', 'le texte est le normalise');
  perform pg_temp.ok(r.transcript_raw = 'La pto est posée chez caraibe telecom.', 'le brut est celui du moteur, intact');
  perform pg_temp.ok(r.transcript_normalized_at is not null, 'l''instant de normalisation est pose');
  perform pg_temp.ok(jsonb_typeof(r.normalization_diff) = 'array' and jsonb_array_length(r.normalization_diff) = 2,
    'la trace porte les deux remplacements');
  perform pg_temp.ok(r.normalization_diff->1->>'vers' = 'Caraïbe Télécom', 'la trace est lisible telle quelle');
  perform pg_temp.ok(r.status = 'done' and r.engine = 'gpt-transcribe', 'statut et moteur comme avant');

  select content into pg from public.workspace_pages where id = (select page from t_ctx);
  perform pg_temp.ok(pg::text like '%La PTO est posée chez Caraïbe Télécom.%', 'la page recoit le texte normalise');
  perform pg_temp.ok(pg::text not like '%caraibe telecom%', 'et pas le brut');

  select count(*) into nb from public.audit_logs a
  where a.entity_id = (select rec from t_ctx) and a.action = 'workspace_recording.transcribed'
    and (a.metadata->>'normalized')::boolean and (a.metadata->>'replacements')::int = 2;
  perform pg_temp.ok(nb = 1, 'l''audit consigne la normalisation et le nombre de remplacements');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — done sans trace : comme avant ==='; end $$;
-- =============================================================================

do $$ declare r public.workspace_recordings; begin
  perform public.record_workspace_recording_result(
    (select rec_legacy from t_ctx), 'done', 'Bonjour à tous.', null, null, 'gpt-4o-transcribe');
  select * into r from public.workspace_recordings where id = (select rec_legacy from t_ctx);
  perform pg_temp.ok(r.transcript = 'Bonjour à tous.' and r.transcript_raw = 'Bonjour à tous.',
    'sans trace, le brut est le texte');
  perform pg_temp.ok(r.transcript_normalized_at is null and r.normalization_diff is null,
    'rien n''est marque normalise');
end $$;

-- Un brut donné sans trace (v2, passe non vérifiable) : le brut est celui du
-- moteur, le texte aussi, rien de marqué.
do $$ declare r public.workspace_recordings; begin
  perform public.record_workspace_recording_result((select rec_brut from t_ctx), 'done', 'Texte brut.', null, null, 'gpt-transcribe', 'Texte brut.', null);
  select * into r from public.workspace_recordings where id = (select rec_brut from t_ctx);
  perform pg_temp.ok(r.transcript = 'Texte brut.' and r.transcript_raw = 'Texte brut.'
                     and r.transcript_normalized_at is null and r.normalization_diff is null,
    'un brut sans trace : texte = brut, rien de marque');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — ce qui est refusé ==='; end $$;
-- =============================================================================

select pg_temp.refuses(
  format($q$select public.record_workspace_recording_result(%L, 'done', 'Texte', null, null, 'gpt-transcribe', null, '[]'::jsonb)$q$,
         (select rec_legacy from t_ctx)),
  'une trace sans brut est refusee');
select pg_temp.refuses(
  format($q$select public.record_workspace_recording_result(%L, 'done', 'Texte', null, null, 'gpt-transcribe', 'Texte', '{"de":"x"}'::jsonb)$q$,
         (select rec_legacy from t_ctx)),
  'une trace qui n''est pas un tableau est refusee');
select pg_temp.refuses(
  format($q$update public.workspace_recordings set transcript_normalized_at = now() where id = %L$q$,
         (select rec_legacy from t_ctx)),
  'un texte marque normalise sans trace est refuse par la table');
select pg_temp.refuses(
  format($q$update public.workspace_recordings set normalization_diff = '{"a":1}'::jsonb where id = %L$q$,
         (select rec from t_ctx)),
  'une trace qui n''est pas un tableau est refusee par la table');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — l''auteur retrouve le brut et la trace ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.ok((select transcript_raw = 'La pto est posée chez caraibe telecom.' and jsonb_array_length(normalization_diff) = 2
                   from public.workspace_recordings where id = (select rec from t_ctx)),
  'l''auteur lit le brut et la trace');
select pg_temp.refuses(
  format($q$update public.workspace_recordings set normalization_diff = '[]'::jsonb where id = %L$q$, (select rec from t_ctx)),
  'l''auteur ne modifie pas la trace (colonne non accordee)');
select pg_temp.refuses(
  format($q$update public.workspace_recordings set transcript_raw = 'Autre' where id = %L$q$, (select rec from t_ctx)),
  'ni le brut');
reset role;

select pg_temp.login('patron_b'); set local role authenticated;
select pg_temp.ok((select count(*) from public.workspace_recordings where id = (select rec from t_ctx)) = 0,
  'une autre entreprise ne voit rien');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — la reprise garde le brut ==='; end $$;
-- =============================================================================

-- Le brut de la première passe est immuable : une reprise (ex. resoumission
-- après un échec de résumé) qui rend un autre brut ne l'écrase pas.
do $$ declare r public.workspace_recordings; begin
  update public.workspace_recordings set status = 'pending' where id = (select rec from t_ctx);
  perform public.record_workspace_recording_result(
    (select rec from t_ctx), 'done', 'La PTO est posée chez Caraïbe Télécom.', '- OK', null, 'gpt-transcribe',
    'La pto est posee chez caraibe telecom.',
    '[{"de":"pto","vers":"PTO","occurrences":1,"couche":"orthographe"}]'::jsonb);
  select * into r from public.workspace_recordings where id = (select rec from t_ctx);
  perform pg_temp.ok(r.transcript_raw = 'La pto est posée chez caraibe telecom.', 'le brut de la premiere passe reste');
  perform pg_temp.ok(jsonb_array_length(r.normalization_diff) = 1, 'la trace est celle de la derniere passe');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 6 — une seule surcharge ==='; end $$;
-- =============================================================================

select pg_temp.ok((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'record_workspace_recording_result') = 1,
  'l''ancienne signature a disparu');
select pg_temp.ok(not has_function_privilege('authenticated',
  'public.record_workspace_recording_result(uuid, text, text, text, text, text, text, jsonb)', 'execute'),
  'un client n''execute pas le resultat');

select 'TOUS LES TESTS PASSENT' as resultat;
