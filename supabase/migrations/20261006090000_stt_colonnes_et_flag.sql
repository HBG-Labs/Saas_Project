-- =============================================================================
-- Transcription : le moteur par organisation, le brut immuable, les colonnes
-- des phases suivantes
-- =============================================================================
--
-- Phase 4 du chantier « reconnaissance vocale » (ordre validé le 21/09/2026).
-- Additive : rien n'est renommé ni retiré ; les enregistrements existants
-- gardent leurs valeurs (colonnes nulles, moteur « legacy »).
--
-- LE FLAG
--
-- `organizations.stt_engine` : « legacy » (la chaîne d'aujourd'hui :
-- gpt-4o-transcribe, repli whisper-1, sans contexte) ou « v2 » (le nouveau
-- moteur avec glossaire, phase 5). Par organisation, modifiable par qui met à
-- jour l'organisation, lu par le worker au tirage. Revenir en arrière, c'est
-- une valeur — pas un déploiement.
--
-- LE BRUT IMMUABLE
--
-- `transcript_raw` est ce que le moteur a rendu, tel quel. Posé une fois, il
-- ne bouge plus — un trigger le refuse à tout le monde, service_role compris.
-- `transcript` reste le texte de travail (normalisé plus tard, phase 7) ; on
-- pourra toujours remonter à l'original.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Le flag
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column stt_engine text not null default 'legacy'
    constraint organizations_stt_engine check (stt_engine in ('legacy', 'v2'));

comment on column public.organizations.stt_engine is
  'Moteur de transcription vocale : legacy (gpt-4o-transcribe, sans contexte) ou v2 (nouveau moteur + glossaire). Lu par le worker au tirage.';

-- -----------------------------------------------------------------------------
-- 2. Les colonnes
-- -----------------------------------------------------------------------------
alter table public.workspace_recordings
  add column engine text,
  add column transcript_raw text,
  add column transcript_normalized_at timestamptz,
  add column segments jsonb,
  add column summary_json jsonb,
  add column notes text,
  add constraint workspace_recordings_notes_length check (notes is null or length(notes) <= 20000),
  add constraint workspace_recordings_segments_array check (segments is null or jsonb_typeof(segments) = 'array'),
  add constraint workspace_recordings_summary_json_object check (summary_json is null or jsonb_typeof(summary_json) = 'object');

comment on column public.workspace_recordings.engine is 'Le modèle qui a transcrit (ex. gpt-4o-transcribe, gpt-transcribe, whisper-1).';
comment on column public.workspace_recordings.transcript_raw is 'La sortie brute du moteur. Immuable une fois posée.';
comment on column public.workspace_recordings.transcript_normalized_at is 'Quand `transcript` a été normalisé depuis `transcript_raw` (phase 7). NULL = identique au brut.';
comment on column public.workspace_recordings.segments is 'Paragraphes horodatés [{start, end, speaker, text}] (phase 8).';
comment on column public.workspace_recordings.summary_json is 'Résumé structuré avec renvois aux segments (phase 8).';
comment on column public.workspace_recordings.notes is 'Notes écrites pendant l''enregistrement par la personne ; jamais transmises au fournisseur (phase 9).';

-- Les enregistrements déjà transcrits (aucun en production le 21/09/2026,
-- mais la migration ne doit pas le supposer) : leur brut est le texte qu'ils
-- ont, puisque rien ne l'a jamais retouché.
update public.workspace_recordings
set transcript_raw = transcript, engine = coalesce(engine, 'gpt-4o-transcribe')
where transcript is not null and transcript_raw is null;

-- Les notes s'écrivent depuis l'écran ; le reste est au worker.
grant update (title, notes) on public.workspace_recordings to authenticated;

/** Le brut, une fois posé, ne change plus — pour personne. */
create or replace function app.guard_transcript_raw_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.transcript_raw is not null and new.transcript_raw is distinct from old.transcript_raw then
    raise exception 'La transcription brute est immuable.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke all on function app.guard_transcript_raw_immutable() from public, anon, authenticated;

create trigger workspace_recordings_transcript_raw_immutable
  before update of transcript_raw on public.workspace_recordings
  for each row execute function app.guard_transcript_raw_immutable();

-- -----------------------------------------------------------------------------
-- 3. Le tirage apprend le moteur de l'organisation
-- -----------------------------------------------------------------------------
drop function if exists public.claim_workspace_recordings(integer);

