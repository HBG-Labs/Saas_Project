-- Espacement de lecture persistant, au niveau de la page.
--
-- Les migrations Workspace historiques sont immuables : cette évolution reste
-- additive et conserve « normal » pour toutes les pages déjà existantes.
alter table public.workspace_pages
  add column text_spacing text not null default 'normal'
    check (text_spacing in ('compact', 'normal', 'airy'));

comment on column public.workspace_pages.text_spacing is
  'Densité verticale du contenu TipTap : compact, normal ou airy.';

-- workspace_pages utilise des droits UPDATE colonne par colonne.
grant update (text_spacing) on table public.workspace_pages to authenticated;

notify pgrst, 'reload schema';
