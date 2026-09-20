-- =============================================================================
-- Correctif Workspace v2 : une révision reste lisible après la page
-- =============================================================================
--
-- LE DÉFAUT (trouvé par la suite 20 contre la base réelle, 20/09/2026)
--
-- Les révisions n'ont pas de clé étrangère vers la page : elles doivent lui
-- survivre (20260929090000, §8). La politique posée par 20261003090000 décidait
-- pourtant de leur visibilité EN PASSANT PAR LA PAGE
-- (`app.workspace_page_visible(page_id)`) : page supprimée, révision invisible.
-- Les données étaient intactes ; la lecture se fermait.
--
-- LA CORRECTION
--
-- La révision porte son espace. Le trigger d'archivage le pose au moment où la
-- version est archivée ; l'historique est rempli depuis les pages encore là.
-- La visibilité se lit alors sur l'espace, comme pour une page : une révision
-- de page privée reste privée, une révision de page supprimée reste lisible
-- par qui voyait l'espace. Une révision sans espace ne peut être qu'antérieure
-- aux espaces personnels — donc d'un espace partagé : `workspace.view` suffit.
-- =============================================================================

alter table public.workspace_page_revisions
  add column space_id uuid;

update public.workspace_page_revisions r
set space_id = p.space_id
from public.workspace_pages p
where p.id = r.page_id and r.space_id is null;

create index workspace_page_revisions_space_idx on public.workspace_page_revisions (space_id);

create or replace function app.archive_workspace_page_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.title is not distinct from new.title
     and old.content is not distinct from new.content then
    return new;
  end if;

  insert into public.workspace_page_revisions
    (organization_id, page_id, space_id, title, content, authored_by, authored_at, replaced_by)
  values
    (old.organization_id, old.id, old.space_id, old.title, old.content, old.updated_by, old.updated_at, (select auth.uid()));

  return coalesce(new, old);
end;
$$;

drop policy workspace_page_revisions_select on public.workspace_page_revisions;
create policy workspace_page_revisions_select on public.workspace_page_revisions for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'workspace'))
     and (select app.has_org_permission(organization_id, 'workspace.view'))
     and (space_id is null or (select app.workspace_space_visible(space_id))));

do $$
declare v int;
begin
  select count(*) into v from public.workspace_page_revisions r
  where r.space_id is null and exists (select 1 from public.workspace_pages p where p.id = r.page_id);
  if v <> 0 then raise exception '% révision(s) d''une page existante sans espace.', v; end if;
end $$;
