-- =============================================================================
-- 26 — Enregistrements vocaux : quota, dépôt, tirage, écriture dans la page, purge
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. le quota de minutes suit la formule : Pro 120, Free 0 ; une formule sans
--      minutes refuse le dépôt avant tout envoi ;
--   2. un enregistrement naît `uploading`, sous <org>/<page>/, avec le
--      consentement posé et l'auteur de la session ; sans consentement, refus ;
--      sur une page invisible, refus ; `submit` le passe en attente ;
--   3. la réservation compte la minute entamée, refuse au-delà du plafond, et
--      ne compte pas deux fois le même enregistrement ;
--   4. le tirage verrouille ; « done » écrit résumé et transcription DANS LA
--      PAGE (une révision est prise), « error » repousse, « quota » abandonne ;
--   5. la purge désigne l'audio de plus de 30 jours, et le marque effacé ;
--   6. la visibilité suit la page : un collègue ne voit pas l'enregistrement
--      d'une page privée, l'entreprise B ne voit rien.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000260001'),
  ('chef',     '00000000-0000-4000-8000-000000260002'),
  ('tech_a',   '00000000-0000-4000-8000-000000260003'),
  ('patron_b', '00000000-0000-4000-8000-000000260004');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, autre_org_id uuid, perso_a uuid, page uuid, page_partagee uuid, rec uuid, rec2 uuid, rec3 uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id, autre_org_id)
values (pg_temp.organisation_abonnee('vocal-a', 'Vocal A', 'patron', 'pro'),
        pg_temp.organisation_abonnee('vocal-b', 'Vocal B', 'patron_b', 'free'));

select pg_temp.ajouter_membre(org_id, 'chef', 'team_leader') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;

-- Une page privée de tech_a, une page partagée du chef.
select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare s public.workspace_spaces; p uuid; begin
  s := public.ensure_personal_workspace_space((select org_id from t_ctx));
  insert into public.workspace_pages (space_id, title, content)
  values (s.id, 'Réunion de chantier', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ordre du jour."}]}]}')
  returning id into p;
  update t_ctx set perso_a = s.id, page = p;
end $$;
reset role;
select pg_temp.login('chef'); set local role authenticated;
do $$ declare s uuid; p uuid; begin
  insert into public.workspace_spaces (organization_id, name) select org_id, 'Équipe' from t_ctx returning id into s;
  insert into public.workspace_pages (space_id, title) values (s, 'Point hebdo') returning id into p;
  update t_ctx set page_partagee = p;
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — le quota suit la formule ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.ok((select limit_minutes = 120 and used_minutes = 0 and remaining_minutes = 120 and not unlimited
                   from public.transcription_quota_status((select org_id from t_ctx))),
  'Pro : 120 minutes, rien de consomme');
select pg_temp.ok((select count(*) from public.transcription_quota_status((select autre_org_id from t_ctx))) = 0,
  'le quota d''une autre entreprise est invisible');
reset role;
select pg_temp.login('patron_b'); set local role authenticated;
select pg_temp.ok((select limit_minutes = 0 and remaining_minutes = 0 from public.transcription_quota_status((select autre_org_id from t_ctx))),
  'Free : zero minute (aucune ligne, l''absence vaut refus)');
do $$ declare s public.workspace_spaces; p uuid; begin
  s := public.ensure_personal_workspace_space((select autre_org_id from t_ctx));
  insert into public.workspace_pages (space_id, title) values (s.id, 'Notes') returning id into p;
  perform pg_temp.refuses(
    format($q$insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
              values (%L, %L, 'audio/webm', 90, now())$q$, p, (select autre_org_id from t_ctx) || '/' || p || '/a.webm'),
    'sans minutes, le depot est refuse avant tout envoi');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — le depot ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare r public.workspace_recordings; org text; pg text; begin
  select org_id::text, page::text into org, pg from t_ctx;
  perform pg_temp.refuses(
    format($q$insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
              values (%L, %L, 'audio/webm', 90, null)$q$, pg, org || '/' || pg || '/a.webm'),
    'sans consentement, refus');
  perform pg_temp.refuses(
    format($q$insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
              values (%L, %L, 'audio/webm', 90, now())$q$, pg, org || '/' || gen_random_uuid() || '/a.webm'),
    'un chemin hors de la page est refuse');
  perform pg_temp.refuses(
    format($q$insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
              values (%L, %L, 'audio/webm', 4000, now())$q$, pg, org || '/' || pg || '/a.webm'),
    'plus d''une heure est refuse');

  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at, status, title)
  values (pg::uuid, org || '/' || pg || '/a.webm', 'audio/webm', 90, now(), 'done', 'Réunion du matin')
  returning * into r;
  perform pg_temp.ok(r.status = 'uploading' and r.created_by = pg_temp.uid('tech_a') and r.organization_id = (select org_id from t_ctx),
    'un enregistrement nait uploading, signe de la session, dans son organisation');
  update t_ctx set rec = r.id;

  r := public.submit_workspace_recording(r.id, 700000);
  perform pg_temp.ok(r.status = 'pending' and r.size_bytes = 700000, 'submit le passe en attente');
