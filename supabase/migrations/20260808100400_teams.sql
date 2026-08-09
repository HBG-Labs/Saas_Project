-- =============================================================================
-- Équipes
-- =============================================================================
-- Structure demandée par le §7 :
--
--     Entreprise
--     ├── Équipe Fibre Optique  → chef d'équipe + techniciens
--     ├── Équipe Réseaux        → techniciens
--     └── Équipe Électricité    → techniciens
--
-- Un membre peut appartenir à PLUSIEURS équipes : sur le terrain, un technicien
-- polyvalent renforce l'équipe fibre le lundi et l'équipe réseaux le jeudi.
-- Restreindre à une seule équipe obligerait à dupliquer son compte.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_member_role') then
    -- Rôle DANS L'ÉQUIPE, distinct du rôle dans l'organisation. Un même
    -- technicien peut être chef de l'équipe fibre et simple membre de l'équipe
    -- réseaux, sans que son rôle organisationnel change.
    create type public.team_member_role as enum ('lead', 'member');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- teams
-- -----------------------------------------------------------------------------
create table if not exists public.teams (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  name            text not null check (char_length(name) between 2 and 100),
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description     text,
  color           text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),

  -- Spécialité de l'équipe, rattachée au catalogue. `on delete set null` : la
  -- disparition d'une catégorie ne doit pas emporter l'équipe.
  category_id     uuid references public.categories (id) on delete set null,

  -- Responsable. Référence `organization_members` et non `auth.users` :
  -- un manager doit nécessairement être membre de l'organisation, et la clé
  -- étrangère l'impose au lieu de le supposer.
  manager_id      uuid references public.organization_members (id) on delete set null,

  status          public.content_status not null default 'active',
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Le slug identifie l'équipe DANS son organisation : deux entreprises
  -- peuvent chacune avoir leur « equipe-fibre ». Un unique global les en
  -- empêcherait — et révélerait au passage l'existence de l'autre.
  unique (organization_id, slug)
);

comment on table public.teams is
  'Équipes terrain d''une organisation. Le slug est unique par organisation, jamais globalement.';

create index if not exists teams_organization_idx
  on public.teams (organization_id)
  where status = 'active';

create index if not exists teams_manager_idx on public.teams (manager_id);
create index if not exists teams_category_idx on public.teams (category_id);

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- team_members
-- -----------------------------------------------------------------------------
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  member_id  uuid not null references public.organization_members (id) on delete cascade,
  role       public.team_member_role not null default 'member',
  joined_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (team_id, member_id)
);

comment on table public.team_members is
  'Appartenance membre ↔ équipe. Un membre peut appartenir à plusieurs équipes (§7).';

create index if not exists team_members_member_idx on public.team_members (member_id);

-- -----------------------------------------------------------------------------
-- Cohérence inter-tenant
-- -----------------------------------------------------------------------------
-- La faille que ce trigger ferme : `team_members` ne référence QUE `team_id` et
-- `member_id`, sans porter d'`organization_id`. Rien dans le modèle relationnel
-- n'empêche donc d'insérer un membre de l'entreprise B dans une équipe de
-- l'entreprise A — les deux clés étrangères sont valides prises isolément.
--
-- C'est exactement le type de fuite inter-tenant que les policies ne voient
-- pas : l'écriture est légitime pour A, seule la PROVENANCE du membre est
-- illégitime. Seule une vérification croisée l'attrape.
create or replace function app.enforce_team_member_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_org   uuid;
  v_member_org uuid;
begin
  select organization_id into v_team_org from public.teams where id = new.team_id;
  select organization_id into v_member_org from public.organization_members where id = new.member_id;

  if v_team_org is null or v_member_org is null or v_team_org <> v_member_org then
    raise exception 'Le membre et l''équipe doivent appartenir à la même organisation.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists team_members_same_org on public.team_members;
create trigger team_members_same_org
  before insert or update on public.team_members
  for each row execute function app.enforce_team_member_same_org();

-- Même raisonnement pour le responsable d'équipe.
create or replace function app.enforce_team_manager_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manager_org uuid;
begin
  if new.manager_id is null then
    return new;
  end if;

  select organization_id into v_manager_org
  from public.organization_members where id = new.manager_id;

  if v_manager_org is distinct from new.organization_id then
    raise exception 'Le responsable doit être membre de l''organisation de l''équipe.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists teams_manager_same_org on public.teams;
