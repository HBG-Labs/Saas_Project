-- =============================================================================
-- 35 — Workspace : espacement de note et relance sûre de transcription
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron', '00000000-0000-4000-8000-000000350001'),
  ('tech_a', '00000000-0000-4000-8000-000000350002'),
  ('tech_b', '00000000-0000-4000-8000-000000350003');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, page uuid, rec uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id)
values (pg_temp.organisation_abonnee('voice-ux', 'Voice UX', 'patron', 'pro'));
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_b', 'technician') from t_ctx;

-- Une ancienne page (aucune valeur explicitement fournie) reçoit Normal.
select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare s public.workspace_spaces; p uuid; r public.workspace_recordings; org text; begin
  s := public.ensure_personal_workspace_space((select org_id from t_ctx));
  insert into public.workspace_pages (space_id, title)
  values (s.id, 'Compte-rendu terrain') returning id into p;
  select org_id::text into org from t_ctx;
  insert into public.workspace_recordings
    (page_id, audio_path, mime_type, duration_seconds, consent_confirmed_at)
  values
    (p, org || '/' || p || '/note.webm', 'audio/webm', 42, now())
  returning * into r;
  update t_ctx set page = p, rec = r.id;
end $$;

select pg_temp.ok(
  (select text_spacing = 'normal' from public.workspace_pages where id = (select page from t_ctx)),
  'une page sans preference utilise Normal'
);
update public.workspace_pages set text_spacing = 'compact' where id = (select page from t_ctx);
select pg_temp.ok(
  (select text_spacing = 'compact' from public.workspace_pages where id = (select page from t_ctx)),
  'le choix Compact est persiste'
);
select pg_temp.refuses(
  format($q$update public.workspace_pages set text_spacing = 'tasse' where id = %L$q$,
    (select page from t_ctx)),
  'une valeur hors Compact, Normal, Aere est refusee'
);
reset role;

-- Le worker a fini ses essais mais l'audio est toujours disponible.
update public.workspace_recordings
set status = 'failed', attempts = 6, error = 'Fournisseur indisponible'
where id = (select rec from t_ctx);

select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.ok(
  (select status = 'pending'
       and attempts = 0
       and error is null
       and next_attempt_at <= now()
   from public.retry_workspace_recording_transcription((select rec from t_ctx))),
  'l auteur relance sans recréer ni renvoyer son audio'
);
reset role;

-- Un collègue sans accès à la page personnelle ne peut pas relancer.
update public.workspace_recordings set status = 'failed' where id = (select rec from t_ctx);
select pg_temp.login('tech_b'); set local role authenticated;
select pg_temp.refuses(
  format($q$select public.retry_workspace_recording_transcription(%L)$q$,
    (select rec from t_ctx)),
  'un autre technicien ne relance pas une note privée'
);
reset role;

-- Une fois l'audio purgé, aucune fausse promesse de nouvelle transcription.
update public.workspace_recordings
set audio_deleted_at = now(), status = 'failed'
where id = (select rec from t_ctx);
select pg_temp.login('tech_a'); set local role authenticated;
select pg_temp.refuses(
  format($q$select public.retry_workspace_recording_transcription(%L)$q$,
    (select rec from t_ctx)),
  'un audio efface ne peut pas etre relance'
);
reset role;

select 'TOUS LES TESTS PASSENT' as resultat;
rollback;
