-- =============================================================================
-- 27 — Transcription : le flag par organisation, le brut immuable
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. une organisation naît en « legacy » ; qui met à jour l'organisation
--      passe en « v2 », une autre valeur est refusée, un technicien ne change
--      rien, une autre entreprise non plus ;
--   2. le tirage rend le moteur de l'organisation ;
--   3. « done » pose le brut ET le texte ; une reprise ne réécrit pas le
--      brut ; le brut est immuable pour service_role comme pour un client ;
--      le moteur utilisé est consigné ;
--   4. les colonnes des phases suivantes existent, nulles ; les notes
--      s'écrivent par l'auteur, pas par un autre ;
--   5. un enregistrement transcrit AVANT la migration garde son texte, qui
--      devient son brut.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000270001'),
  ('tech_a',   '00000000-0000-4000-8000-000000270002'),
  ('patron_b', '00000000-0000-4000-8000-000000270003');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, autre_org_id uuid, page uuid, rec uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('stt-a', 'STT A', 'patron', 'pro'),
        pg_temp.organisation_abonnee('stt-b', 'STT B', 'patron_b', 'pro'));
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;

-- Une page et un enregistrement en attente, de tech_a.
select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare s public.workspace_spaces; p uuid; r public.workspace_recordings; org text; begin
  s := public.ensure_personal_workspace_space((select org_id from t_ctx));
  insert into public.workspace_pages (space_id, title) values (s.id, 'Réunion') returning id into p;
  select org_id::text into org from t_ctx;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (p, org || '/' || p || '/a.webm', 'audio/webm', 90, now()) returning * into r;
  perform public.submit_workspace_recording(r.id, 1000);
  update t_ctx set page = p, rec = r.id;
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — le flag ==='; end $$;
-- =============================================================================

select pg_temp.ok((select stt_engine from public.organizations where id = (select org_id from t_ctx)) = 'legacy',
  'une organisation nait en legacy');

select pg_temp.login('tech_a'); set local role authenticated;
do $$ begin
  update public.organizations set stt_engine = 'v2' where id = (select org_id from t_ctx);
end $$;
reset role;
select pg_temp.ok((select stt_engine from public.organizations where id = (select org_id from t_ctx)) = 'legacy',
  'un technicien ne change pas le moteur (RLS, en silence)');

select pg_temp.login('patron_b'); set local role authenticated;
do $$ begin
  update public.organizations set stt_engine = 'v2' where id = (select org_id from t_ctx);
end $$;
reset role;
select pg_temp.ok((select stt_engine from public.organizations where id = (select org_id from t_ctx)) = 'legacy',
  'une autre entreprise ne change pas le moteur de A');

select pg_temp.login('patron'); set local role authenticated;
select pg_temp.refuses(
  format($q$update public.organizations set stt_engine = 'v3' where id = %L$q$, (select org_id from t_ctx)),
  'une valeur inconnue est refusee');
update public.organizations set stt_engine = 'v2' where id = (select org_id from t_ctx);
reset role;
select pg_temp.ok((select stt_engine from public.organizations where id = (select org_id from t_ctx)) = 'v2',
  'le patron passe en v2');
select pg_temp.ok((select stt_engine from public.organizations where id = (select autre_org_id from t_ctx)) = 'legacy',
  'l''autre entreprise reste en legacy');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — le tirage rend le moteur ==='; end $$;
-- =============================================================================

select set_config('request.jwt.claims', '', true);
do $$ declare c record; begin
  select * into c from public.claim_workspace_recordings(20) x where x.id = (select rec from t_ctx);
  perform pg_temp.ok(c.stt_engine = 'v2', 'le tirage porte le moteur de l''organisation');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — le brut immuable ==='; end $$;
-- =============================================================================

do $$ declare r public.workspace_recordings; begin
  perform public.record_workspace_recording_result((select rec from t_ctx), 'done', 'Bonjour à tous.', '- Rien', null, 'gpt-transcribe');
  select * into r from public.workspace_recordings where id = (select rec from t_ctx);
  perform pg_temp.ok(r.transcript_raw = 'Bonjour à tous.' and r.transcript = 'Bonjour à tous.' and r.engine = 'gpt-transcribe',
    'done pose le brut, le texte et le moteur');
  perform pg_temp.ok(r.transcript_normalized_at is null and r.segments is null and r.summary_json is null and r.notes is null,
    'les colonnes des phases suivantes existent, nulles');

  -- Le texte de travail peut évoluer (phase 7), pas le brut.
  update public.workspace_recordings set transcript = 'Bonjour à tous, PTO posée.' where id = r.id;
  perform pg_temp.ok((select transcript_raw = 'Bonjour à tous.' from public.workspace_recordings where id = r.id),
    'modifier le texte de travail laisse le brut intact');
  perform pg_temp.refuses(
    format($q$update public.workspace_recordings set transcript_raw = 'Réécrit' where id = %L$q$, r.id),
    'le brut est immuable, meme hors RLS (service_role, migrations)');
  perform pg_temp.refuses(
    format($q$update public.workspace_recordings set transcript_raw = null where id = %L$q$, r.id),
    'ni effacable');
end $$;

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.refuses(
  format($q$update public.workspace_recordings set transcript = 'Pirate' where id = %L$q$, (select rec from t_ctx)),
  'un client ne modifie pas le texte (colonne non accordee)');
select pg_temp.refuses(
  format($q$update public.workspace_recordings set transcript_raw = 'Pirate' where id = %L$q$, (select rec from t_ctx)),
  'ni le brut');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — les notes ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
update public.workspace_recordings set notes = 'Penser à rappeler Karim.' where id = (select rec from t_ctx);
reset role;
select pg_temp.ok((select notes from public.workspace_recordings where id = (select rec from t_ctx)) = 'Penser à rappeler Karim.',
  'l''auteur ecrit ses notes');
select pg_temp.login('patron_b'); set local role authenticated;
do $$ begin
  update public.workspace_recordings set notes = 'Intrusion' where id = (select rec from t_ctx);
end $$;
reset role;
select pg_temp.ok((select notes from public.workspace_recordings where id = (select rec from t_ctx)) = 'Penser à rappeler Karim.',
  'une autre entreprise ne touche pas aux notes');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — l''existant avant la migration ==='; end $$;
-- =============================================================================

-- Un enregistrement « d'avant » : transcrit, sans brut (les colonnes n'existaient
-- pas). Le rejeu de la reprise de la migration lui donne son brut.
select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare r public.workspace_recordings; org text; pg text; begin
  select org_id::text, page::text into org, pg from t_ctx;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (pg::uuid, org || '/' || pg || '/ancien.webm', 'audio/webm', 30, now()) returning * into r;
  update t_ctx set rec = r.id;
end $$;
reset role;
update public.workspace_recordings set status = 'done', transcript = 'Texte d''avant.' where id = (select rec from t_ctx);
update public.workspace_recordings
set transcript_raw = transcript, engine = coalesce(engine, 'gpt-4o-transcribe')
where transcript is not null and transcript_raw is null;
select pg_temp.ok((select transcript_raw = 'Texte d''avant.' and transcript = 'Texte d''avant.' and engine = 'gpt-4o-transcribe'
                   from public.workspace_recordings where id = (select rec from t_ctx)),
  'un enregistrement d''avant garde son texte, qui devient son brut, moteur legacy');

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;
