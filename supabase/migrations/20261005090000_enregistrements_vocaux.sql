-- =============================================================================
-- Enregistrements vocaux : enregistrer dans une page, transcrire, résumer
-- =============================================================================
--
-- CE QUI EST DÉCIDÉ (arbitrages A–G du 20/09/2026, validés tels quels)
--
-- A. L'audio est capté dans le navigateur, déposé dans le bucket privé
--    `workspace-audio` (<org>/<page>/<enregistrement>), avec une ligne
--    `workspace_recordings`. Les règles du fichier sont celles de la page.
-- B. La transcription se fait EN TÂCHE DE FOND : une ligne en attente réveille
--    `transcription-worker` (pg_cron, même patron que les notifications), qui
--    appelle l'API OpenAI et écrit le texte DANS LA PAGE.
--    Écart avec l'arbitrage : pas de découpage des fichiers > 25 Mo côté
--    worker — découper de l'audio compressé demande un encodeur que
--    l'environnement Edge n'a pas. La limite est portée par le bucket
--    (25 Mo, soit ~60 min de voix en opus 48 kbit/s) et dite à l'écran.
-- C. Le résumé (points clés, décisions, actions) suit la transcription. Deux
--    quotas : le résumé compte une requête IA (`ai_assistant`) ; la
--    transcription compte ses minutes dans `ai_transcription_minutes`
--    (Pro 120, Business 600, Enterprise 3 000 ; Starter 0, Free sans ligne).
-- D. Enregistrer et transcrire : `ai.workspace`, sur une page visible.
--    Écouter : qui voit la page. Supprimer l'audio : l'auteur ou
--    `workspace.manage`.
-- E. Enregistrer des personnes est un acte RGPD : la ligne porte
--    `consent_confirmed_at`, posé par la personne qui enregistre (« les
--    participants sont informés »). L'AUDIO EST EFFACÉ APRÈS 30 JOURS ; la
--    transcription et le résumé restent dans la page — la page est le
--    document, l'audio n'est que la source.
-- F. Pas de diarisation, pas de direct, pas de traduction, pas de hors-ligne.
--
-- CE QUE LA BASE FAIT SEULE
--
-- Elle refuse d'enfiler sans minutes restantes (retour immédiat à l'écran),
-- réserve les minutes atomiquement pour le worker, écrit la transcription et
-- le résumé dans la page sous forme de blocs TipTap (une révision est prise
-- au passage), et marque l'audio à purger. Le worker ne fait que transcrire,
-- résumer et supprimer des fichiers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Le quota de minutes, par formule
-- -----------------------------------------------------------------------------
-- Pas de ligne pour Free : l'absence vaut refus (`app.org_has_feature`), comme
-- pour `ai_assistant`. Starter porte un 0 explicite, comme `ai_assistant`.
insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('starter',    'ai_transcription_minutes', 0),
  ('pro',        'ai_transcription_minutes', 120),
  ('business',   'ai_transcription_minutes', 600),
  ('enterprise', 'ai_transcription_minutes', 3000)
on conflict (plan_code, feature_key) do update set limit_value = excluded.limit_value;

-- La consommation, à la minute entamée.
create table public.ai_transcription_usage (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid references auth.users (id) on delete set null,
  recording_id     uuid not null,
  minutes          integer not null check (minutes > 0),
  created_at       timestamptz not null default now()
);

create index ai_transcription_usage_month_idx on public.ai_transcription_usage (organization_id, created_at);

alter table public.ai_transcription_usage enable row level security;
revoke all on table public.ai_transcription_usage from public, anon, authenticated;
grant select on table public.ai_transcription_usage to authenticated;
grant all on table public.ai_transcription_usage to service_role;

create policy ai_transcription_usage_select on public.ai_transcription_usage for select to authenticated
  using ((select app.is_org_member(organization_id)));