create trigger teams_manager_same_org
  before insert or update on public.teams
  for each row execute function app.enforce_team_manager_same_org();

-- -----------------------------------------------------------------------------
-- Appartenance d'équipe — helper de policy
-- -----------------------------------------------------------------------------
-- Renvoie les équipes de l'utilisateur courant. SECURITY DEFINER pour la même
-- raison que `current_org_role()` : les policies de `missions` interrogent
-- cette information, et une lecture directe rouvrirait la récursion.
create or replace function app.my_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tm.team_id
  from public.team_members tm
  join public.organization_members m on m.id = tm.member_id
  where m.user_id = (select auth.uid())
    and m.status = 'active';
$$;

-- Équipes que l'utilisateur PILOTE (chef d'équipe ou responsable désigné).
-- Distincte de la précédente : un chef d'équipe voit et contrôle, un membre
-- exécute.
create or replace function app.my_led_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tm.team_id
  from public.team_members tm
  join public.organization_members m on m.id = tm.member_id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and tm.role = 'lead'
  union
  select t.id
  from public.teams t
  join public.organization_members m on m.id = t.manager_id
  where m.user_id = (select auth.uid())
    and m.status = 'active';
$$;

revoke all on function app.my_team_ids() from public, anon;
revoke all on function app.my_led_team_ids() from public, anon;
grant execute on function app.my_team_ids() to authenticated;
grant execute on function app.my_led_team_ids() to authenticated;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;

-- Lecture : tout membre de l'organisation voit l'organigramme, à condition que
-- l'abonnement débloque le module. Sans `can_use_pro_module`, une entreprise
-- rétrogradée en plan gratuit conserverait l'accès à ses équipes.
drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member"
  on public.teams for select
  to authenticated
  using ((select app.can_use_pro_module(organization_id, 'teams')));

drop policy if exists "teams_insert_permitted" on public.teams;
create policy "teams_insert_permitted"
  on public.teams for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'teams'))
    and (select app.has_org_permission(organization_id, 'team.create'))
  );

drop policy if exists "teams_update_permitted" on public.teams;
create policy "teams_update_permitted"
  on public.teams for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'teams'))
    and (
      (select app.has_org_permission(organization_id, 'team.update'))
      -- Un chef d'équipe modifie SON équipe sans avoir la permission globale.
      or id in (select app.my_led_team_ids())
    )
  )
  with check ((select app.can_use_pro_module(organization_id, 'teams')));

drop policy if exists "teams_delete_permitted" on public.teams;
create policy "teams_delete_permitted"
  on public.teams for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'team.delete')));

-- ---------------------------------------------------------------- team_members
-- `team_members` ne porte pas d'`organization_id` : le périmètre se déduit de
-- l'équipe. Le sous-`select` sur `teams` est lui-même soumis à la RLS de
-- `teams`, ce qui garantit le cloisonnement sans le réécrire.
drop policy if exists "team_members_select" on public.team_members;
create policy "team_members_select"
  on public.team_members for select
  to authenticated
  using (
    team_id in (
      select t.id from public.teams t
      where (select app.can_use_pro_module(t.organization_id, 'teams'))
    )
  );

drop policy if exists "team_members_insert" on public.team_members;
create policy "team_members_insert"
  on public.team_members for insert
  to authenticated
  with check (
    team_id in (
      select t.id from public.teams t
      where (select app.can_use_pro_module(t.organization_id, 'teams'))
        and (
          (select app.has_org_permission(t.organization_id, 'team.assign_member'))
          or t.id in (select app.my_led_team_ids())
        )
    )
  );

drop policy if exists "team_members_update" on public.team_members;
create policy "team_members_update"
  on public.team_members for update
  to authenticated
  using (
    team_id in (
      select t.id from public.teams t
      where (select app.has_org_permission(t.organization_id, 'team.assign_member'))
         or t.id in (select app.my_led_team_ids())
    )
  )
  with check (
    team_id in (
      select t.id from public.teams t
      where (select app.has_org_permission(t.organization_id, 'team.assign_member'))
         or t.id in (select app.my_led_team_ids())
    )
  );

drop policy if exists "team_members_delete" on public.team_members;
create policy "team_members_delete"
  on public.team_members for delete
  to authenticated
  using (
    team_id in (
      select t.id from public.teams t
      where (select app.has_org_permission(t.organization_id, 'team.assign_member'))
         or t.id in (select app.my_led_team_ids())
    )
  );
