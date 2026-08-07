-- =============================================================================
-- Profils utilisateurs
-- =============================================================================
-- `auth.users` est géré par Supabase et ne doit pas être modifié. `profiles`
-- porte les données applicatives de l'utilisateur, avec une relation 1-1.
-- =============================================================================

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Données de profil, une ligne par utilisateur authentifié.';

alter table public.profiles enable row level security;

-- -----------------------------------------------------------------------------
-- Politiques : un utilisateur ne voit et ne modifie que sa propre ligne.
--
-- `(select auth.uid())` plutôt que `auth.uid()` : Postgres évalue alors la
-- fonction une seule fois par requête (initplan) au lieu d'une fois par ligne.
-- -----------------------------------------------------------------------------
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Volontairement AUCUNE politique insert/delete :
--   • l'insertion est faite par le trigger ci-dessous (security definer) ;
--   • la suppression suit la cascade depuis auth.users.
-- Moindre privilège : ce que le client n'a pas besoin de faire, il ne peut pas
-- le faire.

-- -----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- `search_path` vide : empêche un schéma malveillant de détourner les appels
-- non qualifiés dans une fonction privilégiée.
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Maintien de updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
