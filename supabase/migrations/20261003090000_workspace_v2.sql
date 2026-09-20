-- =============================================================================
-- Workspace v2 : espace personnel, récentes, favoris, couverture, modèles,
-- recherche, et l'Assistant IA dans les pages
-- =============================================================================
--
-- CE QUI MANQUAIT
--
-- Le Workspace (20260929090000) sait tenir des espaces partagés, des pages en
-- arbre, des révisions et des tâches. Ce qu'un écran de type Notion demande en
-- plus, et que la base ne savait pas :
--
--   - des pages À SOI, invisibles des autres — même de qui gère le Workspace ;
--   - les dernières pages ouvertes, les pages épinglées ;
--   - une icône et une couverture par page ;
--   - des modèles : réunion, compte rendu de chantier, procédure… ;
--   - chercher dans le contenu des pages ;
--   - poser une question à l'IA SUR une page, depuis la page.
--
-- Arbitrages A–G du 20/09/2026, F en option 2 : l'IA du Workspace s'ouvre à
-- qui écrit dans le Workspace, dans le quota de l'organisation.
--
-- LE PRINCIPE DE L'ESPACE PERSONNEL
--
-- Un espace personnel est un `workspace_spaces` qui porte un `owner_member_id`.
-- Il n'est visible que par cette personne. Quand elle quitte l'entreprise
-- (membre plus actif), l'espace est ARCHIVÉ, pas supprimé : ce qui a été écrit
-- chez l'employeur, sur son outil, reste à l'employeur. C'est le droit du
-- travail français, et c'est ce qu'on attend d'un outil professionnel.
-- Personne ne le voit pour autant : une page privée archivée reste privée ;
-- seule une intervention manuelle (service_role) peut la relire.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Permission : l'IA du Workspace
-- -----------------------------------------------------------------------------
-- `ai.use` reste au propriétaire (décision du 02/09). `ai.workspace` est une
-- porte plus étroite : une conversation ATTACHÉE À UNE PAGE, ouverte à qui
-- porte `workspace.edit`. Le quota est celui de l'organisation ; la formule
-- doit inclure l'Assistant IA.
insert into public.role_permissions (role, permission) values
  ('owner', 'ai.workspace'), ('admin', 'ai.workspace'), ('manager', 'ai.workspace'),
  ('team_leader', 'ai.workspace'), ('technician', 'ai.workspace'), ('employee', 'ai.workspace')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2. L'espace personnel
-- -----------------------------------------------------------------------------
alter table public.workspace_spaces
  add column owner_member_id uuid references public.organization_members (id) on delete cascade;

comment on column public.workspace_spaces.owner_member_id is
  'Posé = espace personnel de ce membre, visible de lui seul. NULL = espace partagé de l''organisation.';

create unique index workspace_spaces_personal_idx
  on public.workspace_spaces (owner_member_id) where owner_member_id is not null;

/** Un espace se voit s'il est partagé, ou s'il est le mien. */
create or replace function app.workspace_space_visible(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_spaces s
    where s.id = p_space_id
      and (s.owner_member_id is null
           or exists (select 1 from public.organization_members m
                      where m.id = s.owner_member_id and m.user_id = (select auth.uid())))
  );
$$;

create or replace function app.workspace_page_visible(p_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_pages p
    where p.id = p_page_id and app.workspace_space_visible(p.space_id)
  );
$$;

revoke all on function app.workspace_space_visible(uuid), app.workspace_page_visible(uuid) from public, anon;
grant execute on function app.workspace_space_visible(uuid), app.workspace_page_visible(uuid) to authenticated, service_role;

/**
 * Mon espace personnel dans cette organisation — créé à la première demande,
 * rouvert s'il avait été archivé (retour dans l'entreprise). `security
 * definer` : la création d'un espace exige `workspace.manage`, et l'espace
 * personnel doit exister pour quiconque écrit.
 */
create or replace function public.ensure_personal_workspace_space(p_organization_id uuid)
returns public.workspace_spaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
  v_space  public.workspace_spaces;
