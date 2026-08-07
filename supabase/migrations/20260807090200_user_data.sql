-- =============================================================================
-- Données propres à l'utilisateur : favoris et historique
-- =============================================================================
-- Ces tables sont strictement cloisonnées : chaque utilisateur n'accède qu'à
-- ses propres lignes, en lecture comme en écriture.
-- =============================================================================

create table public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  tool_id    uuid not null references public.tools (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tool_id)
);

-- La clé primaire composite indexe déjà (user_id, tool_id) : pas d'index
-- supplémentaire nécessaire pour « les favoris de l'utilisateur X ».

create table public.tool_history (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool_id uuid not null references public.tools (id) on delete cascade,
  used_at timestamptz not null default now()
);

-- Requête dominante : « les N derniers outils utilisés par X ».
create index tool_history_user_used_idx on public.tool_history (user_id, used_at desc);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.favorites enable row level security;
alter table public.tool_history enable row level security;

-- `with check` sur l'insertion : sans lui, un client pourrait écrire une ligne
-- au nom d'un autre utilisateur.
create policy "favorites_select_own"
  on public.favorites for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "favorites_insert_own"
  on public.favorites for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "favorites_delete_own"
  on public.favorites for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Pas de politique `update` : un favori se crée ou se supprime, il ne se
-- modifie pas.

create policy "tool_history_select_own"
  on public.tool_history for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "tool_history_insert_own"
  on public.tool_history for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "tool_history_delete_own"
  on public.tool_history for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Pas de politique `update` : l'historique est en ajout seul. Autoriser la
-- modification d'une entrée passée n'aurait aucun sens métier et ouvrirait une
-- surface d'écriture inutile.