/** Minutes consommées ce mois-ci, plafond, reste. Lisible par tout membre. */
create or replace function public.transcription_quota_status(p_organization_id uuid)
returns table (used_minutes integer, limit_minutes integer, remaining_minutes integer, unlimited boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with u as (
    select coalesce(sum(minutes), 0)::integer as used
    from public.ai_transcription_usage
    where organization_id = p_organization_id and created_at >= date_trunc('month', now())
  ), l as (
    select app.org_feature_limit(p_organization_id, 'ai_transcription_minutes') as lim,
           app.org_has_feature(p_organization_id, 'ai_transcription_minutes') as has
  )
  select u.used,
         case when not l.has then 0 else l.lim end,
         case when not l.has then 0 when l.lim is null then null else greatest(l.lim - u.used, 0) end,
         l.has and l.lim is null
  from u, l
  where app.is_org_member(p_organization_id);
$$;

revoke all on function public.transcription_quota_status(uuid) from public, anon;
grant execute on function public.transcription_quota_status(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Les enregistrements
-- -----------------------------------------------------------------------------
create table public.workspace_recordings (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  page_id              uuid not null references public.workspace_pages (id) on delete cascade,
  created_by           uuid references auth.users (id) on delete set null,
  title                text not null default 'Enregistrement',
  audio_path           text not null,
  mime_type            text not null,
  size_bytes           integer check (size_bytes is null or size_bytes >= 0),
  duration_seconds     integer not null check (duration_seconds > 0 and duration_seconds <= 3600),
  language             text not null default 'fr',
  -- uploading : le fichier n'est pas encore là ; pending : à transcrire ;
  -- processing : le worker l'a pris ; done ; failed (avec `error`).
  status               text not null default 'uploading'
                         check (status in ('uploading', 'pending', 'processing', 'done', 'failed')),
  transcript           text,
  summary              text,
  error                text,
  consent_confirmed_at timestamptz not null,
  attempts             integer not null default 0 check (attempts >= 0),
  next_attempt_at      timestamptz not null default now(),
  locked_at            timestamptz,
  transcribed_at       timestamptz,
  -- Posé quand le fichier audio a été effacé (30 jours, ou suppression).
  audio_deleted_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint workspace_recordings_title_length check (length(btrim(title)) between 1 and 120),
  constraint workspace_recordings_audio_path_format check (audio_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'),
  constraint workspace_recordings_language_format check (language ~ '^[a-z]{2}$')
);

comment on table public.workspace_recordings is
  'Un enregistrement vocal attaché à une page : audio (30 jours), transcription et résumé (écrits dans la page).';

create index workspace_recordings_page_idx on public.workspace_recordings (page_id, created_at desc);
create index workspace_recordings_due_idx on public.workspace_recordings (next_attempt_at) where status = 'pending';
create index workspace_recordings_purge_idx on public.workspace_recordings (created_at) where audio_deleted_at is null;

create trigger workspace_recordings_set_updated_at
  before update on public.workspace_recordings
  for each row execute function public.set_updated_at();

/**
 * Le garde : l'organisation vient de la page ; l'auteur est la session ; le
 * chemin du fichier est <org>/<page>/… ; le consentement est posé ; et il
 * reste des minutes ce mois-ci — sinon, refus immédiat, avant tout envoi.
 */
create or replace function app.guard_workspace_recording()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_remaining integer;
  v_unlimited boolean;
begin
  select p.organization_id into v_org from public.workspace_pages p where p.id = new.page_id;
  if v_org is null then
    raise exception 'Page introuvable.' using errcode = 'foreign_key_violation';
  end if;
  new.organization_id := v_org;

  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by);
    new.status := 'uploading';
    new.transcript := null; new.summary := null; new.error := null;
    new.attempts := 0; new.locked_at := null; new.transcribed_at := null; new.audio_deleted_at := null;
    if new.audio_path !~ ('^' || v_org::text || '/' || new.page_id::text || '/') then
      raise exception 'Le fichier doit être rangé sous <organisation>/<page>/.' using errcode = 'check_violation';
    end if;
    if new.consent_confirmed_at is null then
      raise exception 'Confirmez que les personnes enregistrées sont informées.' using errcode = 'check_violation';
    end if;
    select remaining_minutes, unlimited into v_remaining, v_unlimited
    from public.transcription_quota_status(v_org);
    if not coalesce(v_unlimited, false) and coalesce(v_remaining, 0) <= 0 then
      raise exception 'Le quota de minutes de transcription de ce mois est épuisé.' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app.guard_workspace_recording() from public, anon, authenticated;

create trigger workspace_recordings_guard
  before insert or update on public.workspace_recordings
  for each row execute function app.guard_workspace_recording();

/** Le fichier est déposé : la transcription peut partir. */
create or replace function public.submit_workspace_recording(p_recording_id uuid, p_size_bytes integer default null)
returns public.workspace_recordings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.workspace_recordings;
begin
  select * into v_rec from public.workspace_recordings where id = p_recording_id for update;
  if not found or v_rec.created_by is distinct from (select auth.uid()) then
    raise exception 'Enregistrement introuvable.' using errcode = 'no_data_found';
  end if;
  if v_rec.status <> 'uploading' then
    return v_rec;
  end if;
  update public.workspace_recordings
  set status = 'pending', next_attempt_at = now(), size_bytes = coalesce(p_size_bytes, size_bytes)
  where id = p_recording_id
  returning * into v_rec;
  return v_rec;
end;
$$;

revoke all on function public.submit_workspace_recording(uuid, integer) from public, anon;
grant execute on function public.submit_workspace_recording(uuid, integer) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Le bucket
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-audio', 'workspace-audio', false, 26214400,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac'])
on conflict (id) do nothing;

