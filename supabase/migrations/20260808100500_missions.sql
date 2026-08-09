-- =============================================================================
-- Missions / interventions terrain
-- =============================================================================
-- Cycle de vie du §9 :
--
--   DRAFT → ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED
--                                                   ↓
--                                              SUBMITTED
--                                                   ↓
--                                        APPROVED / REJECTED
--
-- Les transitions ne sont PAS écrites en dur dans un `case`. Elles vivent dans
-- `mission_status_transitions`, une table. Le §8 exige de pouvoir ajouter des
-- statuts plus tard : avec une table, c'est un `insert` ; avec un `case`, c'est
-- une migration de fonction et un déploiement.
--
-- Chaque changement d'état est journalisé dans `mission_status_events`. Sans
-- cet historique, « qui a annulé cette mission et quand » resterait sans
-- réponse — question qui se pose invariablement en litige client.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'mission_status') then
    create type public.mission_status as enum (
      'draft', 'assigned', 'accepted', 'in_progress',
      'completed', 'submitted', 'approved', 'rejected', 'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'mission_priority') then
    create type public.mission_priority as enum ('low', 'normal', 'high', 'urgent');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- missions
-- -----------------------------------------------------------------------------
create table if not exists public.missions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Numéro lisible, unique par organisation. Un UUID ne se dicte pas au
  -- téléphone ; sur le terrain, on annonce « mission 2026-0042 ».
  reference       text not null,

  title           text not null check (char_length(title) between 3 and 200),
  description     text,
  category_id     uuid references public.categories (id) on delete set null,

  priority        public.mission_priority not null default 'normal',
  status          public.mission_status not null default 'draft',

  -- Affectation courante. Les deux sont nullables et peuvent coexister :
  -- une mission confiée à l'équipe fibre ET nominativement à un technicien.
  -- L'historique complet vit dans `mission_assignments`.
  assigned_team_id uuid references public.teams (id) on delete set null,
  assigned_user_id uuid references public.organization_members (id) on delete set null,

  scheduled_start timestamptz,
  scheduled_end   timestamptz,
  actual_start    timestamptz,
  actual_end      timestamptz,

  -- Localisation. `latitude`/`longitude` en numeric et non en type PostGIS :
  -- l'extension n'est pas nécessaire pour stocker un point, et l'ajouter plus
  -- tard (§14 géolocalisation) ne cassera pas ces colonnes.
  location_label  text,
  address_line1   text,
  address_line2   text,
  postal_code     text,
  city            text,
  country         text default 'FR',
  latitude        numeric(9, 6)  check (latitude  is null or latitude  between -90  and 90),
  longitude       numeric(9, 6)  check (longitude is null or longitude between -180 and 180),

  customer_name    text,
  customer_contact text,
  customer_phone   text,
  customer_email   text,

  notes           text,

  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (organization_id, reference),

  -- Une fin planifiée antérieure au début est une erreur de saisie, pas un cas
  -- métier. La base la refuse plutôt que de la propager dans les plannings.
  constraint missions_schedule_order check (
    scheduled_start is null or scheduled_end is null or scheduled_end >= scheduled_start
  ),
  constraint missions_actual_order check (
    actual_start is null or actual_end is null or actual_end >= actual_start
  )
);

comment on table public.missions is
  'Ordre de travail. Une mission peut donner lieu à plusieurs interventions (plusieurs passages sur site).';

-- Index alignés sur les requêtes réellement émises par le module :
--   • la liste du tableau de bord filtre par organisation et statut
--   • le planning trie par date planifiée
--   • « mes missions » filtre par technicien puis par statut
create index if not exists missions_org_status_idx
  on public.missions (organization_id, status);

create index if not exists missions_org_scheduled_idx
  on public.missions (organization_id, scheduled_start desc nulls last);

create index if not exists missions_assigned_user_idx
  on public.missions (assigned_user_id, status)
  where assigned_user_id is not null;

create index if not exists missions_assigned_team_idx
  on public.missions (assigned_team_id, status)
  where assigned_team_id is not null;

create index if not exists missions_category_idx on public.missions (category_id);

drop trigger if exists missions_set_updated_at on public.missions;
create trigger missions_set_updated_at
  before update on public.missions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Numérotation automatique
