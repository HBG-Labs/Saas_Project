-- =============================================================================
-- Workspace v1 : espaces, pages, tâches (phase 4, arbitrages A–F)
-- =============================================================================
--
-- CE QUE CETTE MIGRATION CONSTRUIT
--
-- Rien n'existait : ni table, ni route, ni permission. Le bloc-notes est
-- personnel (`notes.user_id = auth.uid()`), la bibliothèque est un dépôt de
-- fichiers. Le Workspace est la première construction de la transformation,
-- pas une refonte.
--
--   - `workspace_spaces`     un espace par projet, équipe ou sujet ; s'archive,
--                            ne se supprime pas (rien ne se perd en v1).
--   - `workspace_pages`      dans un espace, hiérarchiques, contenu JSON TipTap
--                            — son format natif, rien à convertir.
--   - `workspace_page_revisions`
--                            l'ancienne version à chaque modification, en
--                            écriture seule : la seule réponse à « qui a
--                            effacé ce paragraphe ».
--   - `workspace_tasks`      dans un espace, rattachées à une page et à une
--                            MISSION si on veut — le pont Gestion ↔ Workspace.
--
-- CE QU'ELLE NE FAIT PAS (arbitrages C, E, F)
--
-- Pas de temps réel : dernier enregistré gagne, avec garde (`save_workspace_page`
-- refuse si la page a changé depuis la lecture, comme `issue_invoice`). Les
-- notes restent personnelles. Ni commentaires, ni mentions, ni partage vers
-- le portail, ni pièces jointes, ni recherche plein texte.
--
-- ACCÈS (arbitrage D)
--
-- Trois permissions : `workspace.view`, `workspace.edit`, `workspace.manage`.
-- Une clé de formule `workspace`, ACCORDÉE AUX CINQ FORMULES : la
-- commercialisation modulaire est préparée — la clé existe, le gating est
-- en place — sans qu'aucune restriction ne s'applique à qui que ce soit (D6).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Permissions et formule
-- -----------------------------------------------------------------------------
-- Technicien et employé voient et éditent : un espace d'équipe où la moitié de
-- l'équipe ne peut qu'observer n'est pas un espace d'équipe. Créer ou archiver
-- un espace revient au chef d'équipe et au-dessus.
insert into public.role_permissions (role, permission) values
  ('owner', 'workspace.view'), ('owner', 'workspace.edit'), ('owner', 'workspace.manage'),
  ('admin', 'workspace.view'), ('admin', 'workspace.edit'), ('admin', 'workspace.manage'),
  ('manager', 'workspace.view'), ('manager', 'workspace.edit'), ('manager', 'workspace.manage'),
  ('team_leader', 'workspace.view'), ('team_leader', 'workspace.edit'), ('team_leader', 'workspace.manage'),
  ('technician', 'workspace.view'), ('technician', 'workspace.edit'),
  ('employee', 'workspace.view'), ('employee', 'workspace.edit')
on conflict do nothing;

insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('free', 'workspace', null),
  ('starter', 'workspace', null),
  ('pro', 'workspace', null),
  ('business', 'workspace', null),
  ('enterprise', 'workspace', null)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2. Types
-- -----------------------------------------------------------------------------
create type public.workspace_task_status as enum ('todo', 'in_progress', 'done');
create type public.workspace_task_priority as enum ('low', 'normal', 'high');

revoke all on type public.workspace_task_status from public, anon;
revoke all on type public.workspace_task_priority from public, anon;
grant usage on type public.workspace_task_status to authenticated, service_role;
grant usage on type public.workspace_task_priority to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Les espaces
-- -----------------------------------------------------------------------------
create table public.workspace_spaces (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  description      text,
  icon             text,
  position         integer not null default 0,
  created_by       uuid references auth.users (id) on delete set null,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint workspace_spaces_name_length check (length(btrim(name)) between 1 and 120),
  constraint workspace_spaces_description_length check (description is null or length(description) <= 1000),
  constraint workspace_spaces_icon_length check (icon is null or length(icon) <= 40)
);

comment on table public.workspace_spaces is
  'Un espace de travail : projet, équipe ou sujet. S''archive, ne se supprime pas.';

create index workspace_spaces_org_idx on public.workspace_spaces (organization_id, archived_at, position);