begin
  if not app.can_use_pro_module(p_organization_id, 'workspace')
     or not app.has_org_permission(p_organization_id, 'workspace.edit') then
    raise exception 'Le Workspace n''est pas accessible en écriture pour ce compte.' using errcode = 'insufficient_privilege';
  end if;

  select m.id into v_member from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = (select auth.uid()) and m.status = 'active';
  if v_member is null then
    raise exception 'Membre introuvable.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_space from public.workspace_spaces where owner_member_id = v_member for update;
  if found then
    if v_space.archived_at is not null then
      update public.workspace_spaces set archived_at = null where id = v_space.id returning * into v_space;
    end if;
    return v_space;
  end if;

  insert into public.workspace_spaces (organization_id, name, icon, position, created_by, owner_member_id)
  values (p_organization_id, 'Mes pages', 'user', 0, (select auth.uid()), v_member)
  returning * into v_space;
  return v_space;
end;
$$;

revoke all on function public.ensure_personal_workspace_space(uuid) from public, anon;
grant execute on function public.ensure_personal_workspace_space(uuid) to authenticated, service_role;

/** Au départ d'un membre, son espace personnel est archivé — pas supprimé. */
create or replace function app.archive_personal_workspace_on_departure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'active' and new.status <> 'active' then
    update public.workspace_spaces set archived_at = now()
    where owner_member_id = new.id and archived_at is null;
  end if;
  return new;
end;
$$;

revoke all on function app.archive_personal_workspace_on_departure() from public, anon, authenticated;

create trigger organization_members_archive_personal_workspace
  after update of status on public.organization_members
  for each row execute function app.archive_personal_workspace_on_departure();

-- -----------------------------------------------------------------------------
-- 3. Icône, couverture
-- -----------------------------------------------------------------------------
alter table public.workspace_pages
  add column icon text constraint workspace_pages_icon_length check (icon is null or length(icon) <= 40),
  add column cover_path text constraint workspace_pages_cover_path_length check (cover_path is null or length(cover_path) <= 300);

comment on column public.workspace_pages.cover_path is
  'Chemin dans le bucket privé workspace-covers : <organisation>/<page>/<fichier>.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-covers', 'workspace-covers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Le chemin porte l'organisation puis la page : la règle du fichier est celle
-- de sa page. Pas d'UPDATE : on remplace, on ne renomme pas.
create policy workspace_covers_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'workspace-covers'
     and (select app.can_use_pro_module(((storage.foldername(name))[1])::uuid, 'workspace'))
     and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'workspace.view'))
     and (select app.workspace_page_visible(((storage.foldername(name))[2])::uuid)));
create policy workspace_covers_storage_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'workspace-covers'
     and (select app.can_use_pro_module(((storage.foldername(name))[1])::uuid, 'workspace'))
     and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'workspace.edit'))
     and (select app.workspace_page_visible(((storage.foldername(name))[2])::uuid)));
create policy workspace_covers_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'workspace-covers'
     and (select app.can_use_pro_module(((storage.foldername(name))[1])::uuid, 'workspace'))
     and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'workspace.edit'))
     and (select app.workspace_page_visible(((storage.foldername(name))[2])::uuid)));

