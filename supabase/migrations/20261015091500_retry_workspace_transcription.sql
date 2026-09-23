-- Relance explicite d'une transcription en échec, sans renvoyer l'audio et
-- sans recréer une consommation : la réservation est idempotente par
-- recording_id. L'audio doit encore être présent.
create or replace function public.retry_workspace_recording_transcription(p_recording_id uuid)
returns public.workspace_recordings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recording public.workspace_recordings;
begin
  select * into v_recording
  from public.workspace_recordings
  where id = p_recording_id
  for update;

  if not found
     or (
       v_recording.created_by is distinct from (select auth.uid())
       and not app.has_org_permission(v_recording.organization_id, 'workspace.manage')
     ) then
    raise exception 'Enregistrement introuvable.' using errcode = 'no_data_found';
  end if;
  if v_recording.status <> 'failed' then
    raise exception 'Seule une transcription en échec peut être relancée.'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_recording.audio_deleted_at is not null then
    raise exception 'L’audio a été supprimé et ne peut plus être retranscrit.'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  update public.workspace_recordings
  set status = 'pending', attempts = 0, next_attempt_at = now(), locked_at = null, error = null
  where id = p_recording_id
  returning * into v_recording;

  perform app.write_audit_log(
    v_recording.organization_id,
    'workspace_recording.transcription_retried',
    'workspace_recording',
    v_recording.id,
    jsonb_build_object('page_id', v_recording.page_id)
  );

  return v_recording;
end;
$$;

revoke all on function public.retry_workspace_recording_transcription(uuid)
  from public, anon;
grant execute on function public.retry_workspace_recording_transcription(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