create trigger workspace_spaces_set_updated_at
  before update on public.workspace_spaces
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Les pages
-- -----------------------------------------------------------------------------
create table public.workspace_pages (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  space_id         uuid not null references public.workspace_spaces (id) on delete cascade,
  parent_page_id   uuid references public.workspace_pages (id) on delete set null,
  title            text not null default 'Sans titre',
  -- JSON TipTap. Le document vide est `{"type":"doc","content":[]}` — jamais
  -- NULL, pour qu'une page fraîche s'ouvre dans l'éditeur sans cas particulier.
  content          jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  position         integer not null default 0,
  created_by       uuid references auth.users (id) on delete set null,
  updated_by       uuid references auth.users (id) on delete set null,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint workspace_pages_title_length check (length(title) between 1 and 200),
  constraint workspace_pages_content_is_doc check (content ? 'type' and content->>'type' = 'doc'),
  constraint workspace_pages_not_own_parent check (parent_page_id is null or parent_page_id <> id)
);

comment on table public.workspace_pages is
  'Une page d''un espace, hiérarchique. Contenu au format JSON TipTap. Chaque modification laisse sa version précédente dans workspace_page_revisions.';

create index workspace_pages_space_idx on public.workspace_pages (space_id, parent_page_id, position);
create index workspace_pages_org_idx on public.workspace_pages (organization_id);

create trigger workspace_pages_set_updated_at
  before update on public.workspace_pages
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Les révisions : écriture seule
-- -----------------------------------------------------------------------------
create table public.workspace_page_revisions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  -- Pas de clé étrangère : une révision SURVIT à sa page. Avec `cascade`, la
  -- suppression emporterait l'archive que le trigger vient de poser ; avec
  -- `set null`, la cascade ferait un UPDATE que l'immutabilité refuse.
  page_id          uuid not null,
  title            text not null,
  content          jsonb not null,
  -- Qui avait écrit CETTE version, et quand elle a été remplacée.
  authored_by      uuid references auth.users (id) on delete set null,
  authored_at      timestamptz not null,
  replaced_by      uuid references auth.users (id) on delete set null,
  replaced_at      timestamptz not null default now()
);

comment on table public.workspace_page_revisions is
  'La version précédente d''une page, à chaque modification ou suppression. Ni modifiable ni supprimable.';

create index workspace_page_revisions_page_idx on public.workspace_page_revisions (page_id, replaced_at desc);

-- Immuable, par le moteur : le même refus que le journal d'audit.
create trigger workspace_page_revisions_immutable
  before update or delete on public.workspace_page_revisions
  for each row execute function app.reject_audit_mutation();

-- -----------------------------------------------------------------------------
-- 6. Les tâches
-- -----------------------------------------------------------------------------
create table public.workspace_tasks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  space_id         uuid not null references public.workspace_spaces (id) on delete cascade,
  page_id          uuid references public.workspace_pages (id) on delete set null,
  -- Le pont vers Gestion : une tâche peut découler d'une mission.
  mission_id       uuid references public.missions (id) on delete set null,
  title            text not null,
  description      text,
  status           public.workspace_task_status not null default 'todo',
  priority         public.workspace_task_priority not null default 'normal',
  assignee_member_id uuid references public.organization_members (id) on delete set null,
  due_date         date,
  position         integer not null default 0,
  completed_at     timestamptz,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint workspace_tasks_title_length check (length(btrim(title)) between 1 and 200),
  constraint workspace_tasks_description_length check (description is null or length(description) <= 5000),
  -- `completed_at` et `status = 'done'` disent la même chose : l'un sans
  -- l'autre serait un mensonge. Le trigger les aligne ; la contrainte le tient.
  constraint workspace_tasks_completed_consistent
    check ((status = 'done') = (completed_at is not null))
);

comment on table public.workspace_tasks is
  'Une tâche d''un espace, optionnellement liée à une page et à une mission.';

create index workspace_tasks_space_idx on public.workspace_tasks (space_id, status, position);
create index workspace_tasks_assignee_idx on public.workspace_tasks (assignee_member_id) where status <> 'done';
create index workspace_tasks_mission_idx on public.workspace_tasks (mission_id) where mission_id is not null;
create index workspace_tasks_org_due_idx on public.workspace_tasks (organization_id, due_date) where status <> 'done';

create trigger workspace_tasks_set_updated_at
  before update on public.workspace_tasks
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. Gardes : rien ne traverse une organisation, une page reste dans son espace
-- -----------------------------------------------------------------------------
-- Une page hérite son organisation de son espace ; une tâche aussi, et ce
-- qu'elle référence — page, mission, membre — doit être de la même
-- organisation. `security definer` : le garde lit des lignes que la RLS de
-- l'auteur pourrait masquer, et un refus clair vaut mieux qu'un refus muet.

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
  end if;
  new.updated_by := (select auth.uid());

  return new;
end;
$$;

revoke all on function app.guard_workspace_page() from public, anon, authenticated;

