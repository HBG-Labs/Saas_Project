-- =============================================================================
-- Consigner sans rattacher, quand l'organisation n'existe plus
-- =============================================================================
--
-- LE CONSTAT
--
--   DELETE FROM organizations WHERE id = ...
--   → 23503 violates foreign key constraint "audit_logs_organization_id_fkey"
--
-- Troisième et dernier obstacle sur ce chemin, après `protect_last_owner` et
-- l'immuabilité du journal.
--
-- POURQUOI
--
-- Supprimer une organisation cascade sur ses membres, équipes, clients et
-- missions. Chacune de ces suppressions déclenche son trigger d'audit
-- (`organization_members_audit`, `teams_audit`, `customers_audit`,
-- `missions_audit`), qui appelle `app.write_audit_log` avec l'identifiant de
-- l'organisation. Or celle-ci vient d'être supprimée : l'insertion viole la clé
-- étrangère, et toute la suppression échoue.
--
-- LA CORRECTION
--
-- Le journal enregistre, mais sans rattacher. `organization_id` passe à NULL
-- quand l'organisation a disparu — exactement l'état que la migration
-- `20260813100200` a rendu possible pour les lignes existantes.
--
-- L'alternative aurait été de ne rien écrire du tout pendant une suppression en
-- cascade. Elle est plus simple, mais elle perd la trace du démantèlement — le
-- moment précis où l'on aimerait le plus savoir ce qui a disparu. Une ligne
-- détachée est moins commode qu'une ligne rattachée ; elle vaut infiniment mieux
-- qu'une ligne absente.
-- =============================================================================

create or replace function app.write_audit_log(
  p_organization_id uuid,
  p_action          text,
  p_entity_type     text,
  p_entity_id       uuid,
  p_metadata        jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_label text;
  v_org   uuid := p_organization_id;
begin
  -- L'organisation a-t-elle encore une existence ? Pendant une suppression en
  -- cascade, la ligne parente est déjà partie quand ses filles s'effacent.
  if v_org is not null
     and not exists (select 1 from public.organizations o where o.id = v_org)
  then
    v_org := null;
  end if;

  select coalesce(p.display_name, u.email)
  into v_label
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_user;

  insert into public.audit_logs (organization_id, user_id, actor_label, action, entity_type, entity_id, metadata)
  values (v_org, v_user, v_label, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function app.write_audit_log(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