-- -----------------------------------------------------------------------------
-- Séquence par organisation et par année. Une séquence PostgreSQL globale
-- fuirait le volume d'activité des autres clients : voir sa première mission
-- numérotée 8 412 renseigne un concurrent sur l'usage de la plateforme.
create or replace function app.generate_mission_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year  text := to_char(now(), 'YYYY');
  v_next  integer;
begin
  if new.reference is not null and new.reference <> '' then
    return new;
  end if;

  select coalesce(max(substring(reference from '\d+$')::integer), 0) + 1
  into v_next
  from public.missions
  where organization_id = new.organization_id
    and reference like v_year || '-%';

  new.reference := v_year || '-' || lpad(v_next::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists missions_generate_reference on public.missions;
create trigger missions_generate_reference
  before insert on public.missions
  for each row execute function app.generate_mission_reference();

-- -----------------------------------------------------------------------------
-- mission_assignments — historique des affectations
-- -----------------------------------------------------------------------------
create table if not exists public.mission_assignments (
  id           uuid primary key default gen_random_uuid(),
  mission_id   uuid not null references public.missions (id) on delete cascade,

  team_id      uuid references public.teams (id) on delete cascade,
  member_id    uuid references public.organization_members (id) on delete cascade,

  assigned_by  uuid references auth.users (id) on delete set null,
  assigned_at  timestamptz not null default now(),
  -- `unassigned_at` renseigné = affectation révolue. On ne supprime pas la
  -- ligne : l'historique doit rester lisible après coup.
  unassigned_at timestamptz,
  accepted_at  timestamptz,
  declined_at  timestamptz,
  decline_reason text,

  constraint mission_assignments_target check (team_id is not null or member_id is not null)
);

create index if not exists mission_assignments_mission_idx
  on public.mission_assignments (mission_id, assigned_at desc);

create index if not exists mission_assignments_member_idx
  on public.mission_assignments (member_id)
  where unassigned_at is null;

-- -----------------------------------------------------------------------------
-- mission_status_transitions — la machine à états, en données
-- -----------------------------------------------------------------------------
create table if not exists public.mission_status_transitions (
  from_status         public.mission_status not null,
  to_status           public.mission_status not null,
  -- Permission exigée. NULL = aucune permission particulière : la transition
  -- est ouverte à l'assigné (cas de l'acceptation par le technicien).
  required_permission text,
  -- `true` : réservé à l'utilisateur affecté à la mission. C'est ce qui
  -- empêche un collègue de démarrer l'intervention d'un autre.
  assignee_only       boolean not null default false,
  description         text,
  primary key (from_status, to_status)
);

comment on table public.mission_status_transitions is
  'Machine à états des missions, en données plutôt qu''en code. Ajouter un statut = insérer des lignes (§8).';

delete from public.mission_status_transitions;

insert into public.mission_status_transitions (from_status, to_status, required_permission, assignee_only, description) values
  ('draft',       'assigned',   'mission.assign', false, 'Affectation à une équipe ou un technicien'),
  ('draft',       'cancelled',  'mission.cancel', false, 'Abandon avant affectation'),

  ('assigned',    'accepted',   null,             true,  'Acceptation par le technicien affecté'),
  ('assigned',    'assigned',   'mission.assign', false, 'Réaffectation à un autre intervenant'),
  ('assigned',    'draft',      'mission.assign', false, 'Retrait de l''affectation'),
  ('assigned',    'cancelled',  'mission.cancel', false, 'Annulation après affectation'),

  ('accepted',    'in_progress', null,            true,  'Démarrage de l''intervention sur site'),
  ('accepted',    'assigned',   'mission.assign', false, 'Réaffectation malgré l''acceptation'),
  ('accepted',    'cancelled',  'mission.cancel', false, 'Annulation avant démarrage'),

  ('in_progress', 'completed',  null,             true,  'Fin des travaux sur site'),
  ('in_progress', 'cancelled',  'mission.cancel', false, 'Interruption définitive'),

  ('completed',   'submitted',  null,             true,  'Envoi du compte rendu au contrôle'),

  ('submitted',   'approved',   'intervention.review', false, 'Validation par le responsable'),
  ('submitted',   'rejected',   'intervention.review', false, 'Refus motivé par le responsable'),

  -- Une mission refusée retourne au technicien : c'est la boucle de reprise.
  -- Sans elle, un refus serait un cul-de-sac et imposerait de recréer la
  -- mission, perdant tout l'historique.
  ('rejected',    'in_progress', null,            true,  'Reprise des travaux après refus'),
  ('rejected',    'cancelled',  'mission.cancel', false, 'Abandon après refus');

