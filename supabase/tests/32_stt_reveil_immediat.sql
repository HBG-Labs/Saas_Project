-- =============================================================================
-- 32 — Transcription : le worker est réveillé dès la soumission
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. soumettre un enregistrement met une requête HTTP vers le worker dans
--      la file de pg_net (envoyée après validation — ici annulée avec la
--      transaction) ;
--   2. une autre mise à jour (titre, notes) ne réveille rien ; une ligne qui
--      repasse « pending » avec une reprise dans le futur non plus ;
--   3. un client n'exécute pas la fonction de réveil.
--
-- Transaction annulée. Rien ne reste en base, ni dans la file pg_net.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron', '00000000-0000-4000-8000-000000320001'),
  ('tech_a', '00000000-0000-4000-8000-000000320002');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, page uuid, rec uuid, avant bigint);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id) values (pg_temp.organisation_abonnee('wake-a', 'Wake A', 'patron', 'pro'));
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;

select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare s public.workspace_spaces; p uuid; r public.workspace_recordings; org text; begin
  s := public.ensure_personal_workspace_space((select org_id from t_ctx));
  insert into public.workspace_pages (space_id, title) values (s.id, 'Réveil') returning id into p;
  select org_id::text into org from t_ctx;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (p, org || '/' || p || '/a.webm', 'audio/webm', 14, now()) returning * into r;
  update t_ctx set page = p, rec = r.id;
end $$;
reset role;

update t_ctx set avant = (select count(*) from net.http_request_queue);

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — la soumission réveille ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
select public.submit_workspace_recording((select rec from t_ctx), 71320);
reset role;

select pg_temp.ok((select status from public.workspace_recordings where id = (select rec from t_ctx)) = 'pending',
  'la ligne est en attente');
select pg_temp.ok((select count(*) from net.http_request_queue) = (select avant from t_ctx) + 1,
  'une requete vers le worker est dans la file pg_net');
select pg_temp.ok((select url = (select decrypted_secret from vault.decrypted_secrets where name = 'transcription_worker_url')
                   from net.http_request_queue order by id desc limit 1),
  'vers l''URL du worker, lue dans Vault');
select pg_temp.ok((select headers->>'x-worker-secret' is not null from net.http_request_queue order by id desc limit 1),
  'avec le secret partage');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — rien d''autre ne réveille ==='; end $$;
-- =============================================================================

update t_ctx set avant = (select count(*) from net.http_request_queue);
select pg_temp.login('tech_a'); set local role authenticated;
update public.workspace_recordings set title = 'Renommé', notes = 'note' where id = (select rec from t_ctx);
reset role;
select pg_temp.ok((select count(*) from net.http_request_queue) = (select avant from t_ctx),
  'titre et notes ne reveillent pas');

-- Une reprise après échec : « pending » mais pas avant 2 minutes → le cron s'en charge.
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform public.claim_workspace_recordings(20);
  perform public.record_workspace_recording_result((select rec from t_ctx), 'error', null, null, 'Fournisseur indisponible', null);
end $$;
select pg_temp.ok((select status = 'pending' and next_attempt_at > now() from public.workspace_recordings where id = (select rec from t_ctx)),
  'la reprise est programmee dans le futur');
select pg_temp.ok((select count(*) from net.http_request_queue) = (select avant from t_ctx),
  'une reprise programmee ne reveille pas tout de suite');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — droits ==='; end $$;
-- =============================================================================

select pg_temp.ok(not has_function_privilege('authenticated', 'app.wake_transcription_worker()', 'execute'),
  'un client n''execute pas le reveil');
select pg_temp.ok(not has_function_privilege('authenticated', 'app.trigger_transcription_worker()', 'execute'),
  'ni le declencheur');

select 'TOUS LES TESTS PASSENT' as resultat;
