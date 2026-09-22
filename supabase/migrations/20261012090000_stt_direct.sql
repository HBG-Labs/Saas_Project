-- =============================================================================
-- STT phase 14 — la transcription en direct (pendant la parole)
-- =============================================================================
--
-- Deux passes, comme Notion : pendant la capture, le téléphone envoie l'audio
-- à OpenAI Realtime et affiche le texte au fil des mots (le DIRECT, un
-- brouillon) ; à l'arrêt, l'audio complet suit la chaîne existante — moteur,
-- contexte, normalisation, paragraphes, résumé cité — qui seule écrit dans
-- la page (la FINALE). La clé OpenAI ne quitte jamais le serveur : une
-- fonction Edge délivre un jeton éphémère après avoir vérifié ici que la
-- personne peut ouvrir un direct.
--
-- Ce que ce fichier ajoute, additivement :
--
--   * `workspace_recordings.transcript_live` — le brouillon, conservé pour
--     être montré si la finale échoue ; jamais résumé, jamais dans la page ;
--   * `workspace_recordings.live_used` — le direct a servi : la réservation
--     compte les minutes DEUX fois (direct + finale) — arbitrage du 22/09 ;
--   * `transcription_live_sessions` — un jeton délivré = une ligne
--     (organisation, personne, page, modèle, instant) : la trace du coût,
--     sans texte ; service_role seul ;
--   * `live_transcription_access(org, page)` — la porte : membre, permission
--     `ai.workspace`, module Workspace, page visible, moteur v2, au moins
--     2 minutes de quota. Rend aussi le secteur et la langue pour le contexte.
--
-- Rollback : supabase/rollbacks/20261012090000_stt_direct.down.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Les colonnes
-- -----------------------------------------------------------------------------
alter table public.workspace_recordings
  add column if not exists transcript_live text,
  add column if not exists live_used boolean not null default false;

alter table public.workspace_recordings
  add constraint workspace_recordings_transcript_live_length
    check (transcript_live is null or length(transcript_live) <= 200000);

comment on column public.workspace_recordings.transcript_live is
  'Brouillon du direct (OpenAI Realtime pendant la capture). Jamais résumé ni écrit dans la page ; montré si la finale échoue.';
comment on column public.workspace_recordings.live_used is
  'Le direct a servi pour cet enregistrement : les minutes sont réservées deux fois (direct + finale).';

-- -----------------------------------------------------------------------------
-- 2. La trace des jetons délivrés
-- -----------------------------------------------------------------------------
create table if not exists public.transcription_live_sessions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  page_id         uuid references public.workspace_pages(id) on delete set null,
  model           text not null,
  issued_at       timestamptz not null default now()
);
create index if not exists transcription_live_sessions_org_month_idx
  on public.transcription_live_sessions (organization_id, issued_at);
comment on table public.transcription_live_sessions is
  'Un jeton éphémère Realtime délivré = une ligne. Coût et audit ; aucun texte. Service_role seul.';

alter table public.transcription_live_sessions enable row level security;
revoke all on table public.transcription_live_sessions from public, anon, authenticated;
grant all on public.transcription_live_sessions to service_role;

-- -----------------------------------------------------------------------------
-- 3. La réservation compte le direct
-- -----------------------------------------------------------------------------
create or replace function public.reserve_transcription_minutes(p_recording_id uuid)
returns table (reserved boolean, reserved_minutes integer, remaining_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.workspace_recordings;
  v_minutes integer;
  v_used integer;
  v_limit integer;
  v_has boolean;
begin
  select * into v_rec from public.workspace_recordings where id = p_recording_id;
  if not found then return; end if;
  if exists (select 1 from public.ai_transcription_usage where recording_id = p_recording_id) then
    -- Déjà réservé (reprise après échec) : on ne compte pas deux fois.
    return query select true, u.minutes, null::integer from public.ai_transcription_usage u where u.recording_id = p_recording_id;
    return;
  end if;
  -- Le direct est une seconde transcription : deux fois les minutes.
  v_minutes := greatest(1, ceil(v_rec.duration_seconds / 60.0))::integer * case when v_rec.live_used then 2 else 1 end;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_rec.organization_id::text || ':transcription', 0));
  v_has := app.org_has_feature(v_rec.organization_id, 'ai_transcription_minutes');
  v_limit := app.org_feature_limit(v_rec.organization_id, 'ai_transcription_minutes');
  select coalesce(sum(u.minutes), 0)::integer into v_used
  from public.ai_transcription_usage u
  where u.organization_id = v_rec.organization_id and u.created_at >= date_trunc('month', now());

  if not v_has then
    return query select false, v_minutes, 0; return;
  end if;
  if v_limit is not null and v_used + v_minutes > v_limit then
    return query select false, v_minutes, greatest(v_limit - v_used, 0); return;
  end if;

  insert into public.ai_transcription_usage (organization_id, user_id, recording_id, minutes)
  values (v_rec.organization_id, v_rec.created_by, p_recording_id, v_minutes);
  return query select true, v_minutes, case when v_limit is null then null else v_limit - v_used - v_minutes end;
end;
$$;

revoke all on function public.reserve_transcription_minutes(uuid) from public, anon, authenticated;
grant execute on function public.reserve_transcription_minutes(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 4. La porte du direct
-- -----------------------------------------------------------------------------
create or replace function public.live_transcription_access(p_organization_id uuid, p_page_id uuid)
returns table (allowed boolean, reason text, industry text, language text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
  v_remaining integer;
  v_unlimited boolean;
begin
  -- Membre d'abord : rien n'est dit à qui n'est pas de la maison.
  if not app.is_org_member(p_organization_id) then
    return query select false, 'membership', null::text, null::text; return;
  end if;
  if not app.has_org_permission(p_organization_id, 'ai.workspace') then
    return query select false, 'permission', null::text, null::text; return;
  end if;
  if not app.can_use_pro_module(p_organization_id, 'workspace') then
    return query select false, 'module', null::text, null::text; return;
  end if;
  if not exists (select 1 from public.workspace_pages p where p.id = p_page_id and p.organization_id = p_organization_id)
     or not app.workspace_page_visible(p_page_id) then
    return query select false, 'page', null::text, null::text; return;
  end if;
  select * into v_org from public.organizations o where o.id = p_organization_id;
  if v_org.stt_engine <> 'v2' then
    return query select false, 'engine', null::text, null::text; return;
  end if;
  select q.remaining_minutes, q.unlimited into v_remaining, v_unlimited
  from public.transcription_quota_status(p_organization_id) q;
  if not coalesce(v_unlimited, false) and coalesce(v_remaining, 0) < 2 then
    return query select false, 'quota', null::text, null::text; return;
  end if;
  return query select true, null::text, v_org.industry::text, 'fr'::text;
end;
$$;

revoke all on function public.live_transcription_access(uuid, uuid) from public, anon;
grant execute on function public.live_transcription_access(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Auto-vérification
-- -----------------------------------------------------------------------------
do $$
begin
  if (select count(*) from public.workspace_recordings where live_used) <> 0 then
    raise exception 'live_used doit être faux sur tout l''existant.';
  end if;
end $$;
