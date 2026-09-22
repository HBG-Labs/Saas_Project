-- Contrôles premium de l'éditeur de pages : identité visuelle, mode wiki et
-- préférences de notification propres à chaque utilisateur.
alter table public.workspace_pages
  add column accent_color text not null default 'blue'
    check (accent_color in ('blue', 'violet', 'emerald', 'amber', 'rose', 'slate')),
  add column wiki_mode boolean not null default false;

comment on column public.workspace_pages.accent_color is
  'Couleur d''accent de la page, choisie dans la palette sémantique REZO360.';
comment on column public.workspace_pages.wiki_mode is
  'Active la présentation en base de connaissances et la liste des sous-pages.';

-- `workspace_pages` utilise des droits UPDATE colonne par colonne. Les deux
-- nouveaux réglages restent ainsi modifiables sans élargir les droits au reste
-- de la ligne.
grant update (accent_color, wiki_mode) on public.workspace_pages to authenticated;

create table public.workspace_page_preferences (
  page_id uuid not null references public.workspace_pages(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  notification_level text not null default 'mentions'
    check (notification_level in ('off', 'mentions', 'all')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (page_id, user_id)
);

comment on table public.workspace_page_preferences is
  'Préférences personnelles d''une page : niveau de notifications par utilisateur.';

create index workspace_page_preferences_user_idx
  on public.workspace_page_preferences (user_id, updated_at desc);

create trigger workspace_page_preferences_set_updated_at
  before update on public.workspace_page_preferences
  for each row execute function public.set_updated_at();

alter table public.workspace_page_preferences enable row level security;

revoke all on table public.workspace_page_preferences from anon, authenticated;
grant select, insert, update, delete on table public.workspace_page_preferences to authenticated;
grant all on table public.workspace_page_preferences to service_role;

create policy workspace_page_preferences_select
  on public.workspace_page_preferences for select to authenticated
  using (
    user_id = (select auth.uid())
    and (select app.workspace_page_visible(page_id))
  );

create policy workspace_page_preferences_insert
  on public.workspace_page_preferences for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select app.workspace_page_visible(page_id))
  );

create policy workspace_page_preferences_update
  on public.workspace_page_preferences for update to authenticated
  using (
    user_id = (select auth.uid())
    and (select app.workspace_page_visible(page_id))
  )
  with check (
    user_id = (select auth.uid())
    and (select app.workspace_page_visible(page_id))
  );

create policy workspace_page_preferences_delete
  on public.workspace_page_preferences for delete to authenticated
  using (
    user_id = (select auth.uid())
    and (select app.workspace_page_visible(page_id))
  );

notify pgrst, 'reload schema';
