-- =============================================================================
-- STT — réveiller le worker dès la soumission, le cron en filet
-- =============================================================================
--
-- Constat (21/09/2026) : pg_cron réveille le worker une fois par minute ; un
-- enregistrement soumis attend donc 0 à 60 s avant même que l'audio parte
-- chez le fournisseur. Ce fichier ajoute un réveil IMMÉDIAT : quand une ligne
-- passe à « pending », `app.trigger_transcription_worker()` est appelée —
-- même fonction, même Vault, même `net.http_post` asynchrone (envoyé après
-- la validation de la transaction, donc le worker voit bien la ligne).
--
-- Le cron reste : il rattrape les reprises après échec (next_attempt_at dans
-- le futur), les purges, et tout réveil qui aurait échoué. Un problème de
-- Vault ou de pg_net ne bloque jamais la soumission : l'erreur est avalée en
-- notice, la ligne est « pending », le cron la prendra.
--
-- Rollback : supabase/rollbacks/20261011090000_stt_reveil_immediat.down.sql
-- =============================================================================

create or replace function app.wake_transcription_worker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' and old.status is distinct from 'pending' and new.next_attempt_at <= now() then
    begin
      perform app.trigger_transcription_worker();
    exception when others then
      raise notice 'Réveil immédiat du worker impossible (%) : le cron prendra la ligne.', sqlerrm;
    end;
  end if;
  return null;
end;
$$;

revoke all on function app.wake_transcription_worker() from public, anon, authenticated;

drop trigger if exists workspace_recordings_wake_worker on public.workspace_recordings;
create trigger workspace_recordings_wake_worker
  after update of status on public.workspace_recordings
  for each row execute function app.wake_transcription_worker();

comment on trigger workspace_recordings_wake_worker on public.workspace_recordings is
  'Réveil immédiat du worker de transcription à la soumission ; le cron chaque minute reste le filet.';

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'workspace_recordings_wake_worker') then
    raise exception 'Le déclencheur de réveil n''est pas posé.';
  end if;
end $$;