create policy workspace_audio_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'workspace-audio'
     and (select app.can_use_pro_module(((storage.foldername(name))[1])::uuid, 'workspace'))
     and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'workspace.view'))
     and (select app.workspace_page_visible(((storage.foldername(name))[2])::uuid)));
create policy workspace_audio_storage_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'workspace-audio'
     and (select app.can_use_pro_module(((storage.foldername(name))[1])::uuid, 'workspace'))
     and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'ai.workspace'))
     and (select app.workspace_page_visible(((storage.foldername(name))[2])::uuid))
     -- Le fichier n'existe que pour une ligne déclarée par la session.
     and exists (select 1 from public.workspace_recordings r
                 where r.audio_path = storage.objects.name and r.created_by = (select auth.uid())));
create policy workspace_audio_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'workspace-audio'
     and exists (select 1 from public.workspace_recordings r
                 where r.audio_path = storage.objects.name
                   and (r.created_by = (select auth.uid())
                        or (select app.has_org_permission(r.organization_id, 'workspace.manage')))));

-- -----------------------------------------------------------------------------
-- 4. Le worker : réserver, tirer, écrire dans la page, rendre compte
-- -----------------------------------------------------------------------------
/** Réserve les minutes d'un enregistrement. Rien si le quota est épuisé. */
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
  v_minutes := greatest(1, ceil(v_rec.duration_seconds / 60.0))::integer;

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