-- -----------------------------------------------------------------------------
-- mission_status_events — journal des changements d'état
-- -----------------------------------------------------------------------------
create table if not exists public.mission_status_events (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions (id) on delete cascade,
  from_status public.mission_status,
  to_status   public.mission_status not null,
  actor_id    uuid references auth.users (id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists mission_status_events_mission_idx
  on public.mission_status_events (mission_id, created_at desc);

-- =============================================================================
-- APPLICATION DE LA MACHINE À ÉTATS
-- =============================================================================

-- L'utilisateur courant est-il l'intervenant affecté à cette mission ?
-- Vrai s'il est nommément désigné, ou membre de l'équipe affectée.
create or replace function app.is_mission_assignee(p_mission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.missions m
    left join public.organization_members om on om.id = m.assigned_user_id
    where m.id = p_mission_id
      and (
        om.user_id = (select auth.uid())
        or m.assigned_team_id in (select app.my_team_ids())
      )
  );
$$;

revoke all on function app.is_mission_assignee(uuid) from public, anon;
grant execute on function app.is_mission_assignee(uuid) to authenticated;

-- Contrôle central : toute transition passe ici, quel que soit le chemin
-- d'écriture. Un UPDATE direct depuis PostgREST est soumis au même contrôle
-- qu'un appel de fonction — c'est l'intérêt de le placer dans un trigger
-- plutôt que dans une couche service.
create or replace function app.enforce_mission_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule   public.mission_status_transitions;
  v_actor  uuid := (select auth.uid());
begin
  if new.status = old.status then
    return new;
  end if;

  -- `service_role` (webhooks, tâches planifiées, migrations) n'est pas soumis
  -- à la machine à états : il opère hors session utilisateur.
  if v_actor is null then
    return new;
  end if;

  select * into v_rule
  from public.mission_status_transitions
  where from_status = old.status and to_status = new.status;

  if not found then
    raise exception 'Transition interdite : % → %.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if v_rule.required_permission is not null
     and not app.has_org_permission(new.organization_id, v_rule.required_permission) then
    raise exception 'Permission « % » requise pour passer la mission en « % ».',
      v_rule.required_permission, new.status
      using errcode = 'insufficient_privilege';
  end if;

  if v_rule.assignee_only and not app.is_mission_assignee(new.id) then
    raise exception 'Seul l''intervenant affecté peut passer la mission en « % ».', new.status
      using errcode = 'insufficient_privilege';
  end if;

  -- Horodatage réel dérivé de l'état : le renseigner côté client laisserait un
  -- technicien antidater son intervention.
  if new.status = 'in_progress' and old.status <> 'in_progress' then
    new.actual_start := coalesce(new.actual_start, now());
  end if;

  if new.status = 'completed' then
    new.actual_end := coalesce(new.actual_end, now());
  end if;

  insert into public.mission_status_events (mission_id, from_status, to_status, actor_id)
  values (new.id, old.status, new.status, v_actor);

  return new;
end;
$$;

drop trigger if exists missions_enforce_transition on public.missions;
create trigger missions_enforce_transition
  before update of status on public.missions
  for each row execute function app.enforce_mission_transition();

-- Cohérence inter-tenant : même faille que pour `team_members`. L'équipe et le
-- technicien affectés doivent relever de l'organisation de la mission.
create or replace function app.enforce_mission_assignment_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if new.assigned_team_id is not null then
    select organization_id into v_org from public.teams where id = new.assigned_team_id;
    if v_org is distinct from new.organization_id then
      raise exception 'L''équipe affectée doit appartenir à l''organisation de la mission.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  if new.assigned_user_id is not null then
    select organization_id into v_org from public.organization_members where id = new.assigned_user_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Le technicien affecté doit appartenir à l''organisation de la mission.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists missions_assignment_same_org on public.missions;
create trigger missions_assignment_same_org
  before insert or update on public.missions
  for each row execute function app.enforce_mission_assignment_same_org();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.missions                   enable row level security;
alter table public.mission_assignments        enable row level security;
alter table public.mission_status_events      enable row level security;
alter table public.mission_status_transitions enable row level security;

-- Table de référence, lisible par tout utilisateur connecté : le frontend en a
-- besoin pour n'afficher que les actions réellement possibles.
drop policy if exists "mission_status_transitions_select" on public.mission_status_transitions;
create policy "mission_status_transitions_select"
  on public.mission_status_transitions for select
  to authenticated
  using (true);

-- ------------------------------------------------------------------- missions
-- LA policy décisive. Elle traduit le §12 : « un technicien ne doit jamais voir
-- les missions qui ne lui sont pas accessibles ».
--
-- Trois portes, dans l'ordre de généralité décroissante :
--   1. `mission.view_all` — owner, admin, manager : toute l'organisation
--   2. l'affectation nominative
--   3. l'appartenance à l'équipe affectée
--
-- Un technicien sans aucune des trois ne voit RIEN, y compris dans sa propre
-- entreprise. C'est le moindre privilège appliqué à la lecture.
drop policy if exists "missions_select_scoped" on public.missions;
create policy "missions_select_scoped"
  on public.missions for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'missions'))
    and (
      (select app.has_org_permission(organization_id, 'mission.view_all'))
      or assigned_user_id in (
        select m.id from public.organization_members m
        where m.user_id = (select auth.uid())
      )
      or assigned_team_id in (select app.my_team_ids())
      or created_by = (select auth.uid())
    )
  );

