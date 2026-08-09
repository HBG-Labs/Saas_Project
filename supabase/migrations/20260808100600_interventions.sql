-- =============================================================================
-- Interventions, comptes rendus et pièces jointes
-- =============================================================================
-- Pourquoi `interventions` est distincte de `missions` : une mission est un
-- ORDRE DE TRAVAIL, une intervention est un PASSAGE SUR SITE. Le raccordement
-- qui échoue faute de matériel puis reprend le lendemain, c'est une mission et
-- deux interventions. Les fusionner obligerait soit à écraser la première
-- visite, soit à créer une fausse seconde mission.
--
-- Et `intervention_reports` est distincte d'`interventions` parce que le
-- compte rendu porte son propre cycle de contrôle (brouillon → soumis →
-- validé/refusé), avec un réviseur, une date de revue et un motif de refus.
-- Ces colonnes n'ont aucun sens sur l'exécution elle-même.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'intervention_status') then
    create type public.intervention_status as enum (
      'planned', 'in_progress', 'completed', 'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('draft', 'submitted', 'approved', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'attachment_kind') then
    create type public.attachment_kind as enum (
      'before', 'after', 'document', 'proof', 'signature'
    );
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- interventions
-- -----------------------------------------------------------------------------
create table if not exists public.interventions (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions (id) on delete cascade,

  -- DÉNORMALISÉ depuis la mission. Chaque policy de cette table filtre par
  -- organisation ; sans cette colonne, il faudrait joindre `missions` à chaque
  -- ligne évaluée. Le risque de divergence est fermé par le trigger
  -- `enforce_intervention_org` : la colonne est écrasée, jamais lue du client.
  organization_id uuid not null references public.organizations (id) on delete cascade,

  technician_id uuid not null references public.organization_members (id) on delete restrict,

  status      public.intervention_status not null default 'planned',

  start_time  timestamptz,
  end_time    timestamptz,

  -- Relevé au démarrage. Prépare le pointage géolocalisé du §14 sans imposer
  -- PostGIS aujourd'hui.
  start_latitude  numeric(9, 6),
  start_longitude numeric(9, 6),

  notes       text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint interventions_time_order check (
    start_time is null or end_time is null or end_time >= start_time
  )
);

comment on table public.interventions is
  'Passage sur site. Une mission peut en compter plusieurs (reprise, seconde visite).';

create index if not exists interventions_mission_idx on public.interventions (mission_id);
create index if not exists interventions_org_status_idx
  on public.interventions (organization_id, status);
create index if not exists interventions_technician_idx
  on public.interventions (technician_id, start_time desc);

drop trigger if exists interventions_set_updated_at on public.interventions;
create trigger interventions_set_updated_at
  before update on public.interventions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- intervention_reports
-- -----------------------------------------------------------------------------
create table if not exists public.intervention_reports (
  id              uuid primary key default gen_random_uuid(),

  -- Un compte rendu par intervention. La contrainte `unique` évite qu'un
  -- second CR soumis en parallèle rende le contrôle ambigu.
  intervention_id uuid not null unique references public.interventions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  technician_id   uuid not null references public.organization_members (id) on delete restrict,

  work_description text,
  observations     text,

  -- `jsonb` plutôt que des tables dédiées : le §14 prévoit une vraie gestion
  -- des matériaux, dont le schéma dépendra d'un catalogue qui n'existe pas.
  -- Figer ce schéma maintenant garantirait de le refaire ; `jsonb` accueille la
  -- saisie libre d'aujourd'hui et se migrera vers des tables quand la forme
  -- sera connue.
  materials_used   jsonb not null default '[]'::jsonb,
  tools_used       jsonb not null default '[]'::jsonb,

  -- Signatures : chemins Storage, jamais l'image elle-même. Stocker un PNG en
  -- base gonflerait chaque lecture de la table.
  customer_signature_path   text,
  customer_signature_name   text,
  technician_signature_path text,

  status          public.report_status not null default 'draft',
  submitted_at    timestamptz,

  reviewed_at     timestamptz,
  reviewed_by     uuid references public.organization_members (id) on delete set null,
  rejection_reason text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Un refus sans motif est inexploitable par le technicien qui doit reprendre.
  constraint intervention_reports_rejection_reason check (
    status <> 'rejected' or (rejection_reason is not null and char_length(rejection_reason) >= 5)
  )
);

create index if not exists intervention_reports_org_status_idx
  on public.intervention_reports (organization_id, status);

create index if not exists intervention_reports_pending_review_idx
  on public.intervention_reports (organization_id, submitted_at)
  where status = 'submitted';

drop trigger if exists intervention_reports_set_updated_at on public.intervention_reports;
create trigger intervention_reports_set_updated_at
  before update on public.intervention_reports
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- intervention_attachments
-- -----------------------------------------------------------------------------
create table if not exists public.intervention_attachments (
  id              uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.interventions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  kind            public.attachment_kind not null default 'document',

  -- Chemin dans le bucket `intervention-attachments`. Le premier segment est
  -- l'organization_id : c'est ce que les policies Storage inspectent.
  storage_path    text not null unique,
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint check (size_bytes is null or size_bytes >= 0),

  caption         text,
  uploaded_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists intervention_attachments_intervention_idx
  on public.intervention_attachments (intervention_id, kind);

-- =============================================================================
-- COHÉRENCE ET SÉPARATION DES POUVOIRS
-- =============================================================================

-- `organization_id` est dérivé, jamais déclaré. Le client peut envoyer ce qu'il
-- veut : la valeur est écrasée par celle de la mission. C'est ce qui rend la
-- dénormalisation sûre.
create or replace function app.enforce_intervention_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_tech_org uuid;
begin
  select organization_id into v_org from public.missions where id = new.mission_id;

  if v_org is null then
    raise exception 'Mission introuvable.' using errcode = 'foreign_key_violation';
  end if;

  new.organization_id := v_org;

  select organization_id into v_tech_org
  from public.organization_members where id = new.technician_id;

  if v_tech_org is distinct from v_org then
    raise exception 'Le technicien doit appartenir à l''organisation de la mission.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists interventions_enforce_org on public.interventions;
create trigger interventions_enforce_org
  before insert or update on public.interventions
  for each row execute function app.enforce_intervention_org();

create or replace function app.enforce_report_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org  uuid;
  v_tech uuid;
begin
  select organization_id, technician_id into v_org, v_tech
  from public.interventions where id = new.intervention_id;

  if v_org is null then
    raise exception 'Intervention introuvable.' using errcode = 'foreign_key_violation';
  end if;

  new.organization_id := v_org;
  -- Le rédacteur du compte rendu EST l'intervenant : on ne laisse pas le
  -- client désigner quelqu'un d'autre, ce qui fausserait la traçabilité et
  -- contournerait la séparation des pouvoirs ci-dessous.
  new.technician_id := coalesce(v_tech, new.technician_id);

  return new;
end;
$$;

drop trigger if exists intervention_reports_enforce_org on public.intervention_reports;
create trigger intervention_reports_enforce_org
  before insert or update on public.intervention_reports
  for each row execute function app.enforce_report_org();

create or replace function app.enforce_attachment_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.interventions where id = new.intervention_id;

  if v_org is null then
    raise exception 'Intervention introuvable.' using errcode = 'foreign_key_violation';
  end if;

  new.organization_id := v_org;

  -- Le chemin Storage DOIT commencer par l'organisation : les policies du
  -- bucket n'ont que cette information pour décider. Un chemin mal préfixé
  -- rendrait le fichier soit inaccessible, soit visible ailleurs.
  if split_part(new.storage_path, '/', 1) <> v_org::text then
    raise exception 'Le chemin de stockage doit commencer par l''identifiant de l''organisation (%/...).', v_org
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists intervention_attachments_enforce_org on public.intervention_attachments;
create trigger intervention_attachments_enforce_org
  before insert or update on public.intervention_attachments
  for each row execute function app.enforce_attachment_org();

-- -----------------------------------------------------------------------------
-- SÉPARATION DES POUVOIRS — exigence centrale du §12
-- -----------------------------------------------------------------------------
-- « Un technicien ne doit jamais pouvoir valider lui-même une intervention
--   qu'il a réalisée. »
--
-- Le retirer de la matrice de permissions ne suffit pas : un chef d'équipe ou
-- un manager PEUT réviser, et rien ne l'empêcherait de réviser son propre
-- compte rendu s'il est descendu sur le terrain. Le contrôle doit donc porter
-- sur l'IDENTITÉ, pas seulement sur le rôle.
--
-- Placé dans un trigger et non dans une policy : une policy `with check` ne
-- voit pas l'ancienne ligne, elle ne saurait pas distinguer une soumission
-- d'une validation.
create or replace function app.enforce_report_review_separation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor        uuid := (select auth.uid());
  v_actor_member uuid;
  v_tech_user    uuid;
begin
  if v_actor is null then
    return new;  -- service_role : hors session utilisateur
  end if;

  -- Horodatage de soumission, dérivé de l'état plutôt que déclaré.
  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    new.submitted_at := coalesce(new.submitted_at, now());
  end if;

  if new.status not in ('approved', 'rejected')
     or old.status = new.status then
    return new;
  end if;

  -- Un compte rendu se contrôle APRÈS soumission. Valider un brouillon
  -- court-circuiterait le technicien.
  if old.status <> 'submitted' then
    raise exception 'Seul un compte rendu soumis peut être validé ou refusé (état actuel : %).', old.status
      using errcode = 'check_violation';
  end if;

  if not app.has_org_permission(new.organization_id, 'intervention.review') then
    raise exception 'Vous n''avez pas la permission de contrôler un compte rendu.'
      using errcode = 'insufficient_privilege';
  end if;

  select id into v_actor_member
  from public.organization_members
  where organization_id = new.organization_id and user_id = v_actor and status = 'active';

  select om.user_id into v_tech_user
  from public.organization_members om
  where om.id = new.technician_id;

  -- LA règle. Comparaison sur `user_id` et non sur `technician_id` : le même
  -- individu pourrait sinon posséder deux lignes de membership et se contrôler
  -- lui-même par le détour.
  if v_tech_user = v_actor then
    raise exception
      'Un intervenant ne peut pas contrôler son propre compte rendu. La validation revient à un responsable.'
      using errcode = 'insufficient_privilege';
  end if;

  new.reviewed_by := v_actor_member;
  new.reviewed_at := now();

  return new;
end;
$$;

drop trigger if exists intervention_reports_review_separation on public.intervention_reports;
create trigger intervention_reports_review_separation
  before update on public.intervention_reports
  for each row execute function app.enforce_report_review_separation();

-- Propagation du contrôle vers la mission : valider un compte rendu clôt la
-- mission, la refuser la renvoie au technicien. Le faire ici plutôt que côté
-- client garantit que les deux états ne divergent jamais.
create or replace function app.sync_mission_from_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mission uuid;
begin
  select mission_id into v_mission from public.interventions where id = new.intervention_id;
  if v_mission is null then
    return new;
  end if;

  -- Ces UPDATE déclenchent `enforce_mission_transition`, qui revalide la
  -- transition ET journalise l'événement dans `mission_status_events`.
  -- Ne rien insérer ici : un second enregistrement produirait deux entrées
  -- pour un seul changement d'état, et l'historique afficherait chaque
  -- validation en double.
  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    update public.missions set status = 'submitted'
    where id = v_mission and status in ('completed', 'in_progress');

  elsif new.status = 'approved' and old.status is distinct from 'approved' then
    update public.missions set status = 'approved'
    where id = v_mission and status = 'submitted';

  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    update public.missions set status = 'rejected'
    where id = v_mission and status = 'submitted';
  end if;

  return new;
end;
$$;

drop trigger if exists intervention_reports_sync_mission on public.intervention_reports;
create trigger intervention_reports_sync_mission
  after update on public.intervention_reports
  for each row execute function app.sync_mission_from_report();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.interventions            enable row level security;
alter table public.intervention_reports     enable row level security;
alter table public.intervention_attachments enable row level security;

-- Deux portes : le contrôleur (`intervention.view_all`) et l'intervenant
-- lui-même. Un technicien ne voit donc que ses propres interventions —
-- y compris celles de ses collègues de la même équipe, qui lui restent
-- invisibles.
drop policy if exists "interventions_select_scoped" on public.interventions;
create policy "interventions_select_scoped"
  on public.interventions for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and (
      (select app.has_org_permission(organization_id, 'intervention.view_all'))
      or technician_id in (
        select m.id from public.organization_members m
        where m.user_id = (select auth.uid())
      )
    )
  );

-- Le technicien crée SON intervention et personne d'autre : `technician_id`
-- doit correspondre à son propre membership.
drop policy if exists "interventions_insert_scoped" on public.interventions;
create policy "interventions_insert_scoped"
  on public.interventions for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and (
      technician_id in (
        select m.id from public.organization_members m
        where m.user_id = (select auth.uid())
      )
      or (select app.has_org_permission(organization_id, 'mission.assign'))
    )
  );

