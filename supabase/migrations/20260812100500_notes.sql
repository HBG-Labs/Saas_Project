-- =============================================================================
-- Bloc-notes personnel
-- =============================================================================
--
-- LE CONSTAT
--
-- Le bloc-notes écrivait dans `nexoratech_notes_<userId>_<role>`. Trois défauts,
-- du plus visible au plus gênant :
--
--   • les notes ne suivaient pas l'utilisateur d'un appareil à l'autre — le
--     technicien qui saisit un relevé sur son téléphone ne le retrouve pas sur
--     l'ordinateur du bureau ;
--   • la clé contenait le RÔLE : un changement de rôle faisait disparaître les
--     notes, sans les supprimer, ce qui est le plus déroutant des deux ;
--   • un simple `localStorage.clear()` les emportait toutes.
--
-- CE QUI N'EST PAS FAIT, DÉLIBÉRÉMENT
--
-- Aucune permission RBAC, aucun entitlement de plan. Une note personnelle
-- n'appartient ni à l'organisation ni à la hiérarchie : ni un dirigeant ni un
-- administrateur ne la lit. La policy tient donc en une condition —
-- `user_id = auth.uid()` — comme pour `favorites` et `tool_history`.
--
-- `organization_id` est NULLABLE et purement contextuel : il permet de séparer
-- les notes prises pour une entreprise de celles d'une autre lorsqu'on appartient
-- à plusieurs. Le bloc-notes reste accessible sans organisation.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'note_category') then
    create type public.note_category as enum ('technique', 'urgent', 'client', 'memo');
  end if;
end
$$;

create table if not exists public.notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  title           text not null default 'Nouvelle note' check (char_length(title) <= 200),
  content         text not null default '',
  category        public.note_category,
  is_pinned       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Le tri de l'écran : épinglées d'abord, puis les plus récemment modifiées.
-- L'index le sert directement plutôt que de faire trier PostgreSQL en mémoire.
create index if not exists notes_user_idx
  on public.notes (user_id, is_pinned desc, updated_at desc);

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Le propriétaire est imposé, pas déclaré
-- -----------------------------------------------------------------------------
--
-- La policy d'insertion contrôle déjà `user_id = auth.uid()`. Le trigger le
-- POSE en plus, ce qui évite au client d'avoir à le connaître et supprime la
-- seule façon de se tromper.
create or replace function app.enforce_note_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is not null then
    new.user_id := v_actor;
  end if;
  return new;
end;
$$;

drop trigger if exists notes_enforce_owner on public.notes;
create trigger notes_enforce_owner
  before insert on public.notes
  for each row execute function app.enforce_note_owner();

-- -----------------------------------------------------------------------------
-- Privilèges et RLS
-- -----------------------------------------------------------------------------
revoke all on public.notes from public, anon, authenticated;
grant select, insert, update, delete on public.notes to authenticated;

alter table public.notes enable row level security;

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own"
  on public.notes for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own"
  on public.notes for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own"
  on public.notes for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own"
  on public.notes for delete
  to authenticated
  using (user_id = (select auth.uid()));