end $$;
reset role;

-- Le chef ne voit pas la page privée de tech_a : ni son enregistrement, ni le droit d'en déposer un.
select pg_temp.login('chef'); set local role authenticated;
select pg_temp.ok((select count(*) from public.workspace_recordings where page_id = (select page from t_ctx)) = 0,
  'l''enregistrement d''une page privee est invisible d''un autre');
select pg_temp.refuses(
  format($q$insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
            values (%L, %L, 'audio/webm', 60, now())$q$, (select page from t_ctx), (select org_id from t_ctx) || '/' || (select page from t_ctx) || '/b.webm'),
  'deposer sur une page invisible est refuse');
select pg_temp.refuses(
  format($q$select public.submit_workspace_recording(%L)$q$, (select rec from t_ctx)),
  'soumettre l''enregistrement d''un autre est refuse');
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — la reservation des minutes ==='; end $$;
-- =============================================================================

-- Le worker n'a pas de session : on efface les revendications JWT.
select set_config('request.jwt.claims', '', true);
do $$ declare res record; begin
  select * into res from public.reserve_transcription_minutes((select rec from t_ctx));
  perform pg_temp.ok(res.reserved and res.reserved_minutes = 2 and res.remaining_after = 118, '90 secondes = 2 minutes entamees, il en reste 118');
  select * into res from public.reserve_transcription_minutes((select rec from t_ctx));
  perform pg_temp.ok(res.reserved and res.reserved_minutes = 2, 'une reprise ne compte pas deux fois');
  perform pg_temp.ok((select used_minutes from public.transcription_quota_status((select org_id from t_ctx)) ) is null,
    'hors session, le statut ne repond pas (reserve a un membre)');
end $$;

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.ok((select used_minutes = 2 and remaining_minutes = 118 from public.transcription_quota_status((select org_id from t_ctx))),
  'le membre voit 2 minutes consommees');