-- -----------------------------------------------------------------------------
-- 4. Récentes et favoris
-- -----------------------------------------------------------------------------
create table public.workspace_page_visits (
  user_id          uuid not null references auth.users (id) on delete cascade,
  page_id          uuid not null references public.workspace_pages (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  visited_at       timestamptz not null default now(),
  primary key (user_id, page_id)
);

comment on table public.workspace_page_visits is
  'Dernière ouverture de chaque page par personne. Les 50 plus récentes par personne et organisation sont conservées.';

create index workspace_page_visits_recent_idx on public.workspace_page_visits (user_id, organization_id, visited_at desc);

create table public.workspace_favorites (
  user_id          uuid not null references auth.users (id) on delete cascade,
  page_id          uuid not null references public.workspace_pages (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  primary key (user_id, page_id)
);

create index workspace_favorites_user_idx on public.workspace_favorites (user_id, organization_id, position);

/** J'ai ouvert cette page. Garde les 50 dernières. */
create or replace function public.touch_workspace_page(p_page_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org  uuid;
begin
  if v_user is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;
  select p.organization_id into v_org from public.workspace_pages p
  where p.id = p_page_id and p.archived_at is null and app.workspace_space_visible(p.space_id);
  if v_org is null
     or not app.can_use_pro_module(v_org, 'workspace')
     or not app.has_org_permission(v_org, 'workspace.view') then
    raise exception 'Page introuvable.' using errcode = 'no_data_found';
  end if;

  -- `clock_timestamp()` et non `now()` : deux ouvertures dans la même
  -- transaction (import, script) doivent rester ordonnées.
  insert into public.workspace_page_visits (user_id, page_id, organization_id, visited_at)
  values (v_user, p_page_id, v_org, clock_timestamp())
  on conflict (user_id, page_id) do update set visited_at = excluded.visited_at;

  delete from public.workspace_page_visits v
  where v.user_id = v_user and v.organization_id = v_org
    and v.page_id in (
      select page_id from public.workspace_page_visits
      where user_id = v_user and organization_id = v_org
      order by visited_at desc offset 50);
end;
$$;

revoke all on function public.touch_workspace_page(uuid) from public, anon;
grant execute on function public.touch_workspace_page(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Les modèles
-- -----------------------------------------------------------------------------
-- Un modèle système (organisation NULL) est fourni par migration et lu par
-- tous ; un modèle d'entreprise se crée depuis une page (« enregistrer comme
-- modèle », `workspace.manage`) et ne sort pas de l'organisation.
create table public.workspace_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations (id) on delete cascade,
  name             text not null,
  description      text,
  icon             text,
  category         text not null default 'general',
  content          jsonb not null,
  position         integer not null default 0,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint workspace_templates_name_length check (length(btrim(name)) between 1 and 120),
  constraint workspace_templates_description_length check (description is null or length(description) <= 500),
  constraint workspace_templates_icon_length check (icon is null or length(icon) <= 40),
  constraint workspace_templates_category_length check (length(category) between 1 and 40),
  constraint workspace_templates_content_is_doc check (content ? 'type' and content->>'type' = 'doc')
);

comment on table public.workspace_templates is
  'Modèles de page : système (organization_id NULL, fournis par migration) ou d''entreprise.';

create index workspace_templates_org_idx on public.workspace_templates (organization_id, category, position);

create trigger workspace_templates_set_updated_at
  before update on public.workspace_templates
  for each row execute function public.set_updated_at();

/** Une page à partir d'un modèle. `security invoker` : la RLS d'édition s'applique. */
create or replace function public.create_page_from_template(
  p_template_id    uuid,
  p_space_id       uuid,
  p_parent_page_id uuid default null,
  p_title          text default null
)
returns public.workspace_pages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template public.workspace_templates;
  v_page     public.workspace_pages;
begin
  select * into v_template from public.workspace_templates where id = p_template_id;
  if not found then
    raise exception 'Modèle introuvable.' using errcode = 'no_data_found';
  end if;

  insert into public.workspace_pages (space_id, parent_page_id, title, content, icon, position)
  values (p_space_id, p_parent_page_id, coalesce(nullif(btrim(p_title), ''), v_template.name), v_template.content, v_template.icon,
          coalesce((select max(position) + 1 from public.workspace_pages
                    where space_id = p_space_id and parent_page_id is not distinct from p_parent_page_id), 0))
  returning * into v_page;
  return v_page;
end;
$$;

revoke all on function public.create_page_from_template(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.create_page_from_template(uuid, uuid, uuid, text) to authenticated, service_role;

-- Les modèles système. Identifiants fixes : rejouer ce bloc ne duplique rien.
-- Le contenu est un brouillon à faire relire par le métier ; il se corrige par
-- une nouvelle migration (`update ... where id = ...`).
insert into public.workspace_templates (id, organization_id, name, description, icon, category, content, position) values
('a0000000-0000-4000-8000-000000000001', null, 'Réunion', 'Participants, ordre du jour, décisions, actions.', 'users', 'equipe',
 '{"type":"doc","content":[
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Participants"}]},
   {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"…"}]}]}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Ordre du jour"}]},
   {"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"…"}]}]}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Décisions"}]},
   {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"…"}]}]}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Actions"}]},
   {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Qui fait quoi, pour quand"}]}]}]}
 ]}', 10),
('a0000000-0000-4000-8000-000000000002', null, 'Compte rendu de chantier', 'Ce qui a été fait, avec quoi, ce qui reste.', 'hard-hat', 'terrain',
 '{"type":"doc","content":[
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Chantier et client"}]},
   {"type":"paragraph","content":[{"type":"text","text":"Adresse, interlocuteur, référence de mission."}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Travaux réalisés"}]},
   {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"…"}]}]}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Matériel et consommables utilisés"}]},
   {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"…"}]}]}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Points d''attention"}]},
   {"type":"paragraph","content":[{"type":"text","text":"Sécurité, accès, anomalies constatées."}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Reste à faire"}]},
   {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"…"}]}]}]}
 ]}', 20),
