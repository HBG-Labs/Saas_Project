-- =============================================================================
-- STT phase 7 — la normalisation contrôlée, et sa trace vérifiable
-- =============================================================================
--
-- Additive. Rien n'est retiré ; la reprise après échec et le moteur legacy
-- se comportent exactement comme avant.
--
-- Ce que ça change :
--
--   * `workspace_recordings.normalization_diff` (jsonb, tableau) — la liste
--     des remplacements faits pour passer du brut (`transcript_raw`) au texte
--     de travail (`transcript`) : [{ de, vers, occurrences, couche }]. C'est
--     la preuve : on peut, à la main ou par script, repartir du brut et
--     vérifier le texte. Vide = une passe a eu lieu, rien n'a changé.
--
--   * `record_workspace_recording_result` apprend deux paramètres :
--     `p_raw` (ce que le moteur a rendu, tel quel) et `p_normalization`
--     (la liste ci-dessus). Quand ils sont donnés, `transcript` reçoit le
--     texte normalisé, `transcript_raw` le brut, `transcript_normalized_at`
--     l'instant. Quand ils manquent (legacy, ou v2 sans passe) : comme avant,
--     brut = texte, rien de normalisé.
--
--   * une contrainte garantit qu'un texte marqué normalisé a toujours son
--     brut à côté : « je dois toujours pouvoir retrouver le transcript
--     original ». Le brut reste immuable (garde de 20261006090000).
--
-- Ce qui est FAIT au texte, et rien d'autre, est décidé dans
-- supabase/functions/_shared/transcript-normalize.ts : la graphie des termes
-- connus (dictionnaire de l'organisation, glossaire du secteur) et, sous
-- contrainte, la substitution d'un mot mal entendu par un terme connu.
-- Jamais de reformulation. La base ne juge pas le contenu ; elle en garde
-- la trace.
--
-- Rollback : supabase/rollbacks/20261008090000_stt_normalisation.down.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. La trace
-- -----------------------------------------------------------------------------
alter table public.workspace_recordings
  add column if not exists normalization_diff jsonb;

alter table public.workspace_recordings
  add constraint workspace_recordings_normalization_diff_array
    check (normalization_diff is null or jsonb_typeof(normalization_diff) = 'array'),
  add constraint workspace_recordings_normalized_has_raw
    check (transcript_normalized_at is null or (transcript_raw is not null and normalization_diff is not null));

comment on column public.workspace_recordings.normalization_diff is
  'Remplacements appliqués entre transcript_raw et transcript : [{de, vers, occurrences, couche}]. Null = pas de passe de normalisation ; [] = passe sans changement.';
comment on column public.workspace_recordings.transcript_normalized_at is
  'Instant de la passe de normalisation contrôlée (phase 7). Null si le texte est le brut tel quel.';

-- -----------------------------------------------------------------------------
-- 2. Le résultat apprend le brut et la trace
-- -----------------------------------------------------------------------------
-- Ancienne signature retirée : deux surcharges à paramètres nommés seraient
-- ambiguës pour PostgREST.
drop function if exists public.record_workspace_recording_result(uuid, text, text, text, text, text);

create or replace function public.record_workspace_recording_result(
  p_id uuid,
  p_outcome text,
  p_transcript text default null,
  p_summary text default null,
  p_error text default null,
  p_engine text default null,
  p_raw text default null,
  p_normalization jsonb default null
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
  v_normalized boolean := p_normalization is not null;
begin
  if p_outcome not in ('done', 'error', 'quota', 'rejected') then
    raise exception 'Résultat inconnu : %', p_outcome using errcode = 'check_violation';
  end if;
  if v_normalized and jsonb_typeof(p_normalization) <> 'array' then
    raise exception 'La trace de normalisation doit être un tableau.' using errcode = 'check_violation';
  end if;
  if v_normalized and p_raw is null then
    raise exception 'Un texte normalisé exige son brut.' using errcode = 'check_violation';
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

    -- Le brut : celui du moteur si on l'a, sinon le texte (legacy) ; jamais
    -- réécrit s'il existe déjà (reprise) — le garde le refuserait.
    update public.workspace_recordings
    set status = 'done', transcript = p_transcript, summary = p_summary, error = null,
        transcript_raw = coalesce(transcript_raw, p_raw, p_transcript),
        transcript_normalized_at = case when v_normalized then now() else null end,
        normalization_diff = p_normalization,
        engine = coalesce(p_engine, engine),
        attempts = v_attempts, locked_at = null, transcribed_at = now()
    where id = p_id;

    perform app.write_audit_log(v_rec.organization_id, 'workspace_recording.transcribed', 'workspace_recording', p_id,
      jsonb_build_object('page_id', v_rec.page_id, 'duration_seconds', v_rec.duration_seconds, 'engine', p_engine,
                         'normalized', v_normalized,
                         'replacements', case when v_normalized then jsonb_array_length(p_normalization) else null end));
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

revoke all on function public.record_workspace_recording_result(uuid, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_workspace_recording_result(uuid, text, text, text, text, text, text, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- 3. Auto-vérification
-- -----------------------------------------------------------------------------
do $$
declare v int;
begin
  select count(*) into v from public.workspace_recordings where transcript_normalized_at is not null;
  if v <> 0 then raise exception '% enregistrement(s) déjà marqués normalisés avant la phase 7.', v; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'record_workspace_recording_result') <> 1 then
    raise exception 'record_workspace_recording_result doit exister en une seule surcharge.';
  end if;
end $$;
