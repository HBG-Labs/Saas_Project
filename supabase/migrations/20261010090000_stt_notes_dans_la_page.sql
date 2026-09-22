-- =============================================================================
-- STT phase 9 — les notes de la personne rejoignent la page
-- =============================================================================
--
-- Additive. La colonne `notes` existe depuis 20261006090000 (≤ 20 000
-- caractères, écrite par l'auteur ou `workspace.manage`, jamais lue par le
-- worker ni transmise au fournisseur). Ce que ça change : quand la
-- transcription aboutit, les notes tapées pendant l'enregistrement sont
-- écrites dans la page sous « Notes », avant le résumé et la transcription
-- — notes, résumé et texte au même endroit. La colonne reste la source ;
-- la page en reçoit une copie à cet instant, comme pour le texte.
--
-- Rien d'autre ne bouge : même signature, même comportement sans notes.
--
-- Rollback : supabase/rollbacks/20261010090000_stt_notes_dans_la_page.down.sql
-- =============================================================================

-- Même signature qu'en phase 8 : `create or replace` suffit, rien à retirer.

create or replace function public.record_workspace_recording_result(
  p_id uuid,
  p_outcome text,
  p_transcript text default null,
  p_summary text default null,
  p_error text default null,
  p_engine text default null,
  p_raw text default null,
  p_normalization jsonb default null,
  p_segments jsonb default null,
  p_summary_json jsonb default null
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
  v_texte_page text;
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
  if p_segments is not null and jsonb_typeof(p_segments) <> 'array' then
    raise exception 'Les segments doivent être un tableau.' using errcode = 'check_violation';
  end if;
  if p_summary_json is not null and jsonb_typeof(p_summary_json) <> 'object' then
    raise exception 'Le résumé structuré doit être un objet.' using errcode = 'check_violation';
  end if;

  select * into v_rec from public.workspace_recordings where id = p_id for update;
  if not found then return; end if;
  v_attempts := v_rec.attempts + 1;

  if p_outcome = 'done' then
    -- Avec segments : un paragraphe par segment, dans l'ordre — ce que citent
    -- les « [§n] » du résumé. Sans : le texte tel quel.
    if p_segments is not null and jsonb_array_length(p_segments) > 0 then
      select string_agg(s->>'text', E'\n' order by ord) into v_texte_page
      from jsonb_array_elements(p_segments) with ordinality as t(s, ord);
    else
      v_texte_page := p_transcript;
    end if;

    v_when := to_char(v_rec.created_at at time zone coalesce(
      (select o.timezone from public.organizations o where o.id = v_rec.organization_id), 'Europe/Paris'), 'DD/MM/YYYY à HH24:MI');
    v_blocks := jsonb_build_array(jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 2),
                  'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_rec.title || ' — ' || v_when))))
             -- Les notes de la personne (phase 9), telles quelles, avant le résumé.
             || case when nullif(btrim(coalesce(v_rec.notes, '')), '') is null then '[]'::jsonb
                     else jsonb_build_array(jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 3),
                            'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Notes'))))
                          || app.text_to_tiptap_blocks(v_rec.notes) end
             || case when nullif(btrim(coalesce(p_summary, '')), '') is null then '[]'::jsonb
                     else jsonb_build_array(jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 3),
                            'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Résumé'))))
                          || app.text_to_tiptap_blocks(p_summary) end
             || jsonb_build_array(jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 3),
                  'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Transcription'))))
             || app.text_to_tiptap_blocks(coalesce(nullif(btrim(coalesce(v_texte_page, '')), ''), '(aucune parole détectée)'));

    update public.workspace_pages
    set content = jsonb_set(content, '{content}', coalesce(content->'content', '[]'::jsonb) || v_blocks),
        updated_by = v_rec.created_by
    where id = v_rec.page_id;

    update public.workspace_recordings
    set status = 'done', transcript = p_transcript, summary = p_summary, error = null,
        transcript_raw = coalesce(transcript_raw, p_raw, p_transcript),
        transcript_normalized_at = case when v_normalized then now() else null end,
        normalization_diff = p_normalization,
        segments = p_segments,
        summary_json = p_summary_json,
        engine = coalesce(p_engine, engine),
        attempts = v_attempts, locked_at = null, transcribed_at = now()
    where id = p_id;

    perform app.write_audit_log(v_rec.organization_id, 'workspace_recording.transcribed', 'workspace_recording', p_id,
      jsonb_build_object('page_id', v_rec.page_id, 'duration_seconds', v_rec.duration_seconds, 'engine', p_engine,
                         'normalized', v_normalized,
                         'replacements', case when v_normalized then jsonb_array_length(p_normalization) else null end,
                         'segments', case when p_segments is not null then jsonb_array_length(p_segments) else null end,
                         'structured_summary', p_summary_json is not null,
                         'with_notes', nullif(btrim(coalesce(v_rec.notes, '')), '') is not null));
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

revoke all on function public.record_workspace_recording_result(uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_workspace_recording_result(uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb) to service_role;

do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'record_workspace_recording_result') <> 1 then
    raise exception 'record_workspace_recording_result doit exister en une seule surcharge.';
  end if;
end $$;