('a0000000-0000-4000-8000-000000000003', null, 'Procédure', 'Une façon de faire, écrite une fois pour toutes.', 'list-checks', 'qualite',
 '{"type":"doc","content":[
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Objet"}]},
   {"type":"paragraph","content":[{"type":"text","text":"Ce que cette procédure couvre, et ce qu''elle ne couvre pas."}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Quand l''appliquer"}]},
   {"type":"paragraph","content":[{"type":"text","text":"…"}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Sécurité"}]},
   {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"EPI, consignation, habilitations requises."}]}]}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Étapes"}]},
   {"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"…"}]}]}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Contrôle final"}]},
   {"type":"paragraph","content":[{"type":"text","text":"Comment on vérifie que c''est bien fait."}]}
 ]}', 30),
('a0000000-0000-4000-8000-000000000004', null, 'Check-list de journée', 'Avant de partir, pendant, en rentrant.', 'clipboard-check', 'terrain',
 '{"type":"doc","content":[
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Avant de partir"}]},
   {"type":"bulletList","content":[
     {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Véhicule : carburant, état, documents"}]}]},
     {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Matériel et outillage du jour"}]}]},
     {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Planning et adresses"}]}]}
   ]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Sur place"}]},
   {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Chronomètre démarré, photos avant / après"}]}]}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"En rentrant"}]},
   {"type":"bulletList","content":[
     {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Compte rendu envoyé"}]}]},
     {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Consommables sortis du stock"}]}]},
     {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Matériel rangé, anomalies signalées"}]}]}
   ]}
 ]}', 40),
('a0000000-0000-4000-8000-000000000005', null, 'Suivi hebdomadaire', 'Ce qui a avancé, ce qui bloque, ce qui vient.', 'calendar-days', 'equipe',
 '{"type":"doc","content":[
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Cette semaine"}]},
   {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"…"}]}]}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Blocages"}]},
   {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"…"}]}]}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Semaine prochaine"}]},
   {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"…"}]}]}]},
   {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Chiffres"}]},
   {"type":"paragraph","content":[{"type":"text","text":"Interventions réalisées, devis envoyés, factures émises."}]}
 ]}', 50)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 6. La recherche