drop policy if exists "interventions_update_scoped" on public.interventions;
create policy "interventions_update_scoped"
  on public.interventions for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and (
      technician_id in (
        select m.id from public.organization_members m
        where m.user_id = (select auth.uid())
      )
      or (select app.has_org_permission(organization_id, 'intervention.view_all'))
    )
  )
  with check ((select app.can_use_pro_module(organization_id, 'interventions')));

drop policy if exists "interventions_delete_scoped" on public.interventions;
create policy "interventions_delete_scoped"
  on public.interventions for delete
  to authenticated
  using ((select app.has_org_permission(organization_id, 'mission.delete')));

-- ------------------------------------------------------- intervention_reports
drop policy if exists "intervention_reports_select" on public.intervention_reports;
create policy "intervention_reports_select"
  on public.intervention_reports for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and (
      (select app.has_org_permission(organization_id, 'intervention.view_all'))
      or (select app.has_org_permission(organization_id, 'intervention.review'))
      or technician_id in (
        select m.id from public.organization_members m
        where m.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "intervention_reports_insert" on public.intervention_reports;
create policy "intervention_reports_insert"
  on public.intervention_reports for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and intervention_id in (
      select i.id from public.interventions i
      join public.organization_members m on m.id = i.technician_id
      where m.user_id = (select auth.uid())
    )
  );

-- Le technicien édite tant que le CR n'est pas soumis ; le contrôleur agit
-- après. Le `using` autorise la tentative, les triggers arbitrent le reste :
-- la condition `old.status = 'submitted'` pour valider, et la séparation des
-- pouvoirs, ne sont pas exprimables dans une policy.
drop policy if exists "intervention_reports_update" on public.intervention_reports;
create policy "intervention_reports_update"
  on public.intervention_reports for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and (
      (status = 'draft' and technician_id in (
        select m.id from public.organization_members m
        where m.user_id = (select auth.uid())
      ))
      or (status = 'rejected' and technician_id in (
        select m.id from public.organization_members m
        where m.user_id = (select auth.uid())
      ))
      or (select app.has_org_permission(organization_id, 'intervention.review'))
    )
  )
  with check ((select app.can_use_pro_module(organization_id, 'interventions')));

-- Aucune policy DELETE : un compte rendu validé est une pièce probante.
-- Le supprimer effacerait la trace d'une intervention facturée.

-- --------------------------------------------------- intervention_attachments
drop policy if exists "intervention_attachments_select" on public.intervention_attachments;
create policy "intervention_attachments_select"
  on public.intervention_attachments for select
  to authenticated
  using (intervention_id in (select id from public.interventions));

drop policy if exists "intervention_attachments_insert" on public.intervention_attachments;
create policy "intervention_attachments_insert"
  on public.intervention_attachments for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'attachments'))
    and intervention_id in (select id from public.interventions)
    and uploaded_by = (select auth.uid())
  );

drop policy if exists "intervention_attachments_delete" on public.intervention_attachments;
create policy "intervention_attachments_delete"
  on public.intervention_attachments for delete
  to authenticated
  using (
    uploaded_by = (select auth.uid())
    or (select app.has_org_permission(organization_id, 'intervention.review'))
  );