drop policy if exists "missions_insert_permitted" on public.missions;
create policy "missions_insert_permitted"
  on public.missions for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'missions'))
    and (select app.has_org_permission(organization_id, 'mission.create'))
    and created_by = (select auth.uid())
  );

-- L'écriture est ouverte à l'assigné : il doit pouvoir accepter, démarrer,
-- terminer. Ce qu'il peut effectivement changer reste borné par le trigger de
-- transition — la policy autorise l'UPDATE, la machine à états décide du
-- contenu. Séparer les deux évite une policy illisible.
drop policy if exists "missions_update_permitted" on public.missions;
create policy "missions_update_permitted"
  on public.missions for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'missions'))
    and (
      (select app.has_org_permission(organization_id, 'mission.update'))
      or (select app.is_mission_assignee(id))
    )
  )
  with check ((select app.can_use_pro_module(organization_id, 'missions')));

drop policy if exists "missions_delete_permitted" on public.missions;
create policy "missions_delete_permitted"
  on public.missions for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'mission.delete')));

-- -------------------------------------------------------- mission_assignments
-- Le périmètre est celui de la mission : le sous-`select` hérite de la policy
-- ci-dessus, donc de ses trois portes, sans les redire.
drop policy if exists "mission_assignments_select" on public.mission_assignments;
create policy "mission_assignments_select"
  on public.mission_assignments for select
  to authenticated
  using (mission_id in (select id from public.missions));

drop policy if exists "mission_assignments_insert" on public.mission_assignments;
create policy "mission_assignments_insert"
  on public.mission_assignments for insert
  to authenticated
  with check (
    mission_id in (
      select m.id from public.missions m
      where (select app.has_org_permission(m.organization_id, 'mission.assign'))
    )
  );

-- L'assigné met à jour SA ligne pour accepter ou refuser ; le gestionnaire
-- clôt l'affectation.
drop policy if exists "mission_assignments_update" on public.mission_assignments;
create policy "mission_assignments_update"
  on public.mission_assignments for update
  to authenticated
  using (
    mission_id in (
      select m.id from public.missions m
      where (select app.has_org_permission(m.organization_id, 'mission.assign'))
         or (select app.is_mission_assignee(m.id))
    )
  )
  with check (mission_id in (select id from public.missions));

drop policy if exists "mission_assignments_delete" on public.mission_assignments;
create policy "mission_assignments_delete"
  on public.mission_assignments for delete
  to authenticated
  using (
    mission_id in (
      select m.id from public.missions m
      where (select app.has_org_permission(m.organization_id, 'mission.assign'))
    )
  );

-- ------------------------------------------------------ mission_status_events
-- Lecture seule côté client. Les lignes sont écrites exclusivement par le
-- trigger de transition : autoriser l'insertion directe permettrait de forger
-- un historique, ce qui viderait la traçabilité de son sens.
drop policy if exists "mission_status_events_select" on public.mission_status_events;
create policy "mission_status_events_select"
  on public.mission_status_events for select
  to authenticated
  using (mission_id in (select id from public.missions));