-- -----------------------------------------------------------------------------
-- Le texte d'une page est extrait de son JSON TipTap dans l'ordre du document,
-- puis indexé en français. Colonnes GÉNÉRÉES : rien à maintenir côté client, et
-- impossible de désynchroniser. `search_text` sert aussi à l'Assistant IA :
-- une page se lit en texte, pas en JSON.
create or replace function app.tiptap_text(p_node jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out   text := '';
  v_child jsonb;
begin
  if p_node is null or jsonb_typeof(p_node) <> 'object' then
    return '';
  end if;
  if p_node ? 'text' then
    return coalesce(p_node->>'text', '');
  end if;
  if jsonb_typeof(p_node->'content') = 'array' then
    for v_child in select * from jsonb_array_elements(p_node->'content') loop
      -- Un bloc se termine par un retour à la ligne ; un nœud texte porte
      -- déjà ses espaces ; les autres nœuds en ligne (saut, mention) valent
      -- un espace.
      v_out := v_out || app.tiptap_text(v_child)
        || case when v_child->>'type' in ('paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock', 'tableRow', 'taskItem')
                then E'\n'
                when v_child ? 'text' then ''
                else ' ' end;
    end loop;
  end if;
  return v_out;
end;
$$;

revoke all on function app.tiptap_text(jsonb) from public, anon;
grant execute on function app.tiptap_text(jsonb) to authenticated, service_role;

alter table public.workspace_pages
  add column search_text text generated always as (app.tiptap_text(content)) stored,
  add column search_vector tsvector generated always as
    (to_tsvector('french'::regconfig, coalesce(title, '') || E'\n' || app.tiptap_text(content))) stored;

create index workspace_pages_search_idx on public.workspace_pages using gin (search_vector);

/**
 * Chercher dans les pages d'une organisation. `security invoker` : la RLS
 * décide de ce qui remonte — les pages privées des autres n'existent pas ici.
 * Syntaxe « web » : des mots, des guillemets pour une expression, un tiret
 * pour exclure.
 */
create or replace function public.search_workspace_pages(
  p_organization_id uuid,
  p_query           text,
  p_limit           integer default 20
)
returns table (
  id         uuid,
  space_id   uuid,
  title      text,
  icon       text,
  snippet    text,
  rank       real,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.space_id, p.title, p.icon,
         ts_headline('french'::regconfig, left(coalesce(p.search_text, ''), 4000), q,
                     'MaxFragments=1, MaxWords=24, MinWords=8, StartSel=«, StopSel=»') as snippet,
         ts_rank(p.search_vector, q) as rank,
         p.updated_at
  from public.workspace_pages p,
       websearch_to_tsquery('french'::regconfig, coalesce(p_query, '')) q
  where p.organization_id = p_organization_id
    and p.archived_at is null
    and p.search_vector @@ q
  order by rank desc, p.updated_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.search_workspace_pages(uuid, text, integer) from public, anon;
grant execute on function public.search_workspace_pages(uuid, text, integer) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. L'Assistant IA dans une page
-- -----------------------------------------------------------------------------
-- Une conversation peut être ATTACHÉE à une page : la page est alors lue par
-- l'assistant (résumer, rédiger, répondre sur son contenu). La permission
-- diffère : `ai.workspace` suffit, là où une conversation générale exige
-- `ai.use`.
alter table public.ai_conversations
  add column scope text not null default 'general'
    constraint ai_conversations_scope check (scope in ('general', 'workspace')),
  add column page_id uuid references public.workspace_pages (id) on delete set null,
  add constraint ai_conversations_workspace_has_page check (scope <> 'workspace' or page_id is not null);

create index ai_conversations_page_idx on public.ai_conversations (page_id) where page_id is not null;

drop policy if exists "ai_conversations_insert" on public.ai_conversations;
create policy "ai_conversations_insert" on public.ai_conversations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select app.can_use_pro_module(organization_id, 'ai_assistant'))
    and case when scope = 'workspace'
             then (select app.has_org_permission(organization_id, 'ai.workspace'))
                  and (select app.workspace_page_visible(page_id))
             else (select app.has_org_permission(organization_id, 'ai.use')) end
  );

-- La réservation de quota apprend la portée. L'ancienne signature disparaît :
-- deux fonctions du même nom dont l'une a un défaut seraient ambiguës.
drop function if exists public.reserve_ai_usage(uuid, uuid);

create or replace function public.reserve_ai_usage(
  p_organization_id uuid,
  p_user_id uuid,
  p_scope text default 'general'
)
returns table (
  reservation_id uuid,
  used_before integer,
  quota_limit integer,
  remaining_after integer,
  unlimited boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_used integer;
  v_reservation uuid;
  v_permission text := case when p_scope = 'workspace' then 'ai.workspace' else 'ai.use' end;
begin
  if not exists (
    select 1
    from public.organization_members m
    join public.role_permissions rp
      on rp.role = m.role and rp.permission = v_permission
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
  ) then
    return;
  end if;

  if not app.org_has_feature(p_organization_id, 'ai_assistant') then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text, 0)
  );

  delete from public.ai_usage
  where organization_id = p_organization_id
    and request_type = 'chat_reserved'
    and input_tokens = 0
    and output_tokens = 0
    and created_at < now() - interval '15 minutes';

  v_limit := app.org_feature_limit(p_organization_id, 'ai_assistant');

  select count(*)::integer into v_used
  from public.ai_usage u
  where u.organization_id = p_organization_id
    and u.created_at >= pg_catalog.date_trunc('month', now());

  if v_limit is not null and v_used >= v_limit then
    return;
  end if;

  insert into public.ai_usage (organization_id, user_id, request_type)
  values (p_organization_id, p_user_id, 'chat_reserved')
  returning id into v_reservation;

  return query select
    v_reservation,
    v_used,
    v_limit,
    case when v_limit is null then null else greatest(v_limit - v_used - 1, 0) end,
    v_limit is null;
end;
$$;

revoke all on function public.reserve_ai_usage(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, uuid, text) to service_role;

comment on function public.reserve_ai_usage(uuid, uuid, text) is
  'Réserve atomiquement une requête IA après contrôle du plan, du membre actif et de sa permission (ai.use, ou ai.workspace pour une conversation attachée à une page).';

