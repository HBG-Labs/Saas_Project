-- =============================================================================
-- Workspace : `updated_by` ne bouge que si le contenu bouge
-- =============================================================================
--
-- La migration 20260929090000 posait `updated_by = auth.uid()` à chaque
-- modification d'une page — un simple déplacement (position, page parente)
-- inscrivait donc la personne comme dernier auteur. La révision archivée
-- ensuite portait ce faux auteur : « écrite par X » alors que X n'avait fait
-- que ranger la page.
--
-- Trouvé par la suite 20, partie 4, à sa première exécution.
--
-- Déplacer une page n'est pas l'écrire. `updated_by` suit désormais le même
-- critère que le trigger de révision : le titre ou le contenu a changé.
-- `updated_at`, lui, continue de bouger à chaque modification — c'est lui qui
-- garde `save_workspace_page` honnête, et un déplacement concurrent DOIT faire
-- échouer un enregistrement fondé sur une lecture antérieure.
--
-- Redéfinition seule : ni table, ni politique, ni droit ne changent.
-- =============================================================================

create or replace function app.guard_workspace_page()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_space_org  uuid;
  v_parent     public.workspace_pages%rowtype;
begin
  select organization_id into v_space_org from public.workspace_spaces where id = new.space_id;
  if v_space_org is null then
    raise exception 'Espace introuvable.' using errcode = 'foreign_key_violation';
  end if;
  new.organization_id := v_space_org;

  if tg_op = 'UPDATE' and new.space_id <> old.space_id then
    raise exception 'Une page ne change pas d''espace.' using errcode = 'restrict_violation';
  end if;

  if new.parent_page_id is not null then
    select * into v_parent from public.workspace_pages where id = new.parent_page_id;
    if not found or v_parent.space_id <> new.space_id then
      raise exception 'La page parente doit être du même espace.' using errcode = 'restrict_violation';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
    new.updated_by := (select auth.uid());
  elsif old.title is distinct from new.title or old.content is distinct from new.content then
    new.updated_by := (select auth.uid());
  end if;

  return new;
end;
$$;

revoke all on function app.guard_workspace_page() from public, anon, authenticated;