-- Deux enregistrements d'une heure : le premier passe (62/120), le second non.
do $$ declare r public.workspace_recordings; org text; pg text; begin
  select org_id::text, page::text into org, pg from t_ctx;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (pg::uuid, org || '/' || pg || '/long.webm', 'audio/webm', 3600, now()) returning * into r;
  update t_ctx set rec2 = r.id;
  insert into public.workspace_recordings (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values (pg::uuid, org || '/' || pg || '/long2.webm', 'audio/webm', 3600, now()) returning * into r;
  update t_ctx set rec3 = r.id;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ declare res record; begin
  select * into res from public.reserve_transcription_minutes((select rec2 from t_ctx));
  perform pg_temp.ok(res.reserved and res.reserved_minutes = 60 and res.remaining_after = 58, 'une heure passe : il reste 58 minutes');
  select * into res from public.reserve_transcription_minutes((select rec3 from t_ctx));
  perform pg_temp.ok(not res.reserved and res.reserved_minutes = 60 and res.remaining_after = 58, 'au-dela du plafond, la reservation est refusee');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — le tirage, l''ecriture dans la page ==='; end $$;
-- =============================================================================

do $$ declare c record; n int; blocs int; begin
  select count(*) into n from public.claim_workspace_recordings(20) x where x.id = (select rec from t_ctx);
  perform pg_temp.ok(n = 1, 'le tirage rend l''enregistrement en attente');
  perform pg_temp.ok((select status = 'processing' and locked_at is not null from public.workspace_recordings where id = (select rec from t_ctx)),
    'et le verrouille');
  select count(*) into n from public.claim_workspace_recordings(20) x where x.id = (select rec from t_ctx);
  perform pg_temp.ok(n = 0, 'pas deux fois');

  perform public.record_workspace_recording_result((select rec from t_ctx), 'error', null, null, 'OpenAI 503');
  perform pg_temp.ok((select status = 'pending' and attempts = 1 and locked_at is null and error = 'OpenAI 503'
                       and next_attempt_at = now() + interval '2 minutes'
                      from public.workspace_recordings where id = (select rec from t_ctx)),
    'un echec repousse de deux minutes');

  update public.workspace_recordings set next_attempt_at = now() where id = (select rec from t_ctx);
  perform public.claim_workspace_recordings(20);
  select jsonb_array_length(content->'content') into blocs from public.workspace_pages where id = (select page from t_ctx);
  perform public.record_workspace_recording_result((select rec from t_ctx), 'done',
    E'Bonjour à tous.\nOn pose le boîtier jeudi.', E'## Décisions\n- Poser le boîtier jeudi\n\n## Actions\n- Rappeler le client : Alice, mercredi');
  perform pg_temp.ok((select status = 'done' and transcript like 'Bonjour%' and transcribed_at is not null
                      from public.workspace_recordings where id = (select rec from t_ctx)), 'done : transcription et resume gardes');
  perform pg_temp.ok((select jsonb_array_length(content->'content') from public.workspace_pages where id = (select page from t_ctx)) = blocs + 9,
    'la page a recu ses blocs : titre, Résumé, 2 titres, 2 listes, Transcription, 2 paragraphes');
  perform pg_temp.ok((select search_text like '%Poser le boîtier jeudi%' and search_text like '%Bonjour à tous.%'
                      from public.workspace_pages where id = (select page from t_ctx)), 'le texte est indexe pour la recherche');
  perform pg_temp.ok((select content->'content'->blocs->'content'->0->>'text' like 'Réunion du matin — %'
                      from public.workspace_pages where id = (select page from t_ctx)), 'le bloc porte le titre et la date');
  perform pg_temp.ok((select count(*) from public.workspace_page_revisions where page_id = (select page from t_ctx)) >= 1,
    'une revision de la page a ete prise');

  perform public.record_workspace_recording_result((select rec3 from t_ctx), 'quota', null, null, 'Quota de minutes épuisé.');
  perform pg_temp.ok((select status = 'failed' and error like 'Quota%' from public.workspace_recordings where id = (select rec3 from t_ctx)),
    'quota : abandon immediat, avec le motif');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — la purge ==='; end $$;
-- =============================================================================

do $$ begin
  perform pg_temp.ok((select count(*) from public.claim_workspace_audio_purges(100) x where x.id = (select rec from t_ctx)) = 0,
    'un audio recent n''est pas a purger');
  update public.workspace_recordings set created_at = now() - interval '31 days' where id = (select rec from t_ctx);
  perform pg_temp.ok((select count(*) from public.claim_workspace_audio_purges(100) x where x.id = (select rec from t_ctx)) = 1,
    'apres 30 jours, il l''est');
  perform public.mark_workspace_audio_deleted((select rec from t_ctx));
  perform pg_temp.ok((select audio_deleted_at is not null and transcript is not null from public.workspace_recordings where id = (select rec from t_ctx)),
    'l''audio est marque efface, la transcription reste');
  perform pg_temp.ok((select count(*) from public.claim_workspace_audio_purges(100) x where x.id = (select rec from t_ctx)) = 0,
    'et il n''est plus a purger');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 6 — visibilite ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.ok((select count(*) from public.workspace_recordings where page_id = (select page from t_ctx)) = 3,
  'l''auteur voit ses trois enregistrements');
delete from public.workspace_recordings where id = (select rec2 from t_ctx);
select pg_temp.ok((select count(*) from public.workspace_recordings where id = (select rec2 from t_ctx)) = 0, 'l''auteur supprime le sien');
reset role;
select pg_temp.login('patron_b'); set local role authenticated;
select pg_temp.ok((select count(*) from public.workspace_recordings) = 0 and (select count(*) from public.ai_transcription_usage) = 0,
  'l''entreprise B ne voit ni enregistrement ni consommation de A');
select pg_temp.refuses($q$select * from public.claim_workspace_recordings(1)$q$, 'un client ne tire pas');
select pg_temp.refuses(format($q$select public.reserve_transcription_minutes(%L)$q$, (select rec from t_ctx)), 'ni ne reserve');
reset role;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;