-- -----------------------------------------------------------------------------
-- 8. Droits : les politiques du Workspace apprennent l'espace personnel
-- -----------------------------------------------------------------------------
drop policy workspace_spaces_select on public.workspace_spaces;
drop policy workspace_spaces_insert on public.workspace_spaces;
drop policy workspace_spaces_update on public.workspace_spaces;
drop policy workspace_pages_select on public.workspace_pages;
drop policy workspace_pages_insert on public.workspace_pages;
drop policy workspace_pages_update on public.workspace_pages;
drop policy workspace_pages_delete on public.workspace_pages;
drop policy workspace_page_revisions_select on public.workspace_page_revisions;
drop policy workspace_tasks_select on public.workspace_tasks;
drop policy workspace_tasks_insert on public.workspace_tasks;
drop policy workspace_tasks_update on public.workspace_tasks;
drop policy workspace_tasks_delete on public.workspace_tasks;

grant update (icon, cover_path) on public.workspace_pages to authenticated;
grant select, insert on public.workspace_templates to authenticated;
grant update (name, description, icon, category, content, position) on public.workspace_templates to authenticated;
grant delete on public.workspace_templates to authenticated;
grant select on public.workspace_page_visits to authenticated;
grant select, insert, update (position), delete on public.workspace_favorites to authenticated;
grant all on public.workspace_templates, public.workspace_page_visits, public.workspace_favorites to service_role;

alter table public.workspace_templates enable row level security;
alter table public.workspace_page_visits enable row level security;
alter table public.workspace_favorites enable row level security;

-- Espaces : un partagé se voit avec workspace.view, un personnel par son
-- propriétaire seul. Créer un partagé = manage ; le personnel passe par la
-- fonction. Modifier : manage sur un partagé, le propriétaire sur le sien.
create policy workspace_spaces_select on public.workspace_spaces for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'workspace'))
     and (select app.has_org_permission(organization_id, 'workspace.view'))
     and (owner_member_id is null or (select app.workspace_space_visible(id))));
create policy workspace_spaces_insert on public.workspace_spaces for insert to authenticated
  with check ((select app.can_use_pro_module(organization_id, 'workspace'))
          and (select app.has_org_permission(organization_id, 'workspace.manage'))
          and owner_member_id is null);
create policy workspace_spaces_update on public.workspace_spaces for update to authenticated
  using (case when owner_member_id is null
              then (select app.has_org_permission(organization_id, 'workspace.manage'))
              else (select app.workspace_space_visible(id)) end)
  with check (case when owner_member_id is null
              then (select app.has_org_permission(organization_id, 'workspace.manage'))
              else (select app.workspace_space_visible(id)) end);

create policy workspace_pages_select on public.workspace_pages for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'workspace'))
     and (select app.has_org_permission(organization_id, 'workspace.view'))
     and (select app.workspace_space_visible(space_id)));
create policy workspace_pages_insert on public.workspace_pages for insert to authenticated
  with check ((select app.can_use_pro_module(organization_id, 'workspace'))
          and (select app.has_org_permission(organization_id, 'workspace.edit'))
          and (select app.workspace_space_visible(space_id)));
create policy workspace_pages_update on public.workspace_pages for update to authenticated
  using ((select app.has_org_permission(organization_id, 'workspace.edit'))
     and (select app.workspace_space_visible(space_id)))
  with check ((select app.has_org_permission(organization_id, 'workspace.edit'))
          and (select app.workspace_space_visible(space_id)));
create policy workspace_pages_delete on public.workspace_pages for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'workspace.edit'))
     and (select app.workspace_space_visible(space_id)));

create policy workspace_page_revisions_select on public.workspace_page_revisions for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'workspace'))
     and (select app.has_org_permission(organization_id, 'workspace.view'))
     and (select app.workspace_page_visible(page_id)));

create policy workspace_tasks_select on public.workspace_tasks for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'workspace'))
     and (select app.has_org_permission(organization_id, 'workspace.view'))
     and (select app.workspace_space_visible(space_id)));
create policy workspace_tasks_insert on public.workspace_tasks for insert to authenticated
  with check ((select app.can_use_pro_module(organization_id, 'workspace'))
          and (select app.has_org_permission(organization_id, 'workspace.edit'))
          and (select app.workspace_space_visible(space_id)));