create trigger workspace_pages_guard
  before insert or update on public.workspace_pages
  for each row execute function app.guard_workspace_page();

create or replace function app.guard_workspace_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_space_org uuid;
  v_org       uuid;
begin
  select organization_id into v_space_org from public.workspace_spaces where id = new.space_id;
  if v_space_org is null then
    raise exception 'Espace introuvable.' using errcode = 'foreign_key_violation';
  end if;
  new.organization_id := v_space_org;

  if new.page_id is not null then
    select organization_id into v_org from public.workspace_pages where id = new.page_id;
    if v_org is distinct from v_space_org then
      raise exception 'La page liée doit être de la même organisation.' using errcode = 'restrict_violation';
    end if;
  end if;

  if new.mission_id is not null then
    select organization_id into v_org from public.missions where id = new.mission_id;
    if v_org is distinct from v_space_org then
      raise exception 'La mission liée doit être de la même organisation.' using errcode = 'restrict_violation';
    end if;
  end if;

  if new.assignee_member_id is not null then
    select organization_id into v_org from public.organization_members where id = new.assignee_member_id;
    if v_org is distinct from v_space_org then
      raise exception 'La personne assignée doit être membre de la même organisation.' using errcode = 'restrict_violation';
    end if;
  end if;

  -- `completed_at` suit le statut, dans les deux sens.
  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
  end if;

  return new;
end;
$$;

revoke all on function app.guard_workspace_task() from public, anon, authenticated;

create trigger workspace_tasks_guard
  before insert or update on public.workspace_tasks
  for each row execute function app.guard_workspace_task();

-- -----------------------------------------------------------------------------
-- 8. Les révisions, posées par le moteur
-- -----------------------------------------------------------------------------
-- À chaque changement de titre ou de contenu, et à la suppression : l'ancienne
-- version part dans les révisions, signée de son auteur et datée de son
-- remplacement. Un déplacement (position, parent) ne fait pas une révision.
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
    (organization_id, page_id, title, content, authored_by, authored_at, replaced_by)
  values
    (old.organization_id, old.id, old.title, old.content, old.updated_by, old.updated_at, (select auth.uid()));

  return coalesce(new, old);
end;
$$;

revoke all on function app.archive_workspace_page_revision() from public, anon, authenticated;

-- BEFORE delete : après, la ligne n'existe plus et la clé étrangère de la
-- révision n'aurait rien à référencer.
create trigger workspace_pages_archive_revision
  before update or delete on public.workspace_pages
  for each row execute function app.archive_workspace_page_revision();

-- -----------------------------------------------------------------------------
-- 9. Journal : la vie des espaces
-- -----------------------------------------------------------------------------
create or replace function app.audit_workspace_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit_log(new.organization_id, 'workspace_space.created', 'workspace_space', new.id,
      jsonb_build_object('name', new.name));
  elsif tg_op = 'UPDATE' and (new.archived_at is null) <> (old.archived_at is null) then
    perform app.write_audit_log(new.organization_id,
      case when new.archived_at is null then 'workspace_space.restored' else 'workspace_space.archived' end,
      'workspace_space', new.id, jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

revoke all on function app.audit_workspace_space() from public, anon, authenticated;

create trigger workspace_spaces_audit
  after insert or update on public.workspace_spaces
  for each row execute function app.audit_workspace_space();

-- -----------------------------------------------------------------------------
-- 10. Droits
-- -----------------------------------------------------------------------------
alter table public.workspace_spaces enable row level security;
alter table public.workspace_pages enable row level security;
alter table public.workspace_page_revisions enable row level security;
alter table public.workspace_tasks enable row level security;

revoke all on public.workspace_spaces, public.workspace_pages, public.workspace_page_revisions, public.workspace_tasks
  from public, anon, authenticated, service_role;

-- Un espace s'archive (update), ne se supprime pas : aucun delete pour authenticated.
grant select, insert on public.workspace_spaces to authenticated;
grant update (name, description, icon, position, archived_at) on public.workspace_spaces to authenticated;
grant select, insert, delete on public.workspace_pages to authenticated;
grant update (parent_page_id, title, content, position, archived_at) on public.workspace_pages to authenticated;
grant select on public.workspace_page_revisions to authenticated;
grant select, insert, delete on public.workspace_tasks to authenticated;
grant update (page_id, mission_id, title, description, status, priority, assignee_member_id, due_date, position)
  on public.workspace_tasks to authenticated;
grant all on public.workspace_spaces, public.workspace_pages, public.workspace_page_revisions, public.workspace_tasks
  to service_role;

-- Espaces : voir = workspace.view ; créer, modifier, archiver = workspace.manage.
create policy workspace_spaces_select on public.workspace_spaces for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'workspace'))
     and (select app.has_org_permission(organization_id, 'workspace.view')));