create or replace function public.claim_workspace_recordings(p_limit integer default 5)
returns table (
  id uuid, organization_id uuid, page_id uuid, created_by uuid, title text,
  audio_path text, mime_type text, duration_seconds integer, language text, attempts integer, created_at timestamptz
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
  select * from claimed;
end;
$$;

revoke all on function public.claim_workspace_recordings(integer) from public, anon, authenticated;
grant execute on function public.claim_workspace_recordings(integer) to service_role;

/**
 * Du texte en blocs TipTap : `#`/`##` en titres, `- ` en liste, le reste en
 * paragraphes. Assez pour poser une transcription et un résumé dans une page
 * sans dépendre de l'éditeur.
 */
create or replace function app.text_to_tiptap_blocks(p_text text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_blocks jsonb := '[]'::jsonb;
  v_items  jsonb := '[]'::jsonb;
  v_line   text;
  v_body   text;
begin
  for v_line in select unnest(string_to_array(coalesce(p_text, ''), E'\n')) loop
    v_line := btrim(v_line);
    if v_line = '' then
      if jsonb_array_length(v_items) > 0 then
        v_blocks := v_blocks || jsonb_build_object('type', 'bulletList', 'content', v_items); v_items := '[]'::jsonb;
      end if;
      continue;
    end if;
    if v_line ~ '^#{1,3}\s' then
      if jsonb_array_length(v_items) > 0 then
        v_blocks := v_blocks || jsonb_build_object('type', 'bulletList', 'content', v_items); v_items := '[]'::jsonb;
      end if;
      v_body := btrim(regexp_replace(v_line, '^#+\s*', ''));
      v_blocks := v_blocks || jsonb_build_object('type', 'heading',
        'attrs', jsonb_build_object('level', least(length(regexp_replace(v_line, '\s.*$', '')) + 1, 4)),
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_body)));
    elsif v_line ~ '^[-*•]\s' then
      v_body := btrim(regexp_replace(v_line, '^[-*•]\s*', ''));
      v_items := v_items || jsonb_build_object('type', 'listItem', 'content', jsonb_build_array(
        jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_body)))));
    else
      if jsonb_array_length(v_items) > 0 then
        v_blocks := v_blocks || jsonb_build_object('type', 'bulletList', 'content', v_items); v_items := '[]'::jsonb;
      end if;
      v_blocks := v_blocks || jsonb_build_object('type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_line)));
    end if;
  end loop;
  if jsonb_array_length(v_items) > 0 then
    v_blocks := v_blocks || jsonb_build_object('type', 'bulletList', 'content', v_items);
  end if;
  return v_blocks;
end;
$$;

revoke all on function app.text_to_tiptap_blocks(text) from public, anon;
grant execute on function app.text_to_tiptap_blocks(text) to authenticated, service_role;

/**
 * Le résultat d'une tentative. « done » écrit résumé et transcription dans la
 * page (une révision est prise par le trigger de la page) ; « error » repousse
 * avec recul (2, 4, 8… min, plafond 1 h) et abandonne au sixième ; « quota »
 * et « rejected » abandonnent tout de suite, avec le motif.
 */
create or replace function public.record_workspace_recording_result(
  p_id uuid,
  p_outcome text,
  p_transcript text default null,
  p_summary text default null,
  p_error text default null
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
        attempts = v_attempts, locked_at = null, transcribed_at = now()
    where id = p_id;

    perform app.write_audit_log(v_rec.organization_id, 'workspace_recording.transcribed', 'workspace_recording', p_id,
      jsonb_build_object('page_id', v_rec.page_id, 'duration_seconds', v_rec.duration_seconds));
    return;
  end if;

  update public.workspace_recordings
  set attempts = v_attempts, locked_at = null, error = left(p_error, 500),
      status = case when p_outcome in ('quota', 'rejected') or v_attempts >= 6 then 'failed' else 'pending' end,
      next_attempt_at = case when p_outcome = 'error' and v_attempts < 6
                             then now() + least(power(2, v_attempts)::int * interval '1 minute', interval '1 hour')
                             else next_attempt_at end
  where id = p_id;
end;
$$;

revoke all on function public.record_workspace_recording_result(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_workspace_recording_result(uuid, text, text, text, text) to service_role;

-- La purge : l'audio des enregistrements de plus de 30 jours, ou supprimés.
-- Le fichier se supprime par l'API Storage (le worker) ; la base ne fait que
-- désigner et marquer.
create or replace function public.claim_workspace_audio_purges(p_limit integer default 20)
returns table (id uuid, audio_path text)
language sql
security definer
set search_path = ''
as $$
  select r.id, r.audio_path
  from public.workspace_recordings r
  where r.audio_deleted_at is null
    and r.status in ('done', 'failed')
    and r.created_at < now() - interval '30 days'
  order by r.created_at
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.claim_workspace_audio_purges(integer) from public, anon, authenticated;
grant execute on function public.claim_workspace_audio_purges(integer) to service_role;

create or replace function public.mark_workspace_audio_deleted(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.workspace_recordings set audio_deleted_at = now() where id = p_id and audio_deleted_at is null;
$$;

revoke all on function public.mark_workspace_audio_deleted(uuid) from public, anon, authenticated;
grant execute on function public.mark_workspace_audio_deleted(uuid) to service_role;

create table public.transcription_worker_runs (
  id          bigint generated always as identity primary key,
  ran_at      timestamptz not null default now(),
  attempted   integer not null default 0 check (attempted >= 0),
  done        integer not null default 0 check (done >= 0),
  failed      integer not null default 0 check (failed >= 0),
  purged      integer not null default 0 check (purged >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0)
);

alter table public.transcription_worker_runs enable row level security;
revoke all on table public.transcription_worker_runs from public, anon, authenticated;
grant select, insert on table public.transcription_worker_runs to service_role;
grant usage, select on sequence public.transcription_worker_runs_id_seq to service_role;

-- -----------------------------------------------------------------------------
-- 5. Le réveil planifié — Vault : transcription_worker_url / transcription_worker_secret
-- -----------------------------------------------------------------------------
create or replace function app.trigger_transcription_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text; v_secret text;
begin
  if not exists (select 1 from public.workspace_recordings where status = 'pending' and next_attempt_at <= now())
     and not exists (select 1 from public.workspace_recordings
                     where audio_deleted_at is null and status in ('done', 'failed') and created_at < now() - interval '30 days') then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'transcription_worker_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'transcription_worker_secret';
  if v_url is null or v_secret is null then
    raise notice 'Worker de transcription non configuré : renseignez transcription_worker_url et transcription_worker_secret dans Vault.';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000);
end;
$$;

revoke all on function app.trigger_transcription_worker() from public, anon, authenticated;

select cron.schedule('transcription-worker', '* * * * *', $$select app.trigger_transcription_worker()$$);

-- -----------------------------------------------------------------------------
-- 6. Droits
-- -----------------------------------------------------------------------------
alter table public.workspace_recordings enable row level security;
revoke all on table public.workspace_recordings from public, anon, authenticated;
grant select, insert, delete on public.workspace_recordings to authenticated;
grant update (title) on public.workspace_recordings to authenticated;
grant all on public.workspace_recordings to service_role;

create policy workspace_recordings_select on public.workspace_recordings for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'workspace'))
     and (select app.has_org_permission(organization_id, 'workspace.view'))
     and (select app.workspace_page_visible(page_id)));
