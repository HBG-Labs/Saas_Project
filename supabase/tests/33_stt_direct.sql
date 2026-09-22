-- =============================================================================
-- 33 — Transcription en direct : la porte, le brouillon, le coût
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. l'auteur pose le brouillon du direct et le marqueur `live_used` avec
--      la ligne ; le plafond du brouillon tient ;
--   2. la réservation compte deux fois les minutes d'un enregistrement fait
--      avec le direct, une fois sinon ; une reprise ne recompte pas ;
--   3. la porte : ouverte pour un membre avec `ai.workspace`, page visible,
--      organisation en v2 et quota ; fermée — avec le motif — en legacy, sans
--      quota, pour une page invisible, pour une autre entreprise ;
--   4. la trace des jetons n'est pas lisible par un client.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000330001'),
  ('tech_a',   '00000000-0000-4000-8000-000000330002'),
  ('tech_b',   '00000000-0000-4000-8000-000000330003'),
  ('patron_b', '00000000-0000-4000-8000-000000330004'),
  ('patron_c', '00000000-0000-4000-8000-000000330005');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, org_legacy uuid, org_sans uuid, page uuid, rec_live uuid, rec_sans uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, org_legacy, org_sans)
values (pg_temp.organisation_abonnee('live-a', 'Live A', 'patron', 'pro'),
        pg_temp.organisation_abonnee('live-b', 'Live B', 'patron_b', 'pro'),
        pg_temp.organisation_abonnee('live-c', 'Live C', 'patron_c', 'starter'));
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_b', 'technician') from t_ctx;
update public.organizations set stt_engine = 'v2', industry = 'fiber_telecom'
where id in (select org_id from t_ctx union select org_sans from t_ctx);

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — le brouillon et le marqueur ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare s public.workspace_spaces; p uuid; r public.workspace_recordings; org text; begin
  s := public.ensure_personal_workspace_space((select org_id from t_ctx));
  insert into public.workspace_pages (space_id, title) values (s.id, 'Direct') returning id into p;
  select org_id::text into org from t_ctx;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at, transcript_live, live_used)
  values (p, org || '/' || p || '/a.webm', 'audio/webm', 130, now(), 'la pto est posée au salon', true) returning * into r;
  perform pg_temp.ok(r.transcript_live = 'la pto est posée au salon' and r.live_used, 'le brouillon et le marqueur entrent avec la ligne');
  perform public.submit_workspace_recording(r.id, 1000);
  update t_ctx set page = p, rec_live = r.id;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (p, org || '/' || p || '/b.webm', 'audio/webm', 130, now()) returning * into r;
  perform pg_temp.ok(r.transcript_live is null and not r.live_used, 'sans direct : rien, faux');
  perform public.submit_workspace_recording(r.id, 1000);
  update t_ctx set rec_sans = r.id;
end $$;
select pg_temp.refuses(
  format($q$insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at, transcript_live)
           values (%L, %L, 'audio/webm', 10, now(), repeat('x', 200001))$q$,
         (select page from t_ctx), (select org_id::text || '/' || page::text || '/c.webm' from t_ctx)),
  'le plafond du brouillon tient');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — le direct compte double ==='; end $$;
-- =============================================================================

select set_config('request.jwt.claims', '', true);
do $$ declare r record; begin
  select * into r from public.reserve_transcription_minutes((select rec_live from t_ctx));
  perform pg_temp.ok(r.reserved and r.reserved_minutes = 6, '130 s avec le direct = 3 min x 2 = 6 minutes reservees');
  select * into r from public.reserve_transcription_minutes((select rec_sans from t_ctx));
  perform pg_temp.ok(r.reserved and r.reserved_minutes = 3, '130 s sans direct = 3 minutes');
  select * into r from public.reserve_transcription_minutes((select rec_live from t_ctx));
  perform pg_temp.ok(r.reserved and r.reserved_minutes = 6, 'une reprise ne recompte pas');
end $$;
select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.ok((select used_minutes from public.transcription_quota_status((select org_id from t_ctx))) = 9,
  'le quota du mois porte 9 minutes');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — la porte ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.ok((select allowed and industry = 'fiber_telecom' and language = 'fr'
                   from public.live_transcription_access((select org_id from t_ctx), (select page from t_ctx))),
  'ouverte : membre, ai.workspace, page visible, v2, quota — avec le secteur');
reset role;

-- La même page, vue par un autre technicien : espace personnel de tech_a, invisible.
select pg_temp.login('tech_b'); set local role authenticated;
select pg_temp.ok((select not allowed and reason = 'page'
                   from public.live_transcription_access((select org_id from t_ctx), (select page from t_ctx))),
  'fermee : page invisible');
reset role;

select pg_temp.login('patron_b'); set local role authenticated;
select pg_temp.ok((select not allowed and reason = 'membership' and industry is null
                   from public.live_transcription_access((select org_id from t_ctx), (select page from t_ctx))),
  'fermee : une autre entreprise, sans rien apprendre');
-- Sa propre organisation, restée en legacy.
do $$ declare s public.workspace_spaces; p uuid; a record; begin
  s := public.ensure_personal_workspace_space((select org_legacy from t_ctx));
  insert into public.workspace_pages (space_id, title) values (s.id, 'Legacy') returning id into p;
  select * into a from public.live_transcription_access((select org_legacy from t_ctx), p);
  perform pg_temp.ok(not a.allowed and a.reason = 'engine', 'fermee : organisation en legacy');
end $$;
reset role;

-- Une organisation Starter (sans minutes) en v2 : quota (ou module, selon la formule).
select pg_temp.login('patron_c'); set local role authenticated;
do $$ declare s public.workspace_spaces; p uuid; a record; begin
  s := public.ensure_personal_workspace_space((select org_sans from t_ctx));
  insert into public.workspace_pages (space_id, title) values (s.id, 'Sans minutes') returning id into p;
  select * into a from public.live_transcription_access((select org_sans from t_ctx), p);
  perform pg_temp.ok(not a.allowed and a.reason in ('quota', 'module'), 'fermee : pas de minutes (' || a.reason || ')');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — la trace des jetons ==='; end $$;
-- =============================================================================

insert into public.transcription_live_sessions (organization_id, user_id, page_id, model)
select org_id, (select v from t_ids where k = 'tech_a'), page, 'gpt-live-transcribe' from t_ctx;
select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.refuses('select count(*) from public.transcription_live_sessions', 'un client ne lit pas la trace des jetons');
reset role;
select pg_temp.ok((select count(*) from public.transcription_live_sessions where organization_id = (select org_id from t_ctx)) = 1,
  'la trace existe cote serveur');

select 'TOUS LES TESTS PASSENT' as resultat;