create policy workspace_spaces_insert on public.workspace_spaces for insert to authenticated
  with check ((select app.can_use_pro_module(organization_id, 'workspace'))
          and (select app.has_org_permission(organization_id, 'workspace.manage')));
create policy workspace_spaces_update on public.workspace_spaces for update to authenticated
  using ((select app.has_org_permission(organization_id, 'workspace.manage')))
  with check ((select app.has_org_permission(organization_id, 'workspace.manage')));

-- Pages et tâches : voir = workspace.view ; le reste = workspace.edit.
create policy workspace_pages_select on public.workspace_pages for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'workspace'))
     and (select app.has_org_permission(organization_id, 'workspace.view')));
create policy workspace_pages_insert on public.workspace_pages for insert to authenticated
  with check ((select app.can_use_pro_module(organization_id, 'workspace'))
          and (select app.has_org_permission(organization_id, 'workspace.edit')));
create policy workspace_pages_update on public.workspace_pages for update to authenticated
  using ((select app.has_org_permission(organization_id, 'workspace.edit')))
  with check ((select app.has_org_permission(organization_id, 'workspace.edit')));
create policy workspace_pages_delete on public.workspace_pages for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'workspace.edit')));

create policy workspace_page_revisions_select on public.workspace_page_revisions for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'workspace'))
     and (select app.has_org_permission(organization_id, 'workspace.view')));

create policy workspace_tasks_select on public.workspace_tasks for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'workspace'))
     and (select app.has_org_permission(organization_id, 'workspace.view')));
create policy workspace_tasks_insert on public.workspace_tasks for insert to authenticated
  with check ((select app.can_use_pro_module(organization_id, 'workspace'))
          and (select app.has_org_permission(organization_id, 'workspace.edit')));
create policy workspace_tasks_update on public.workspace_tasks for update to authenticated
  using ((select app.has_org_permission(organization_id, 'workspace.edit')))
  with check ((select app.has_org_permission(organization_id, 'workspace.edit')));
create policy workspace_tasks_delete on public.workspace_tasks for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'workspace.edit')));

-- -----------------------------------------------------------------------------
-- 11. Enregistrer une page : dernier enregistré gagne, avec garde
-- -----------------------------------------------------------------------------
-- Pas de temps réel en v1 (arbitrage C). Deux personnes sur la même page :
-- l'enregistrement porte l'`updated_at` lu à l'ouverture, et la base refuse si
-- la page a changé entre-temps. Le client recharge et l'annonce ; il n'écrase
-- pas en silence. Même patron qu'`issue_invoice`.
--
-- `security invoker` : la RLS d'édition s'applique à la personne.
create or replace function public.save_workspace_page(
  p_page_id             uuid,
  p_expected_updated_at timestamptz,
  p_title               text,
  p_content             jsonb
)
returns public.workspace_pages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_page public.workspace_pages;
begin
  select * into v_page from public.workspace_pages where id = p_page_id for update;
  if not found then
    raise exception 'Page introuvable.' using errcode = 'no_data_found';
  end if;

  if v_page.updated_at is distinct from p_expected_updated_at then
    raise exception 'Cette page a été modifiée par quelqu''un d''autre depuis votre ouverture. Rechargez-la avant d''enregistrer.'
      using errcode = 'serialization_failure';
  end if;

  update public.workspace_pages
  set title = coalesce(nullif(btrim(p_title), ''), 'Sans titre'), content = p_content
  where id = p_page_id
  returning * into v_page;

  return v_page;
end;
$$;

revoke all on function public.save_workspace_page(uuid, timestamptz, text, jsonb) from public, anon;
grant execute on function public.save_workspace_page(uuid, timestamptz, text, jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 12. Auto-vérification
-- -----------------------------------------------------------------------------
do $$
declare v int;
begin
  select count(distinct permission) into v from public.role_permissions where permission like 'workspace.%';
  if v <> 3 then raise exception '% permission(s) workspace au lieu de 3.', v; end if;

  select count(*) into v from public.plan_features where feature_key = 'workspace';
  if v <> 5 then raise exception 'workspace accordé à % formule(s) au lieu de 5 : D6 exige toutes les formules.', v; end if;

  select count(*) into v from pg_policy p join pg_class c on c.oid = p.polrelid
  where c.relname in ('workspace_spaces', 'workspace_pages', 'workspace_page_revisions', 'workspace_tasks');
  if v <> 12 then raise exception '% politique(s) RLS au lieu de 12.', v; end if;
end $$;