create or replace function public.claim_workspace_recordings(p_limit integer default 5)
returns table (
  id uuid, organization_id uuid, page_id uuid, created_by uuid, title text,
  audio_path text, mime_type text, duration_seconds integer, language text, attempts integer, created_at timestamptz,
  stt_engine text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select r.id
    from public.workspace_recordings r
    where r.status = 'pending' and r.next_attempt_at <= now()
      and (r.locked_at is null or r.locked_at < now() - interval '10 minutes')
    order by r.next_attempt_at, r.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 5), 1), 20)
  ), claimed as (
    update public.workspace_recordings r
       set locked_at = now(), status = 'processing'
      from candidates c
     where r.id = c.id
    returning r.id, r.organization_id, r.page_id, r.created_by, r.title, r.audio_path, r.mime_type,
              r.duration_seconds, r.language, r.attempts, r.created_at
  )
  select c.id, c.organization_id, c.page_id, c.created_by, c.title, c.audio_path, c.mime_type,
         c.duration_seconds, c.language, c.attempts, c.created_at, o.stt_engine
  from claimed c
  join public.organizations o on o.id = c.organization_id;
end;
$$;

revoke all on function public.claim_workspace_recordings(integer) from public, anon, authenticated;
grant execute on function public.claim_workspace_recordings(integer) to service_role;

-- -----------------------------------------------------------------------------
-- 4. Le résultat pose le brut et le moteur
-- -----------------------------------------------------------------------------
-- Même corps qu'avant, plus `p_engine` ; `transcript_raw` est posé s'il ne
-- l'était pas (une reprise après échec ne le réécrit pas). Ancienne signature
-- retirée : deux surcharges à paramètres nommés seraient ambiguës.
drop function if exists public.record_workspace_recording_result(uuid, text, text, text, text);

create or replace function public.record_workspace_recording_result(
  p_id uuid,
  p_outcome text,
  p_transcript text default null,
  p_summary text default null,
  p_error text default null,
  p_engine text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.workspace_recordings;
  v_attempts integer;
  v_blocks jsonb;
  v_when text;
begin
  if p_outcome not in ('done', 'error', 'quota', 'rejected') then
    raise exception 'Résultat inconnu : %', p_outcome using errcode = 'check_violation';
  end if;
  select * into v_rec from public.workspace_recordings where id = p_id for update;
  if not found then return; end if;
  v_attempts := v_rec.attempts + 1;

  if p_outcome = 'done' then
    v_when := to_char(v_rec.created_at at time zone coalesce(
      (select o.timezone from public.organizations o where o.id = v_rec.organization_id), 'Europe/Paris'), 'DD/MM/YYYY à HH24:MI');
    v_blocks := jsonb_build_array(jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 2),
                  'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_rec.title || ' — ' || v_when))))
             || case when nullif(btrim(coalesce(p_summary, '')), '') is null then '[]'::jsonb
                     else jsonb_build_array(jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 3),
                            'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Résumé'))))
                          || app.text_to_tiptap_blocks(p_summary) end
             || jsonb_build_array(jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 3),
                  'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Transcription'))))
             || app.text_to_tiptap_blocks(coalesce(nullif(btrim(coalesce(p_transcript, '')), ''), '(aucune parole détectée)'));

    update public.workspace_pages
    set content = jsonb_set(content, '{content}', coalesce(content->'content', '[]'::jsonb) || v_blocks),
        updated_by = v_rec.created_by
    where id = v_rec.page_id;

    update public.workspace_recordings
    set status = 'done', transcript = p_transcript, summary = p_summary, error = null,
        transcript_raw = coalesce(transcript_raw, p_transcript),
        engine = coalesce(p_engine, engine),
        attempts = v_attempts, locked_at = null, transcribed_at = now()
    where id = p_id;

    perform app.write_audit_log(v_rec.organization_id, 'workspace_recording.transcribed', 'workspace_recording', p_id,
      jsonb_build_object('page_id', v_rec.page_id, 'duration_seconds', v_rec.duration_seconds, 'engine', p_engine));
    return;
  end if;

  update public.workspace_recordings
  set attempts = v_attempts, locked_at = null, error = left(p_error, 500),
      engine = coalesce(p_engine, engine),
      status = case when p_outcome in ('quota', 'rejected') or v_attempts >= 6 then 'failed' else 'pending' end,
      next_attempt_at = case when p_outcome = 'error' and v_attempts < 6
                             then now() + least(power(2, v_attempts)::int * interval '1 minute', interval '1 hour')
                             else next_attempt_at end
  where id = p_id;
end;
$$;

revoke all on function public.record_workspace_recording_result(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_workspace_recording_result(uuid, text, text, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 5. Auto-vérification
-- -----------------------------------------------------------------------------
do $$
declare v int;
begin
  select count(*) into v from public.organizations where stt_engine <> 'legacy';
  if v <> 0 then raise exception '% organisation(s) déjà en v2 : le défaut doit être legacy.', v; end if;
  select count(*) into v from public.workspace_recordings where transcript is not null and transcript_raw is null;
  if v <> 0 then raise exception '% transcription(s) sans brut après reprise.', v; end if;
  if not exists (select 1 from pg_trigger where tgname = 'workspace_recordings_transcript_raw_immutable') then
    raise exception 'Le garde d''immuabilité n''est pas posé.';
  end if;
end $$;