create policy workspace_tasks_update on public.workspace_tasks for update to authenticated
  using ((select app.has_org_permission(organization_id, 'workspace.edit'))
     and (select app.workspace_space_visible(space_id)))
  with check ((select app.has_org_permission(organization_id, 'workspace.edit'))
          and (select app.workspace_space_visible(space_id)));
create policy workspace_tasks_delete on public.workspace_tasks for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'workspace.edit'))
     and (select app.workspace_space_visible(space_id)));

-- Modèles : les système pour tout membre du Workspace ; ceux de l'entreprise
-- pour ses membres ; en écriture, manage seulement, et jamais un système.
create policy workspace_templates_select on public.workspace_templates for select to authenticated
  using (organization_id is null
      or ((select app.can_use_pro_module(organization_id, 'workspace'))
          and (select app.has_org_permission(organization_id, 'workspace.view'))));
create policy workspace_templates_insert on public.workspace_templates for insert to authenticated
  with check (organization_id is not null
          and (select app.can_use_pro_module(organization_id, 'workspace'))
          and (select app.has_org_permission(organization_id, 'workspace.manage')));
create policy workspace_templates_update on public.workspace_templates for update to authenticated
  using (organization_id is not null and (select app.has_org_permission(organization_id, 'workspace.manage')))
  with check (organization_id is not null and (select app.has_org_permission(organization_id, 'workspace.manage')));
create policy workspace_templates_delete on public.workspace_templates for delete to authenticated
  using (organization_id is not null and (select app.has_org_permission(organization_id, 'workspace.manage')));

-- Récentes : les miennes, en lecture (l'écriture passe par la fonction).
create policy workspace_page_visits_select on public.workspace_page_visits for select to authenticated
  using (user_id = (select auth.uid()));

-- Favoris : les miens, sur une page que je vois.
create policy workspace_favorites_select on public.workspace_favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy workspace_favorites_insert on public.workspace_favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and (select app.workspace_page_visible(page_id)));
create policy workspace_favorites_update on public.workspace_favorites for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workspace_favorites_delete on public.workspace_favorites for delete to authenticated
  using (user_id = (select auth.uid()));

/** Un favori appartient à l'organisation de sa page ; l'auteur est la session. */
create or replace function app.guard_workspace_favorite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select organization_id into new.organization_id from public.workspace_pages where id = new.page_id;
  if new.organization_id is null then
    raise exception 'Page introuvable.' using errcode = 'foreign_key_violation';
  end if;
  new.user_id := coalesce((select auth.uid()), new.user_id);
  return new;
end;
$$;

revoke all on function app.guard_workspace_favorite() from public, anon, authenticated;

create trigger workspace_favorites_guard
  before insert on public.workspace_favorites
  for each row execute function app.guard_workspace_favorite();

-- -----------------------------------------------------------------------------
-- 9. Auto-vérification
-- -----------------------------------------------------------------------------
do $$
declare v int;
begin
  select count(*) into v from public.role_permissions where permission = 'ai.workspace';
  if v <> 6 then raise exception '% rôle(s) avec ai.workspace au lieu de 6.', v; end if;
  select count(*) into v from public.role_permissions where permission = 'ai.use';
  if v <> 1 then raise exception 'ai.use doit rester au seul propriétaire (% rôles).', v; end if;
  select count(*) into v from public.workspace_templates where organization_id is null;
  if v <> 5 then raise exception '% modèle(s) système au lieu de 5.', v; end if;
  select count(*) into v from pg_policy p join pg_class c on c.oid = p.polrelid
  where c.relname in ('workspace_spaces', 'workspace_pages', 'workspace_page_revisions', 'workspace_tasks',
                      'workspace_templates', 'workspace_page_visits', 'workspace_favorites');
  if v <> 21 then raise exception '% politique(s) RLS au lieu de 21.', v; end if;
  select count(*) into v from pg_policy p join pg_class c on c.oid = p.polrelid
  where c.relname = 'objects' and p.polname like 'workspace_covers_%';
  if v <> 3 then raise exception '% politique(s) Storage au lieu de 3.', v; end if;
  if app.tiptap_text('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Bonjour"}]}]}'::jsonb) <> E'Bonjour\n' then
    raise exception 'L''extraction du texte TipTap ne renvoie pas ce qu''elle doit.';
  end if;
end $$;