create policy workspace_recordings_insert on public.workspace_recordings for insert to authenticated
  with check ((select app.can_use_pro_module(organization_id, 'workspace'))
          and (select app.has_org_permission(organization_id, 'ai.workspace'))
          and (select app.workspace_page_visible(page_id)));
create policy workspace_recordings_update on public.workspace_recordings for update to authenticated
  using (created_by = (select auth.uid()) or (select app.has_org_permission(organization_id, 'workspace.manage')))
  with check (created_by = (select auth.uid()) or (select app.has_org_permission(organization_id, 'workspace.manage')));
create policy workspace_recordings_delete on public.workspace_recordings for delete to authenticated
  using (created_by = (select auth.uid()) or (select app.has_org_permission(organization_id, 'workspace.manage')));

-- -----------------------------------------------------------------------------
-- 7. Auto-vérification
-- -----------------------------------------------------------------------------
do $$
declare v int; b jsonb;
begin
  select count(*) into v from public.plan_features where feature_key = 'ai_transcription_minutes';
  if v <> 4 then raise exception '% formule(s) avec un quota de transcription au lieu de 4 (Free n''a pas de ligne).', v; end if;
  select count(*) into v from pg_policy p join pg_class c on c.oid = p.polrelid where c.relname = 'objects' and p.polname like 'workspace_audio_%';
  if v <> 3 then raise exception '% politique(s) Storage au lieu de 3.', v; end if;
  b := app.text_to_tiptap_blocks(E'## Décisions\n- Poser le boîtier\n- Rappeler jeudi\n\nRAS.');
  if jsonb_array_length(b) <> 3 or b->0->>'type' <> 'heading' or b->1->>'type' <> 'bulletList' or b->2->>'type' <> 'paragraph' then
    raise exception 'La conversion texte → blocs TipTap ne rend pas ce qu''elle doit : %', b;
  end if;
end $$;
